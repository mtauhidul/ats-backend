import cron from 'node-cron';
import { EmailAccount, Job, Application } from '../models';
import imapService from '../services/imap.service';
import { createApplicationWithParsing } from '../services/application.service';
import { parseResumeWithFallback } from '../services/enhancedResumeParser.service';
import {
  uploadVideoToCloudinary,
  validateVideoSize,
  extractVideoAttachments
} from '../utils/videoHandler';
import logger from '../utils/logger';
import { config } from '../config';

/**
 * Email Automation Cron Job
 * 
 * Simplified workflow aligned with manual import:
 * 1. Collects emails with resumes and video introductions
 * 2. Uploads files to Cloudinary
 * 3. Creates application (same as manual import)
 * 4. Application creation handles: AI validation, duplicate check, parsing
 * 
 * Features:
 * ✅ Text extraction for AI validation (pdf-parse → pdf2json fallback)
 * ✅ Video attachment support (mp4, mov, avi, webm, etc.)
 * ✅ Batch processing (5 emails at a time)
 * ✅ Duplicate check BEFORE processing
 * ✅ Invoice/receipt filtering
 * ✅ Comprehensive error handling
 * ✅ Uses same application creation flow as manual import
 * ✅ Stats tracking and monitoring
 */

class EmailAutomationJob {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private isEnabled = true;
  
  // Stats tracking
  private stats = {
    totalEmailsProcessed: 0,
    totalCandidatesCreated: 0,
    totalErrors: 0,
    lastRunAt: null as Date | null,
    lastRunDuration: 0,
  };

  // Batch processing config
  private readonly BATCH_SIZE = 5; // Process 5 emails at a time
  private readonly BATCH_DELAY = 2000; // 2 seconds between batches
  private readonly EMAIL_TIMEOUT = 60000; // 60 seconds per email

  /**
   * Start the cron job
   */
  start(): void {
    const interval = config.email.checkInterval || '*/15 * * * *';

    this.cronJob = cron.schedule(interval, async () => {
      if (this.isEnabled) {
        await this.processEmails();
      } else {
        logger.info('Email automation is disabled, skipping cycle');
      }
    });

    logger.info(`📧 Email automation cron job started (interval: ${interval})`);
    
    // Run immediately on startup
    setTimeout(() => {
      if (this.isEnabled) {
        this.processEmails().catch(err => {
          logger.error('Initial email processing failed:', err);
        });
      }
    }, 5000);
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('📧 Email automation cron job stopped');
    }
  }

  /**
   * Enable email automation
   */
  enable(): void {
    this.isEnabled = true;
    logger.info('📧 Email automation enabled');
  }

  /**
   * Disable email automation
   */
  disable(): void {
    this.isEnabled = false;
    logger.info('📧 Email automation disabled');
  }

  /**
   * Get stats
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Check if a candidate already exists with this email for a specific job (or unassigned)
   * @param email - Candidate email
   * @param jobId - Job ID (null for unassigned applications)
   */
  private async isDuplicate(email: string, jobId: string | null = null): Promise<boolean> {
    try {
      if (!email) return false;
      
      // Check for exact match: same email + same jobId (including null)
      const existing = await Application.findOne({ 
        email: email.toLowerCase().trim(),
        jobId: jobId || null // Explicitly check for null if no jobId
      });
      return !!existing;
    } catch (error: any) {
      logger.error('Error checking duplicate:', error);
      return false;
    }
  }

  /**
   * Process a single email with timeout protection
   */
  private async processEmailWithTimeout(
    email: any,
    account: any,
    job: any
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Email processing timeout after ${this.EMAIL_TIMEOUT}ms`));
      }, this.EMAIL_TIMEOUT);

      try {
        await this.processSingleEmail(email, account, job);
        clearTimeout(timeout);
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Process a single email
   */
  private async processSingleEmail(
    email: any,
    account: any,
    job: any
  ): Promise<void> {
    // Handle both ParsedMail format (from.value[0].address) and EmailMessage format (from as string)
    let fromEmail: string | undefined;
    let fromName: string = 'Unknown';
    
    if (typeof email.from === 'string') {
      // IMAP service format: "Name <email@example.com>" or just "email@example.com"
      const emailMatch = email.from.match(/<([^>]+)>/) || email.from.match(/([^\s<>]+@[^\s<>]+)/);
      fromEmail = emailMatch ? emailMatch[1] : undefined;
      const nameMatch = email.from.match(/^"?([^"<]+)"?\s*</);
      fromName = nameMatch ? nameMatch[1].trim() : (fromEmail ? fromEmail.split('@')[0] : 'Unknown');
    } else if (email.from?.value?.[0]) {
      // mailparser format
      fromEmail = email.from.value[0].address;
      fromName = email.from.value[0].name || 'Unknown';
    }
    
    const subject = email.subject || 'No Subject';
    
    logger.info(`\n${'='.repeat(80)}`);
    logger.info(`📧 Processing email from: ${fromName} <${fromEmail || 'no-email'}>`);
    logger.info(`   Subject: ${subject}`);
    logger.info(`   Attachments: ${email.attachments?.length || 0}`);
    
    // Skip if no sender email
    if (!fromEmail) {
      logger.warn(`⏭️ SKIPPING: No sender email address`);
      this.stats.totalEmailsProcessed++;
      return;
    }
    
    // Check for duplicate BEFORE processing attachments
    // Pass job ID to check for exact duplicate (same email + same job)
    const jobId = job?._id?.toString() || null;
    if (await this.isDuplicate(fromEmail, jobId)) {
      if (jobId) {
        logger.warn(`⏭️ SKIPPING: Application already exists for ${fromEmail} for this job`);
      } else {
        logger.warn(`⏭️ SKIPPING: Unassigned application already exists for ${fromEmail}`);
        logger.warn(`   Tip: Assign the existing application to a job or delete it to process new resumes from this email.`);
      }
      this.stats.totalEmailsProcessed++;
      return;
    }

    if (!email.attachments || email.attachments.length === 0) {
      logger.info('⏭️ No attachments, skipping');
      this.stats.totalEmailsProcessed++;
      return;
    }

    // Filter out invoice/receipt files
    const nonInvoiceAttachments = email.attachments.filter((att: any) => {
      const filename = att.filename.toLowerCase();
      const isInvoice = /invoice|receipt|statement|bill|order|confirmation/i.test(filename);
      if (isInvoice) {
        logger.info(`⏭️ Skipping invoice/receipt file: ${att.filename}`);
      }
      return !isInvoice;
    });

    if (nonInvoiceAttachments.length === 0) {
      logger.info('⏭️ No resume attachments, only invoices/receipts');
      this.stats.totalEmailsProcessed++;
      return;
    }

    // Separate resume and video attachments
    const resumeAttachments = nonInvoiceAttachments.filter((att: any) => {
      const filename = att.filename.toLowerCase();
      return filename.endsWith('.pdf') || 
             filename.endsWith('.doc') || 
             filename.endsWith('.docx');
    });

    const videoAttachmentsData = extractVideoAttachments(nonInvoiceAttachments);

    logger.info(`   📄 Resume files: ${resumeAttachments.length}`);
    logger.info(`   🎥 Video files: ${videoAttachmentsData.length}`);

    if (resumeAttachments.length === 0) {
      logger.info('⏭️ No resume attachments found');
      this.stats.totalEmailsProcessed++;
      return;
    }

    // Process the first resume attachment
    const attachment = resumeAttachments[0];
    logger.info(`\n📋 Processing resume: ${attachment.filename}`);

    try {
      // Step 1: Extract resume text for AI validation
      logger.info(`Step 1: Extracting resume text for AI validation...`);
      const { text: resumeText, method } = await parseResumeWithFallback(
        attachment.content,
        attachment.filename
      );
      logger.info(`✅ Step 1: Extracted ${resumeText.length} characters using ${method}`);

      // Step 2: Upload video if present
      let videoUrl: string | undefined;
      if (videoAttachmentsData.length > 0) {
        logger.info(`Step 2: Processing video attachments...`);
        
        for (const videoData of videoAttachmentsData) {
          try {
            // Validate video size
            const sizeValidation = validateVideoSize(videoData.attachment.content);
            if (!sizeValidation.valid) {
              logger.warn(`⚠️ Skipping video ${videoData.attachment.filename}: ${sizeValidation.error}`);
              continue;
            }

            logger.info(`   📹 Uploading ${videoData.attachment.filename} (${sizeValidation.sizeMB}MB, ${videoData.category})`);
            const videoUpload = await uploadVideoToCloudinary(
              videoData.attachment.content,
              videoData.attachment.filename
            );

            // Use the first video introduction as videoIntroUrl
            if (videoData.category === 'introduction' && !videoUrl) {
              videoUrl = videoUpload.url;
              logger.info(`✅ Step 2: Video intro uploaded to ${videoUrl}`);
            } else {
              logger.info(`✅ Video uploaded: ${videoUpload.url}`);
            }
          } catch (videoError: any) {
            logger.error(`❌ Video upload failed:`, videoError.message);
            // Don't fail the entire process if video upload fails
          }
        }
      }

      // Step 3: Create application using Direct Apply service
      // This handles: parsing (Affinda/OpenAI), Cloudinary upload, AI validation, duplicate check
      logger.info(`Step 3: Creating application with Direct Apply service...`);
      
      // Split name into first and last
      const nameParts = fromName.split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || '';

      const application = await createApplicationWithParsing({
        // Resume file
        resumeBuffer: attachment.content,
        resumeFilename: attachment.filename,
        resumeMimetype: attachment.contentType || 'application/pdf',
        
        // Candidate info from email (will be overwritten by parsed data if available)
        email: fromEmail,
        firstName,
        lastName,
        
        // Pre-extracted text for AI validation
        resumeRawText: resumeText,
        
        // Video (if present)
        videoIntroUrl: videoUrl,
        
        // Job association (if found)
        jobId: job?._id,
        clientId: job?.clientId,
        
        // Source tracking
        source: 'email_automation',
        sourceEmailAccountId: account._id,
      });

      this.stats.totalCandidatesCreated++;
      this.stats.totalEmailsProcessed++;

      const jobInfo = job ? `for ${job.title}` : '(unassigned)';
      logger.info(`\n✅ COMPLETE: Application created for ${application.firstName} ${application.lastName} ${jobInfo}`);
      logger.info(`   Application ID: ${application._id}`);
      logger.info(`   Email: ${application.email}`);
      logger.info(`   Resume: ${application.resumeUrl}`);
      if (videoUrl) {
        logger.info(`   Video: ${videoUrl}`);
      }
      if (application.isValidResume !== null) {
        logger.info(`   AI Validation: ${application.isValidResume ? '✓ VALID' : '✗ INVALID'} (${application.validationScore}/100)`);
        logger.info(`   Reason: ${application.validationReason}`);
      }
      if (application.parsedData) {
        logger.info(`   Parsed: ${application.parsedData.skills?.length || 0} skills, ${application.parsedData.experience?.length || 0} experiences`);
      }

    } catch (error: any) {
      this.stats.totalErrors++;
      
      // Check if this is a duplicate application error
      const isDuplicateError = error.message?.includes('Application already exists') || 
                               error.code === 11000;
      
      if (isDuplicateError) {
        logger.warn(`⚠️ SKIPPED: Duplicate application from ${fromEmail}`);
        logger.warn(`   Reason: ${error.message}`);
        logger.warn(`   This resume was already processed. The email will be marked as read.`);
      } else {
        logger.error(`\n❌ FAILED: Error processing email from ${fromEmail}:`, {
          error: error.message,
          stack: error.stack,
          fromEmail,
          subject,
          filename: attachment.filename
        });
      }
      
      throw error;
    }
  }

  /**
   * Main email processing function with batch processing
   */
  async processEmails(): Promise<void> {
    if (this.isRunning) {
      logger.warn('⚠️ Email automation is already running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    this.stats.lastRunAt = new Date();

    logger.info('\n' + '='.repeat(80));
    logger.info('🚀 EMAIL AUTOMATION CYCLE STARTED');
    logger.info('='.repeat(80));

    try {
      // Fetch active email accounts
      const accounts = await EmailAccount.find({ isActive: true });
      logger.info(`📊 Found ${accounts.length} active email account(s)`);

      if (accounts.length === 0) {
        logger.info('⏭️ No active email accounts configured');
        return;
      }

      // Process each account
      for (const account of accounts) {
        logger.info(`\n📬 Checking account: ${account.email}`);

        try {
          // Step 1: Fetch unread emails
          const emails = await imapService.fetchUnreadEmails(account);
          logger.info(`   Found ${emails.length} unread email(s)`);

          if (emails.length === 0) {
            // Update lastChecked
            account.lastChecked = new Date();
            await account.save();
            continue;
          }

          // Find active job for this email account
          const job = await Job.findOne({
            isActive: true,
            emailAccountId: account._id,
          });

          if (job) {
            logger.info(`   📋 Associated with job: ${job.title}`);
          } else {
            logger.info(`   ⚠️ No active job associated, applications will be unassigned`);
          }

          // Step 2: Process emails in batches
          for (let i = 0; i < emails.length; i += this.BATCH_SIZE) {
            const batch = emails.slice(i, i + this.BATCH_SIZE);
            const batchNum = Math.floor(i / this.BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(emails.length / this.BATCH_SIZE);

            logger.info(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} emails)`);

            // Process batch concurrently with timeout protection
            const results = await Promise.allSettled(
              batch.map(email => this.processEmailWithTimeout(email, account, job))
            );

            // Log batch results
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            logger.info(`   ✅ Successful: ${successful}, ❌ Failed: ${failed}`);

            // Wait between batches
            if (i + this.BATCH_SIZE < emails.length) {
              logger.info(`   ⏳ Waiting ${this.BATCH_DELAY}ms before next batch...`);
              await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
            }
          }

          // Update lastChecked
          account.lastChecked = new Date();
          await account.save();
          logger.info(`   ✅ Updated lastChecked for ${account.email}`);

        } catch (error: any) {
          logger.error(`❌ Error processing account ${account.email}:`, error);
          this.stats.totalErrors++;
        }
      }

      const duration = Date.now() - startTime;
      this.stats.lastRunDuration = duration;

      logger.info('\n' + '='.repeat(80));
      logger.info('🏁 EMAIL AUTOMATION CYCLE COMPLETED');
      logger.info('='.repeat(80));
      logger.info(`📊 Stats:`);
      logger.info(`   Duration: ${(duration / 1000).toFixed(2)}s`);
      logger.info(`   Emails processed: ${this.stats.totalEmailsProcessed}`);
      logger.info(`   Candidates created: ${this.stats.totalCandidatesCreated}`);
      logger.info(`   Errors: ${this.stats.totalErrors}`);
      logger.info('='.repeat(80) + '\n');

    } catch (error: any) {
      logger.error('❌ Email automation cycle failed:', error);
      this.stats.totalErrors++;
    } finally {
      this.isRunning = false;
    }
  }
}

// Export singleton instance
const emailAutomationJob = new EmailAutomationJob();
export default emailAutomationJob;
