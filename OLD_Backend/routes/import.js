// routes/import.js
const express = require("express");
const router = express.Router();
const {
  validateConnection,
  listEmails,
  processEmails,
} = require("../services/emailService");
const { validateApiKey } = require("../middleware/auth");
const logger = require("../utils/logger");

// Apply auth middleware to all routes
router.use(validateApiKey);

/**
 * @route POST /api/email/import/connect
 * @desc Validate and connect to an email provider
 * @access Private
 */
router.post("/connect", async (req, res, next) => {
  try {
    const { provider, server, port, username, password } = req.body;

    if (!provider || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required email account details",
      });
    }

    // Setup connection config
    const connectionConfig = {
      provider,
      server,
      port,
      username,
      password,
    };

    // Validate connection
    await validateConnection(connectionConfig);

    res.status(200).json({
      success: true,
      message: "Connection successful",
    });
  } catch (error) {
    logger.error("Email connection error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to connect to email provider",
    });
  }
});

/**
 * @route POST /api/email/import/list
 * @desc List emails from the connected account
 * @access Private
 */
router.post("/list", async (req, res, next) => {
  try {
    const {
      provider,
      server,
      port,
      username,
      password,
      filters = {},
    } = req.body;

    if (!provider || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required email account details",
      });
    }

    // Setup connection config
    const connectionConfig = {
      provider,
      server,
      port,
      username,
      password,
    };

    // List emails with the provided filters
    const result = await listEmails(connectionConfig, filters);
    logger.info(`Listed ${result.emails.length} emails`);

    res.status(200).json(result);
  } catch (error) {
    logger.error("Email listing error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to list emails",
    });
  }
});

/**
 * @route POST /api/email/import/process
 * @desc Process and import selected emails
 * @access Private
 */
router.post("/process", async (req, res, next) => {
  try {
    const { provider, server, port, username, password, emailIds } = req.body;

    if (!provider || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required email account details",
      });
    }

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No emails selected for processing",
      });
    }

    // Setup connection config
    const connectionConfig = {
      provider,
      server,
      port,
      username,
      password,
    };

    // Process the selected emails
    const result = await processEmails(connectionConfig, emailIds);
    logger.info(
      `Processed ${result.processed} emails, imported ${result.candidates.length} candidates`
    );

    res.status(200).json(result);
  } catch (error) {
    logger.error("Email processing error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to process emails",
    });
  }
});

module.exports = router;
