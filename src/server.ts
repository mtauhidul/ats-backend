import app from './app';
import { config, validateConfig } from './config';
import { connectDatabase } from './config/database';
import { emailAutomationJob } from './jobs/emailAutomation.job';
import logger from './utils/logger';

// Validate environment variables
try {
  validateConfig();
} catch (error) {
  logger.error('Configuration validation failed:', error);
  process.exit(1);
}

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Start Express server
    const server = app.listen(config.port, () => {
      logger.info(`
╔═══════════════════════════════════════╗
║   ATS Backend Server Started          ║
╠═══════════════════════════════════════╣
║   Environment: ${config.env.padEnd(24)}║
║   Port: ${config.port.toString().padEnd(31)}║
║   API Version: ${config.apiVersion.padEnd(23)}║
║   MongoDB: Connected                  ║
╚═══════════════════════════════════════╝
      `);
      logger.info(`🚀 Server ready at: http://localhost:${config.port}`);
      logger.info(`📊 Health check: http://localhost:${config.port}/health`);
      logger.info(`📡 API: http://localhost:${config.port}/api`);
    });

    // Start email automation cron job
    emailAutomationJob.start();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);
      
      // Stop email automation job
      emailAutomationJob.stop();
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
