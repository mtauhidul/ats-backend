const logger = require("../utils/logger");
const {
  listEmails,
  processEmails,
  validateConnection,
  isJobRelatedEmail,
} = require("./emailService");
const {
  getStoredEmailAccounts,
  updateAccountLastChecked,
  checkApplicationExists,
  addApplicationFromEmail,
} = require("./firebaseService");
const { decrypt } = require("./cryptoService");

// Configuration from environment variables
const config = {
  autoStart: process.env.AUTO_START_EMAIL_AUTOMATION === "true",
  checkInterval: parseInt(process.env.EMAIL_CHECK_INTERVAL_MINUTES) || 30,
  maxConsecutiveEmpty: parseInt(process.env.MAX_CONSECUTIVE_EMPTY_CHECKS) || 3,
  maxEmailsPerCheck: parseInt(process.env.MAX_EMAILS_PER_CHECK) || 20,
};

class EmailAutomationService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkIntervalMinutes = config.checkInterval;
    this.maxEmailsPerCheck = config.maxEmailsPerCheck;
    this.processingQueue = new Map();
    this.lastCheckTimes = new Map();

    // Enhanced counters using env config
    this.consecutiveEmptyChecks = 0;
    this.maxConsecutiveEmptyChecks = config.maxConsecutiveEmpty;
    this.lastActiveAccountCheck = new Date();
    this.accountCheckInterval =
      parseInt(process.env.ACCOUNT_MONITORING_INTERVAL_MINUTES) * 60 * 1000 ||
      5 * 60 * 1000; // Check for new accounts every 5 minutes when stopped
  }

  /**
   * Enhanced start method with smart checking
   */
  async start() {
    if (this.isRunning) {
      logger.warn("Email automation is already running");
      return;
    }

    // Check if there are any accounts to monitor before starting
    const hasActiveAccounts = await this.hasActiveAutomationAccounts();
    if (!hasActiveAccounts) {
      logger.info(
        "No active automation accounts found. Starting in monitoring mode..."
      );
      this.startAccountMonitoring();
      return;
    }

    logger.info(
      `Starting email automation service - checking every ${this.checkIntervalMinutes} minutes`
    );
    this.isRunning = true;
    this.consecutiveEmptyChecks = 0;

    // Run initial check
    await this.checkAllAccounts();

    // Set up recurring checks
    this.intervalId = setInterval(async () => {
      await this.checkAllAccounts();
    }, this.checkIntervalMinutes * 60 * 1000);
  }

  /**
   * Enhanced stop method
   */
  stop() {
    if (!this.isRunning) {
      logger.warn("Email automation is not running");
      return;
    }

    logger.info("Stopping email automation service");
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.processingQueue.clear();
    this.consecutiveEmptyChecks = 0;
  }

  /**
   * NEW: Start monitoring for new automation accounts when service is stopped
   */
  startAccountMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    logger.info(
      `Starting account monitoring mode - checking for new automation accounts every ${
        this.accountCheckInterval / 60000
      } minutes`
    );

    this.intervalId = setInterval(async () => {
      try {
        const hasActiveAccounts = await this.hasActiveAutomationAccounts();
        if (hasActiveAccounts) {
          logger.info(
            "Active automation accounts detected. Starting full automation service..."
          );
          clearInterval(this.intervalId);
          this.intervalId = null;
          await this.start(); // Restart full automation
        } else {
          logger.debug(
            "No active automation accounts found. Continuing to monitor..."
          );
        }
      } catch (error) {
        logger.error("Error during account monitoring:", error);
      }
    }, this.accountCheckInterval);
  }

  /**
   * NEW: Check if there are any active automation accounts
   */
  async hasActiveAutomationAccounts() {
    try {
      const emailAccounts = await getStoredEmailAccounts({
        automationEnabled: true,
      });

      const activeAccounts =
        emailAccounts?.filter(
          (account) => account.automationEnabled && account.isActive !== false
        ) || [];

      logger.debug(`Found ${activeAccounts.length} active automation accounts`);
      return activeAccounts.length > 0;
    } catch (error) {
      logger.error("Error checking for active automation accounts:", error);
      return false;
    }
  }

  /**
   * Enhanced checkAllAccounts with smart stopping
   */
  async checkAllAccounts() {
    try {
      logger.info("Starting automated email check cycle");

      // Get all stored email accounts that have automation enabled
      const emailAccounts = await getStoredEmailAccounts({
        automationEnabled: true,
      });

      if (!emailAccounts || emailAccounts.length === 0) {
        this.consecutiveEmptyChecks++;
        logger.info(
          `No email accounts configured for automation (${this.consecutiveEmptyChecks}/${this.maxConsecutiveEmptyChecks} consecutive empty checks)`
        );

        // SMART STOP: If we've had too many consecutive empty checks, stop the service
        if (this.consecutiveEmptyChecks >= this.maxConsecutiveEmptyChecks) {
          logger.info(
            `Stopping automation service after ${this.maxConsecutiveEmptyChecks} consecutive empty checks. Will monitor for new accounts.`
          );
          this.stop();
          this.startAccountMonitoring();
        }
        return;
      }

      // Reset counter if we found accounts
      this.consecutiveEmptyChecks = 0;
      logger.info(`Found ${emailAccounts.length} email accounts to check`);

      // Process each account
      const results = await Promise.allSettled(
        emailAccounts.map((account) => this.checkEmailAccount(account))
      );

      // Log results
      let successCount = 0;
      let errorCount = 0;

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          errorCount++;
          logger.error(
            `Failed to check account ${emailAccounts[index].id}:`,
            result.reason
          );
        }
      });

      logger.info(
        `Email check cycle completed - Success: ${successCount}, Errors: ${errorCount}`
      );
    } catch (error) {
      logger.error("Error in automated email check cycle:", error);
    }
  }

  /**
   * Enhanced checkEmailAccount method (existing implementation)
   */
  async checkEmailAccount(account) {
    const accountId = account.id;
    const accountEmail = account.username;

    // Skip if already processing this account
    if (this.processingQueue.has(accountId)) {
      logger.info(`Skipping account ${accountEmail} - already being processed`);
      return;
    }

    try {
      // Mark as processing
      this.processingQueue.set(accountId, {
        startTime: new Date(),
        status: "checking",
      });

      logger.info(`Checking email account: ${accountEmail}`);

      // Decrypt password if it's encrypted
      let decryptedPassword = account.password;
      if (account.encrypted && typeof account.password === 'object') {
        try {
          decryptedPassword = decrypt(account.password);
          logger.info(`Decrypted password for account: ${accountEmail}`);
        } catch (error) {
          logger.error(`Failed to decrypt password for ${accountEmail}:`, error);
          throw new Error('Failed to decrypt email account password');
        }
      }

      // Validate connection first
      const connectionConfig = {
        provider: account.provider,
        server: account.server,
        port: account.port,
        username: account.username,
        password: decryptedPassword,
      };

      await validateConnection(connectionConfig);

      // Calculate time range for new emails (extended to 30 days)
      const lastChecked =
        account.lastChecked || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const checkSince = new Date(
        Math.max(lastChecked.getTime(), Date.now() - 30 * 24 * 60 * 60 * 1000)
      );

      // List emails with filters for automation
      const emailFilters = {
        dateFilter: "custom",
        since: checkSince.toISOString().split("T")[0],
        withAttachments: true,
        jobRelated: true,
        maxResults: this.maxEmailsPerCheck,
      };

      const emailResult = await listEmails(connectionConfig, emailFilters);
      const emails = emailResult.emails || [];

      logger.info(
        `Found ${emails.length} potential candidate emails for ${accountEmail}`
      );

      if (emails.length === 0) {
        await updateAccountLastChecked(accountId, new Date());
        return { processed: 0, imported: 0, errors: 0 };
      }

      // Filter emails that haven't been processed yet
      const newEmails = await this.filterNewEmails(emails);

      if (newEmails.length === 0) {
        logger.info(`No new candidate emails found for ${accountEmail}`);
        await updateAccountLastChecked(accountId, new Date());
        return { processed: 0, imported: 0, errors: 0 };
      }

      logger.info(
        `Processing ${newEmails.length} new candidate emails for ${accountEmail}`
      );

      // Update processing status
      this.processingQueue.set(accountId, {
        startTime: new Date(),
        status: "processing",
        totalEmails: newEmails.length,
        processedEmails: 0,
      });

      // Process emails in batches using env config
      const batchSize = parseInt(process.env.EMAIL_BATCH_SIZE) || 5;
      let totalProcessed = 0;
      let totalImported = 0;
      let totalErrors = 0;

      for (let i = 0; i < newEmails.length; i += batchSize) {
        const batch = newEmails.slice(i, i + batchSize);
        const batchResults = await this.processBatch(
          connectionConfig,
          batch,
          accountId
        );

        totalProcessed += batchResults.processed;
        totalImported += batchResults.imported;
        totalErrors += batchResults.errors;

        // Update progress
        this.processingQueue.set(accountId, {
          startTime: new Date(),
          status: "processing",
          totalEmails: newEmails.length,
          processedEmails: totalProcessed,
        });

        // Add small delay between batches
        if (i + batchSize < newEmails.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // Update last checked time
      await updateAccountLastChecked(accountId, new Date());

      logger.info(
        `Completed processing for ${accountEmail}: ${totalImported} candidates imported, ${totalErrors} errors`
      );

      return {
        processed: totalProcessed,
        imported: totalImported,
        errors: totalErrors,
      };
    } catch (error) {
      logger.error(`Error processing email account ${accountEmail}:`, error);
      throw error;
    } finally {
      // Remove from processing queue
      this.processingQueue.delete(accountId);
    }
  }

  /**
   * Enhanced filterNewEmails method (updated for applications workflow)
   */
  async filterNewEmails(emails) {
    const newEmails = [];

    for (const email of emails) {
      try {
        const exists = await checkApplicationExists(email.from.email);

        if (!exists) {
          if (this.isLikelyJobApplication(email)) {
            newEmails.push(email);
          }
        }
      } catch (error) {
        logger.warn(
          `Error checking if application exists for ${email.from.email}:`,
          error
        );
        newEmails.push(email);
      }
    }

    return newEmails;
  }

  /**
   * Enhanced isLikelyJobApplication method (existing implementation)
   */
  isLikelyJobApplication(email) {
    if (!isJobRelatedEmail(email.subject)) {
      return false;
    }

    if (!email.hasAttachments || !email.attachments) {
      return false;
    }

    const hasResumeAttachment = email.attachments.some(
      (att) => att.isResume || /\.(pdf|doc|docx|txt)$/i.test(att.name)
    );

    return hasResumeAttachment;
  }

  /**
   * Enhanced processBatch method with timeout from env
   */
  async processBatch(connectionConfig, emails, accountId) {
    let processed = 0;
    let imported = 0;
    let errors = 0;

    const processingTimeout =
      parseInt(process.env.EMAIL_PROCESSING_TIMEOUT) * 1000 || 300000; // Convert to milliseconds

    for (const email of emails) {
      try {
        processed++;

        // Add timeout wrapper
        const result = await Promise.race([
          processEmails(connectionConfig, [email.uid]),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Processing timeout")),
              processingTimeout
            )
          ),
        ]);

        if (result.candidates && result.candidates.length > 0) {
          imported += result.candidates.length;
          logger.info(
            `Successfully imported candidate from email: ${email.from.email}`
          );
        }
      } catch (error) {
        errors++;
        logger.error(
          `Failed to process email from ${email.from.email}:`,
          error
        );
        continue;
      }
    }

    return { processed, imported, errors };
  }

  /**
   * Enhanced getStatus method
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkIntervalMinutes,
      consecutiveEmptyChecks: this.consecutiveEmptyChecks,
      maxConsecutiveEmptyChecks: this.maxConsecutiveEmptyChecks,
      config: config, // Include current config
      activeProcesses: Array.from(this.processingQueue.entries()).map(
        ([accountId, info]) => ({
          accountId,
          ...info,
        })
      ),
      lastChecks: Array.from(this.lastCheckTimes.entries()).map(
        ([accountId, time]) => ({
          accountId,
          lastCheck: time,
        })
      ),
    };
  }

  /**
   * Enhanced updateSettings method
   */
  updateSettings(settings) {
    if (settings.checkIntervalMinutes && settings.checkIntervalMinutes >= 5) {
      this.checkIntervalMinutes = settings.checkIntervalMinutes;

      if (this.isRunning) {
        this.stop();
        this.start();
      }
    }

    if (settings.maxEmailsPerCheck && settings.maxEmailsPerCheck > 0) {
      this.maxEmailsPerCheck = settings.maxEmailsPerCheck;
    }

    if (
      settings.maxConsecutiveEmptyChecks &&
      settings.maxConsecutiveEmptyChecks > 0
    ) {
      this.maxConsecutiveEmptyChecks = settings.maxConsecutiveEmptyChecks;
    }
  }

  /**
   * NEW: Force restart automation (useful for when accounts are re-enabled)
   */
  async forceRestart() {
    logger.info("Force restarting automation service...");
    this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    await this.start();
  }

  /**
   * Enhanced forceCheckAccount method (existing implementation)
   */
  async forceCheckAccount(accountId) {
    try {
      const accounts = await getStoredEmailAccounts({ id: accountId });

      if (!accounts || accounts.length === 0) {
        throw new Error(`Account ${accountId} not found`);
      }

      const account = accounts[0];
      return await this.checkEmailAccount(account);
    } catch (error) {
      logger.error(`Error in force check for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * NEW: Manual method to trigger account monitoring check
   */
  async checkForNewAccounts() {
    const hasActiveAccounts = await this.hasActiveAutomationAccounts();
    if (hasActiveAccounts && !this.isRunning) {
      logger.info(
        "Active accounts detected during manual check. Starting automation..."
      );
      await this.start();
      return true;
    }
    return false;
  }

  /**
   * NEW: Initialize automation service with auto-start check
   */
  async initialize() {
    logger.info(`Initializing email automation service with config:`, {
      autoStart: config.autoStart,
      checkInterval: config.checkInterval,
      maxConsecutiveEmpty: config.maxConsecutiveEmpty,
      maxEmailsPerCheck: config.maxEmailsPerCheck,
    });

    if (config.autoStart) {
      logger.info("Auto-start enabled - checking for active accounts...");
      const hasActiveAccounts = await this.hasActiveAutomationAccounts();

      if (hasActiveAccounts) {
        logger.info("Active automation accounts found - starting service...");
        await this.start();
      } else {
        logger.info(
          "No active automation accounts - starting monitoring mode..."
        );
        this.startAccountMonitoring();
      }
    } else {
      logger.info("Auto-start disabled - service ready for manual start");
    }
  }
}

// Create singleton instance
const emailAutomationService = new EmailAutomationService();

module.exports = emailAutomationService;
