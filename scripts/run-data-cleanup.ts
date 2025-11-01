/**
 * Manual data cleanup script
 * Run with: npm run cleanup:data
 */
import mongoose from "mongoose";
import { config } from "../src/config";
import logger from "../src/utils/logger";
import {
  runAllCleanupTasks,
  getTTLIndexInfo,
  validateTTLIndexes,
} from "../src/utils/ttlManager";

async function runManualCleanup() {
  try {
    // Connect to database
    await mongoose.connect(config.mongodb.uri);
    logger.info("✅ Connected to MongoDB");

    // Validate TTL indexes first
    logger.info("\n" + "=".repeat(60));
    logger.info("VALIDATING TTL INDEXES");
    logger.info("=".repeat(60) + "\n");

    const validation = await validateTTLIndexes();

    if (validation.success) {
      logger.info("✅ All TTL indexes are properly configured\n");
    } else {
      logger.warn("⚠️ TTL index issues found:");
      validation.issues.forEach((issue) => logger.warn(`   - ${issue}`));
      console.log();
    }

    // Show TTL index information
    const ttlInfo = await getTTLIndexInfo();
    if (ttlInfo.length > 0) {
      logger.info("📋 Active TTL Indexes:");
      ttlInfo.forEach((info) => {
        logger.info(`  ${info.collection}:`);
        info.ttlIndexes.forEach((idx: any) => {
          logger.info(
            `    - ${idx.name}: expires after ${idx.humanReadable}`
          );
        });
      });
      console.log();
    }

    // Run cleanup tasks
    logger.info("=".repeat(60));
    logger.info("RUNNING CLEANUP TASKS");
    logger.info("=".repeat(60) + "\n");

    const startTime = Date.now();
    await runAllCleanupTasks();
    const duration = Date.now() - startTime;

    console.log();
    logger.info("=".repeat(60));
    logger.info(`✅ Cleanup completed in ${duration}ms`);
    logger.info("=".repeat(60));

    // Get collection stats
    logger.info("\n📊 Collection Statistics:");
    const collections = [
      "users",
      "notifications",
      "activitylogs",
      "emails",
    ];

    for (const collName of collections) {
      try {
        const db = mongoose.connection.db;
        if (db) {
          const collection = db.collection(collName);
          const count = await collection.countDocuments();

          logger.info(`  ${collName}:`);
          logger.info(`    - Documents: ${count}`);
        }
      } catch (error) {
        logger.warn(`    Could not get stats for ${collName}`);
      }
    }

    console.log();
  } catch (error) {
    logger.error("❌ Error during cleanup:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    logger.info("\nDatabase connection closed");
  }
}

// Run the cleanup
runManualCleanup();
