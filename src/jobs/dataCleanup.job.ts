/**
 * Cron job for data cleanup and TTL management
 * Runs daily to clean up expired tokens, old notifications, and archive old emails
 */
import cron from "node-cron";
import logger from "../utils/logger";
import {
  runAllCleanupTasks,
  getTTLIndexInfo,
  validateTTLIndexes,
} from "../utils/ttlManager";

/**
 * Schedule data cleanup job
 * Runs every day at 2:00 AM
 */
export function scheduleDataCleanup() {
  // Run cleanup daily at 2 AM
  cron.schedule("0 2 * * *", async () => {
    logger.info("⏰ Starting scheduled data cleanup...");

    try {
      await runAllCleanupTasks();
      logger.info("✅ Data cleanup completed successfully");
    } catch (error) {
      logger.error("❌ Error during data cleanup:", error);
    }
  });

  logger.info("📅 Data cleanup job scheduled (daily at 2:00 AM)");
}

/**
 * Validate TTL indexes on startup
 */
export async function validateTTLSetup() {
  try {
    logger.info("🔍 Validating TTL indexes...");

    const validation = await validateTTLIndexes();

    if (validation.success) {
      if (validation.issues.length > 0) {
        logger.info("ℹ️  TTL indexes configured (will be created on first use):");
        validation.issues.forEach((issue) => {
          logger.info(`   - ${issue}`);
        });
      } else {
        logger.info("✅ TTL indexes properly configured and active");
      }

      // Log TTL index information
      const ttlInfo = await getTTLIndexInfo();
      if (ttlInfo.length > 0) {
        logger.info("📋 Active TTL Indexes:");
        ttlInfo.forEach((info) => {
          logger.info(`  - ${info.collection}:`);
          info.ttlIndexes.forEach((idx: any) => {
            logger.info(
              `    * ${idx.name}: expires after ${idx.humanReadable}`
            );
          });
        });
      }
    } else {
      logger.warn("⚠️ TTL index validation issues:", {
        issues: validation.issues,
      });
    }
  } catch (error) {
    logger.error("❌ Error validating TTL setup:", error);
  }
}

/**
 * Run initial cleanup on startup (optional, can be disabled)
 */
export async function runInitialCleanup() {
  try {
    logger.info("🧹 Running initial cleanup...");
    await runAllCleanupTasks();
    logger.info("✅ Initial cleanup completed");
  } catch (error) {
    logger.error("❌ Error during initial cleanup:", error);
  }
}
