import app from "./app";
import { config, validateConfig } from "./config";
import { connectDatabase } from "./config/database";
// import emailAutomationJob from "./jobs/emailAutomation.job"; // TODO: Convert to Firestore
// import { scheduleDataCleanup } from "./jobs/dataCleanup.job"; // TODO: Convert to Firestore
// import { seedEmailTemplates } from "./seeds/emailTemplates.seed"; // TODO: Convert to Firestore
import logger from "./utils/logger";

// Validate environment variables
try {
  validateConfig();
} catch (error) {
  logger.error("Configuration validation failed:", error);
  process.exit(1);
}

// Start server
async function startServer() {
  try {
    // Connect to Firestore
    await connectDatabase();

    // TODO: Firestore TTL - implement via TTL policy or Cloud Functions
    // MongoDB TTL indexes are not applicable to Firestore
    // await validateTTLSetup();

    // TODO: Seed email templates using Firestore service
    // await seedEmailTemplates();

    // Start Express server
    const server = app.listen(config.port, () => {
      logger.info(`
╔═══════════════════════════════════════╗
║   ATS Backend Server Started          ║
╠═══════════════════════════════════════╣
║   Environment: ${config.env.padEnd(24)}║
║   Port: ${config.port.toString().padEnd(31)}║
║   API Version: ${config.apiVersion.padEnd(23)}║
║   Firestore: Connected                ║
╚═══════════════════════════════════════╝
      `);
      logger.info(`🚀 Server ready at: http://localhost:${config.port}`);
      logger.info(`📊 Health check: http://localhost:${config.port}/health`);
      logger.info(`📡 API: http://localhost:${config.port}/api`);
    });

    // TODO: Start email automation cron job using Firestore
    // await emailAutomationJob.start();

    // TODO: Schedule data cleanup job using Firestore
    // scheduleDataCleanup();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);

      // TODO: Stop email automation job
      // emailAutomationJob.stop();

      server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
