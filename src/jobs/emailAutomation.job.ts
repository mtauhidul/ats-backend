import cron from 'node-cron';
import { EmailAccount, Application, Job } from '../models';
import imapService from '../services/imap.service';
import openaiService from '../services/openai.service';
import cloudinaryService from '../services/cloudinary.service';
import logger from '../utils/logger';
import { config } from '../config';

/**
 * Email Automation Cron Job
 * 
 * Monitors email accounts for new job applications with resume attachments.
 * Runs every 15 minutes (configurable via EMAIL_CHECK_INTERVAL env var).
 * 
 * Process:
 * 1. Fetch all active email accounts
 * 2. For each account, check for unread emails
 * 3. Extract resume attachments (PDF, DOC, DOCX)
 * 4. Parse resumes using OpenAI
 * 5. Create Application with source='email_automation'
 * 6. Mark email as read
 * 7. Update lastChecked timestamp
 */

class EmailAutomationJob {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private isEnabled = true; // Can be controlled from admin panel

  /**
   * Start the cron job
   */
  start(): void {
    // Get interval from env (default: every 15 minutes)
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
    }, 5000); // Wait 5 seconds after startup
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
   * Get automation status
   */
  getStatus(): { enabled: boolean; running: boolean } {
    return {
      enabled: this.isEnabled,
      running: this.isRunning,
    };
  }

  /**
   * Process emails from all active accounts
   */
  async processEmails(): Promise<void> {
    // Prevent concurrent runs
    if (this.isRunning) {
      logger.warn('Email automation job already running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('🔄 Starting email automation cycle...');

      // Fetch all active email accounts
      const emailAccounts = await EmailAccount.find({ isActive: true });

      if (emailAccounts.length === 0) {
        logger.info('No active email accounts found');
        return;
      }

      logger.info(`Found ${emailAccounts.length} active email account(s)`);

      let totalProcessed = 0;
      let totalCreated = 0;
      let totalErrors = 0;

      // Process each account
      for (const account of emailAccounts) {
        try {
          const result = await this.processAccount(account);
          totalProcessed += result.processed;
          totalCreated += result.created;
          totalErrors += result.errors;
        } catch (error: any) {
          logger.error(`Failed to process account ${account.email}:`, error.message);
          totalErrors++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(
        `✅ Email automation cycle completed in ${duration}s - ` +
        `Processed: ${totalProcessed}, Created: ${totalCreated}, Errors: ${totalErrors}`
      );
    } catch (error: any) {
      logger.error('Email automation cycle failed:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process emails from a single account
   */
  private async processAccount(account: any): Promise<{
    processed: number;
    created: number;
    errors: number;
  }> {
    const stats = { processed: 0, created: 0, errors: 0 };

    try {
      logger.info(`Processing account: ${account.email}`);

      // Fetch unread emails with attachments
      const emails = await imapService.fetchUnreadEmails(
        account.email,
        account.imapConfig
      );

      if (emails.length === 0) {
        logger.info(`No unread emails in ${account.email}`);
        account.lastChecked = new Date();
        await account.save();
        return stats;
      }

      logger.info(`Found ${emails.length} unread email(s) in ${account.email}`);

      // Process each email
      for (const email of emails) {
        try {
          stats.processed++;
          
          // Check for resume attachments
          const resumeAttachments = email.attachments?.filter((att: any) =>
            /\.(pdf|doc|docx)$/i.test(att.filename)
          );

          if (!resumeAttachments || resumeAttachments.length === 0) {
            logger.info(`No resume attachments in email from ${email.from}`);
            continue;
          }

          // Check for video attachments
          const videoAttachments = email.attachments?.filter((att: any) =>
            /\.(mp4|mov|avi|webm|mkv)$/i.test(att.filename)
          );

          // Process first resume attachment
          const attachment = resumeAttachments[0];
          logger.info(`Processing resume: ${attachment.filename} from ${email.from}`);

          // Parse resume with OpenAI
          const parsedResume = await openaiService.parseResumeFromFile(
            attachment.content,
            attachment.filename
          );

          // AI Validation (only for email automation)
          // Create a validation text from parsed data
          const validationText = `
Name: ${parsedResume.personalInfo?.firstName} ${parsedResume.personalInfo?.lastName}
Email: ${parsedResume.personalInfo?.email}
Phone: ${parsedResume.personalInfo?.phone}
Summary: ${parsedResume.summary || 'N/A'}
Skills: ${parsedResume.skills?.join(', ') || 'N/A'}
Experience: ${parsedResume.experience?.map(exp => `${exp.title} at ${exp.company}`).join('; ') || 'N/A'}
Education: ${parsedResume.education?.map(edu => `${edu.degree} from ${edu.institution}`).join('; ') || 'N/A'}
          `.trim();

          const validation = await openaiService.validateResume(validationText);

          logger.info(
            `Resume validation: ${validation.isValid ? '✅ Valid' : '⚠️ Needs Review'} ` +
            `(Score: ${validation.score}/100) - ${validation.reason}`
          );

          // Note: We don't auto-reject invalid resumes anymore
          // Instead, we store them with AI recommendation for admin review

          // Upload resume to Cloudinary
          const uploadResult = await cloudinaryService.uploadResume(
            attachment.content,
            attachment.filename
          );

          // Upload video if present
          let videoIntroUrl: string | undefined = undefined;
          if (videoAttachments && videoAttachments.length > 0) {
            const videoAttachment = videoAttachments[0];
            logger.info(`Processing video: ${videoAttachment.filename} from ${email.from}`);
            
            try {
              const videoUploadResult = await cloudinaryService.uploadVideo(
                videoAttachment.content,
                videoAttachment.filename
              );
              videoIntroUrl = videoUploadResult.url;
              logger.info(`✅ Video uploaded successfully`);
            } catch (videoError: any) {
              logger.error(`Failed to upload video: ${videoError.message}`);
              // Continue without video
            }
          }

          // Extract personal info from parsed data
          const { firstName, lastName, email: candidateEmail, phone } = 
            parsedResume.personalInfo || {};

          if (!firstName || !lastName || !candidateEmail) {
            logger.warn(`Incomplete personal info in resume from ${email.from}, skipping`);
            continue;
          }

          // Try to match to a job (you can customize this logic)
          // For now, find the first active job or use email subject/body to determine
          const job = await this.findJobForEmail(email);

          if (!job) {
            logger.warn(`No matching job found for email from ${email.from}, skipping`);
            continue;
          }

          // Check for duplicate application
          const existingApplication = await Application.findOne({
            jobId: job._id,
            email: candidateEmail,
          });

          if (existingApplication) {
            logger.info(`Duplicate application from ${candidateEmail} for job ${job.title}, skipping`);
            continue;
          }

          // Create application
          await Application.create({
            jobId: job._id,
            clientId: job.clientId,
            firstName,
            lastName,
            email: candidateEmail,
            phone: phone || email.from,
            resumeUrl: uploadResult.url,
            resumeOriginalName: attachment.filename,
            videoIntroUrl, // Include video if uploaded
            parsedData: {
              summary: parsedResume.summary,
              skills: parsedResume.skills,
              experience: parsedResume.experience,
              education: parsedResume.education,
              certifications: parsedResume.certifications,
              languages: parsedResume.languages,
            },
            // AI validation results (only for email automation)
            isValidResume: validation.isValid,
            validationScore: validation.score,
            validationReason: validation.reason,
            status: 'pending',
            source: 'email_automation',
            sourceEmail: email.from,
            sourceEmailAccountId: account._id,
            notes: `Auto-imported from email: ${email.subject || 'No subject'}`,
          });

          stats.created++;
          logger.info(`✅ Created application for ${candidateEmail} - Job: ${job.title}`);

          // Mark email as read (optional - implement in IMAP service if needed)
          // await imapService.markAsRead(account, email.uid);

        } catch (error: any) {
          stats.errors++;
          logger.error(`Error processing email from ${email.from}:`, error.message);
        }
      }

      // Update lastChecked timestamp
      account.lastChecked = new Date();
      await account.save();

      logger.info(
        `Account ${account.email} processed - ` +
        `Created: ${stats.created}, Errors: ${stats.errors}`
      );

    } catch (error: any) {
      logger.error(`Failed to process account ${account.email}:`, error.message);
      throw error;
    }

    return stats;
  }

  /**
   * Find a matching job for the email
   * This is a simple implementation - you can enhance with:
   * - Email subject parsing (e.g., "Application for Software Engineer")
   * - Email body analysis
   * - Dedicated email addresses per job (e.g., jobs+software-engineer@company.com)
   */
  private async findJobForEmail(email: any): Promise<any> {
    // Strategy 1: Parse job title from email subject
    if (email.subject) {
      // Common patterns: "Application for [Job Title]", "RE: [Job Title]"
      const patterns = [
        /application for[:\s]+(.+)/i,
        /applying for[:\s]+(.+)/i,
        /re:[:\s]+(.+)/i,
        /job application[:\s]+(.+)/i,
      ];

      for (const pattern of patterns) {
        const match = email.subject.match(pattern);
        if (match) {
          const jobTitle = match[1].trim();
          const job = await Job.findOne({
            title: { $regex: jobTitle, $options: 'i' },
            status: 'active',
          });
          if (job) {
            logger.info(`Matched job from subject: ${job.title}`);
            return job;
          }
        }
      }
    }

    // Strategy 2: Find the most recent active job (fallback)
    const job = await Job.findOne({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(1);

    if (job) {
      logger.info(`Using most recent active job: ${job.title}`);
    }

    return job;
  }

  /**
   * Manually trigger email processing (for testing)
   */
  async triggerManual(): Promise<void> {
    logger.info('📧 Manually triggering email automation...');
    await this.processEmails();
  }
}

// Export singleton instance
export const emailAutomationJob = new EmailAutomationJob();
