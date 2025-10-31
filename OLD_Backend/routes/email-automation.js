// routes/email-automation.js - Enhanced with smart automation controls

const express = require("express");
const router = express.Router();
const { validateApiKey } = require("../middleware/auth");
const { 
  validate, 
  createEmailAccountSchema,
  sendEmailSchema 
} = require("../middleware/validation");
const logger = require("../utils/logger");
const emailAutomationService = require("../services/emailAutomationService");
const {
  storeEmailAccount,
  getStoredEmailAccounts,
  updateEmailAccount,
  deleteEmailAccount,
  getAutomationLogs,
  getAutomationStats,
} = require("../services/firebaseService");

// Apply auth middleware to all routes
router.use(validateApiKey);

/**
 * @route GET /api/email/automation/status
 * @desc Get automation service status with enhanced info
 * @access Private
 */
router.get("/status", async (req, res) => {
  try {
    const status = emailAutomationService.getStatus();
    const stats = await getAutomationStats();

    res.json({
      success: true,
      data: {
        ...status,
        stats,
        // Add smart automation info
        smartMode: {
          consecutiveEmptyChecks: status.consecutiveEmptyChecks,
          maxConsecutiveEmptyChecks: status.maxConsecutiveEmptyChecks,
          willAutoStop:
            status.consecutiveEmptyChecks >=
            status.maxConsecutiveEmptyChecks - 1,
        },
      },
    });
  } catch (error) {
    logger.error("Error getting automation status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get automation status",
    });
  }
});

/**
 * @route POST /api/email/automation/start
 * @desc Start the automation service
 * @access Private
 */
router.post("/start", async (req, res) => {
  try {
    await emailAutomationService.start();

    res.json({
      success: true,
      message: "Email automation started successfully",
    });
  } catch (error) {
    logger.error("Error starting automation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start automation service",
    });
  }
});

/**
 * @route POST /api/email/automation/stop
 * @desc Stop the automation service
 * @access Private
 */
router.post("/stop", async (req, res) => {
  try {
    const { monitoring = true } = req.body; // Default to enable monitoring after stop

    emailAutomationService.stop();

    // If monitoring is disabled, don't start account monitoring
    if (!monitoring) {
      logger.info("Automation stopped without monitoring mode");
    } else {
      // Check if there are any active accounts and start monitoring if needed
      const hasActiveAccounts = await emailAutomationService.hasActiveAutomationAccounts();
      if (hasActiveAccounts) {
        logger.info("Active accounts found - starting monitoring mode");
        emailAutomationService.startAccountMonitoring();
      }
    }

    res.json({
      success: true,
      message: monitoring 
        ? "Email automation stopped successfully (monitoring mode enabled)"
        : "Email automation stopped completely",
    });
  } catch (error) {
    logger.error("Error stopping automation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to stop automation service",
    });
  }
});

/**
 * NEW: @route POST /api/email/automation/restart
 * @desc Force restart the automation service
 * @access Private
 */
router.post("/restart", async (req, res) => {
  try {
    await emailAutomationService.forceRestart();

    res.json({
      success: true,
      message: "Email automation restarted successfully",
    });
  } catch (error) {
    logger.error("Error restarting automation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to restart automation service",
    });
  }
});

/**
 * NEW: @route POST /api/email/automation/check-accounts
 * @desc Check for new automation accounts and start if found
 * @access Private
 */
router.post("/check-accounts", async (req, res) => {
  try {
    const started = await emailAutomationService.checkForNewAccounts();

    res.json({
      success: true,
      message: started
        ? "Active automation accounts found - automation started"
        : "No active automation accounts found",
      automationStarted: started,
    });
  } catch (error) {
    logger.error("Error checking for new accounts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check for automation accounts",
    });
  }
});

/**
 * ENHANCED: @route PUT /api/email/automation/settings
 * @desc Update automation settings including smart stop settings
 * @access Private
 */
router.put("/settings", async (req, res) => {
  try {
    const {
      checkIntervalMinutes,
      maxEmailsPerCheck,
      maxConsecutiveEmptyChecks,
    } = req.body;

    // Validate settings
    if (
      checkIntervalMinutes &&
      (checkIntervalMinutes < 5 || checkIntervalMinutes > 1440)
    ) {
      return res.status(400).json({
        success: false,
        error: "Check interval must be between 5 and 1440 minutes",
      });
    }

    if (
      maxEmailsPerCheck &&
      (maxEmailsPerCheck < 1 || maxEmailsPerCheck > 100)
    ) {
      return res.status(400).json({
        success: false,
        error: "Max emails per check must be between 1 and 100",
      });
    }

    if (
      maxConsecutiveEmptyChecks &&
      (maxConsecutiveEmptyChecks < 1 || maxConsecutiveEmptyChecks > 50)
    ) {
      return res.status(400).json({
        success: false,
        error: "Max consecutive empty checks must be between 1 and 50",
      });
    }

    emailAutomationService.updateSettings({
      checkIntervalMinutes,
      maxEmailsPerCheck,
      maxConsecutiveEmptyChecks,
    });

    res.json({
      success: true,
      message: "Automation settings updated successfully",
    });
  } catch (error) {
    logger.error("Error updating automation settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update automation settings",
    });
  }
});

/**
 * @route GET /api/email/automation/accounts
 * @desc Get all stored email accounts
 * @access Private
 */
router.get("/accounts", async (req, res) => {
  try {
    const accounts = await getStoredEmailAccounts();

    // Remove sensitive data before sending
    const safeAccounts = accounts.map((account) => ({
      id: account.id,
      provider: account.provider,
      username: account.username,
      server: account.server,
      port: account.port,
      automationEnabled: account.automationEnabled,
      isActive: account.isActive,
      lastChecked: account.lastChecked,
      totalProcessed: account.totalProcessed,
      totalImported: account.totalImported,
      lastError: account.lastError,
      createdAt: account.createdAt,
    }));

    res.json({
      success: true,
      data: safeAccounts,
    });
  } catch (error) {
    logger.error("Error getting email accounts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get email accounts",
    });
  }
});

/**
 * ENHANCED: @route POST /api/email/automation/accounts
 * @desc Add a new email account for automation with smart restart
 * @access Private
 */
router.post("/accounts", validate(createEmailAccountSchema), async (req, res) => {
  try {
    const { 
      email,
      password, 
      imapHost, 
      imapPort, 
      imapSecure = true,
      smtpHost,
      smtpPort,
      smtpSecure,
      name,
      folder = 'INBOX',
      autoProcess = true,
      filters
    } = req.body;

    // Validate connection before storing
    const { validateConnection } = require("../services/emailService");

    const connectionConfig = {
      host: imapHost,
      port: imapPort,
      secure: imapSecure,
      username: email,
      password,
    };

    await validateConnection(connectionConfig);

    // Store the account (password will be encrypted in storeEmailAccount)
    const account = await storeEmailAccount({
      email,
      password, // Will be encrypted before storage
      imapHost,
      imapPort,
      imapSecure,
      smtpHost,
      smtpPort,
      smtpSecure,
      name: name || email,
      folder,
      automationEnabled: autoProcess,
      filters: filters || {}
    });

    // If automation is enabled for this account and automation service isn't running,
    // check if we should start it
    if (autoProcess) {
      try {
        const status = emailAutomationService.getStatus();
        if (!status.isRunning) {
          logger.info(
            "New automation account added - checking if automation should start"
          );
          await emailAutomationService.checkForNewAccounts();
        }
      } catch (error) {
        logger.warn(
          "Error checking for automation restart after account creation:",
          error
        );
      }
    }

    // Remove password from response
    const { password: _, ...safeAccount } = account;

    res.json({
      success: true,
      data: safeAccount,
      message: "Email account added successfully",
    });
  } catch (error) {
    logger.error("Error adding email account:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to add email account",
    });
  }
});

/**
 * ENHANCED: @route PUT /api/email/automation/accounts/:id
 * @desc Update an email account with smart automation management
 * @access Private
 */
router.put("/accounts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates.id;
    delete updates.createdAt;
    delete updates.totalProcessed;
    delete updates.totalImported;

    // Store the previous automation state
    const accounts = await getStoredEmailAccounts({ id });
    const previousAccount = accounts[0];
    const wasAutomationEnabled = previousAccount?.automationEnabled;

    await updateEmailAccount(id, updates);

    // Handle automation state changes
    if ("automationEnabled" in updates) {
      try {
        const status = emailAutomationService.getStatus();

        if (updates.automationEnabled && !status.isRunning) {
          // Automation was enabled - check if we should start the service
          logger.info(
            "Automation enabled for account - checking if service should start"
          );
          await emailAutomationService.checkForNewAccounts();
        } else if (!updates.automationEnabled && wasAutomationEnabled) {
          // Automation was disabled - check if we should stop the service
          logger.info(
            "Automation disabled for account - checking if service should stop"
          );
          const hasActiveAccounts =
            await emailAutomationService.hasActiveAutomationAccounts();
          if (!hasActiveAccounts && status.isRunning) {
            logger.info(
              "No more active automation accounts - stopping service"
            );
            emailAutomationService.stop();
            // Start account monitoring mode
            emailAutomationService.startAccountMonitoring();
          }
        }
      } catch (error) {
        logger.warn(
          "Error managing automation state after account update:",
          error
        );
      }
    }

    res.json({
      success: true,
      message: "Email account updated successfully",
    });
  } catch (error) {
    logger.error("Error updating email account:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update email account",
    });
  }
});

/**
 * ENHANCED: @route DELETE /api/email/automation/accounts/:id
 * @desc Delete an email account with smart automation management
 * @access Private
 */
router.delete("/accounts/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get account info before deletion
    const accounts = await getStoredEmailAccounts({ id });
    const accountToDelete = accounts[0];
    const wasAutomationEnabled = accountToDelete?.automationEnabled;

    await deleteEmailAccount(id);

    // If this was an automation account, check if we should stop the service
    if (wasAutomationEnabled) {
      try {
        const hasActiveAccounts =
          await emailAutomationService.hasActiveAutomationAccounts();
        const status = emailAutomationService.getStatus();

        if (!hasActiveAccounts && status.isRunning) {
          logger.info("Last automation account deleted - stopping service");
          emailAutomationService.stop();
          // Start account monitoring mode
          emailAutomationService.startAccountMonitoring();
        }
      } catch (error) {
        logger.warn(
          "Error managing automation state after account deletion:",
          error
        );
      }
    }

    res.json({
      success: true,
      message: "Email account deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting email account:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete email account",
    });
  }
});

/**
 * @route POST /api/email/automation/accounts/:id/check
 * @desc Force check a specific email account
 * @access Private
 */
router.post("/accounts/:id/check", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await emailAutomationService.forceCheckAccount(id);

    res.json({
      success: true,
      data: result,
      message: "Email account checked successfully",
    });
  } catch (error) {
    logger.error("Error force checking email account:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to check email account",
    });
  }
});

/**
 * @route GET /api/email/automation/logs
 * @desc Get automation logs
 * @access Private
 */
router.get("/logs", async (req, res) => {
  try {
    const { accountId, type, limit = 50, startAfter } = req.query;

    const options = {
      accountId,
      type,
      limit: parseInt(limit),
      startAfter,
    };

    const result = await getAutomationLogs(options);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("Error getting automation logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get automation logs",
    });
  }
});

/**
 * @route GET /api/email/automation/stats
 * @desc Get automation statistics
 * @access Private
 */
router.get("/stats", async (req, res) => {
  try {
    const { accountId } = req.query;

    const stats = await getAutomationStats(accountId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error getting automation stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get automation stats",
    });
  }
});

/**
 * @route POST /api/email/automation/check-all
 * @desc Force check all email accounts
 * @access Private
 */
router.post("/check-all", async (req, res) => {
  try {
    // Don't wait for completion, just trigger the check
    emailAutomationService.checkAllAccounts().catch((error) => {
      logger.error("Error in forced check all accounts:", error);
    });

    res.json({
      success: true,
      message: "Check initiated for all accounts",
    });
  } catch (error) {
    logger.error("Error initiating check all accounts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initiate account checks",
    });
  }
});

/**
 * NEW: @route GET /api/email/automation/health
 * @desc Get automation service health check
 * @access Private
 */
router.get("/health", async (req, res) => {
  try {
    const status = emailAutomationService.getStatus();
    const hasActiveAccounts =
      await emailAutomationService.hasActiveAutomationAccounts();

    const health = {
      status: status.isRunning ? "running" : "stopped",
      healthy: true,
      activeAccounts: hasActiveAccounts,
      consecutiveEmptyChecks: status.consecutiveEmptyChecks,
      maxConsecutiveEmptyChecks: status.maxConsecutiveEmptyChecks,
      nearAutoStop:
        status.consecutiveEmptyChecks >= status.maxConsecutiveEmptyChecks - 1,
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    logger.error("Error getting automation health:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get automation health",
      data: {
        status: "error",
        healthy: false,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * NEW: @route POST /api/email/automation/force-stop-monitoring
 * @desc Force stop account monitoring mode (emergency stop)
 * @access Private
 */
router.post("/force-stop-monitoring", async (req, res) => {
  try {
    // This will stop both running automation and monitoring mode
    emailAutomationService.stop();

    // Clear any intervals to ensure monitoring stops
    if (emailAutomationService.intervalId) {
      clearInterval(emailAutomationService.intervalId);
      emailAutomationService.intervalId = null;
    }

    // Clear the processing queue
    emailAutomationService.processingQueue.clear();

    // Reset running state
    emailAutomationService.isRunning = false;

    logger.info("All automation and monitoring forcefully stopped");

    res.json({
      success: true,
      message: "All automation and monitoring stopped",
    });
  } catch (error) {
    logger.error("Error force stopping monitoring:", error);
    res.status(500).json({
      success: false,
      error: "Failed to force stop monitoring",
    });
  }
});

module.exports = router;
