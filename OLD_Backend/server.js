// server.js (Updated with resume scoring integration and candidates route)

// Main application entry point
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const { errorHandler } = require("./middleware/errorHandler");
const logger = require("./utils/logger");

// Import the email automation service
const emailAutomationService = require("./services/emailAutomationService");

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy headers when running behind a reverse proxy (like Heroku)
app.set('trust proxy', 1);

// Apply basic security middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// Apply rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later.",
});

// Apply rate limiting to all routes
app.use(apiLimiter);

// Route imports
const notificationRoutes = require("./routes/notifications");
const communicationRoutes = require("./routes/communications");
const enhancedEmailCommunicationRoutes = require("./routes/enhanced-email-communications"); // Enhanced email communications
const emailInboxRoutes = require("./routes/email-inbox"); // Email inbox functionality
const webhookRoutes = require("./routes/webhooks");
const importRoutes = require("./routes/import");
const emailImportRoutes = require("./routes/email-import");
const emailAutomationRoutes = require("./routes/email-automation"); // Automation routes
const candidatesRoutes = require("./routes/candidates"); // Candidates routes
const applicationsRoutes = require("./routes/applications"); // Applications routes
const zoomRoutes = require("./routes/zoom"); // Zoom meeting routes
const resumeParserRoutes = require("./api/parse-resume");
const resumeScoringRoutes = require("./api/score-resume"); // Resume scoring routes
const unifiedResumeParserRoutes = require("./routes/resume-parser"); // Unified resume parser

// Routes
app.use("/api/email/notifications", notificationRoutes);
app.use("/api/email/communications", enhancedEmailCommunicationRoutes); // Use enhanced version for frontend compatibility
app.use("/api/email/communications/legacy", communicationRoutes); // Keep legacy route for backward compatibility
app.use("/api/email/inbox", emailInboxRoutes); // Inbox routes
app.use("/api/email/webhooks", webhookRoutes);
app.use("/api/email/import", importRoutes);
app.use("/api/email/inbox/import", emailImportRoutes); // Move email import to avoid route conflict
app.use("/api/email/automation", emailAutomationRoutes); // Automation routes
app.use("/api/candidates", candidatesRoutes); // Candidates routes
app.use("/api/applications", applicationsRoutes); // Applications routes
app.use("/api/zoom", zoomRoutes); // Zoom meeting routes
app.use("/api/resume", resumeParserRoutes);
app.use("/api/resume", resumeScoringRoutes); // Resume scoring routes
app.use("/api/resume-parser", unifiedResumeParserRoutes); // Unified resume parser endpoint

// Map email routes that are accessed directly at /api/email/
app.post("/api/email/download-attachment", (req, res, next) => {
  // Delegate to the email import routes
  req.url = "/download-attachment";
  emailImportRoutes(req, res, next);
});

app.post("/api/email/parse-attachment", (req, res, next) => {
  // Delegate to the email import routes  
  req.url = "/parse-attachment";
  emailImportRoutes(req, res, next);
});

// Simple health check endpoint
app.get("/health", (req, res) => {
  const automationStatus = emailAutomationService.getStatus();

  res.status(200).json({
    status: "ok",
    automation: {
      isRunning: automationStatus.isRunning,
      activeProcesses: automationStatus.activeProcesses.length,
    },
    timestamp: new Date().toISOString(),
  });
});

// For debugging purposes - to help identify route issues
app.use((req, res, next) => {
  console.log(`404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown handling
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");

  // Stop email automation
  emailAutomationService.stop();

  // Close server
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");

  // Stop email automation
  emailAutomationService.stop();

  // Close server
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

// Start the server
const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  logger.info(`Server started on port ${PORT}`);

  // Start email automation if configured to auto-start
  if (process.env.AUTO_START_EMAIL_AUTOMATION === "true") {
    try {
      logger.info("Auto-starting email automation...");
      await emailAutomationService.start();
      logger.info("Email automation auto-started successfully");
    } catch (error) {
      logger.error("Failed to auto-start email automation:", error);
    }
  } else {
    logger.info(
      "Email automation not auto-started. Use the API or set AUTO_START_EMAIL_AUTOMATION=true"
    );
  }
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Promise Rejection:", err);
  // Don't exit the process for unhandled rejections in production
  if (process.env.NODE_ENV !== "production") {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  // Stop automation and exit
  emailAutomationService.stop();
  process.exit(1);
});

module.exports = server;
