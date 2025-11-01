import mongoose from "mongoose";
import logger from "../utils/logger";
import { config } from "./index";
import { configureGlobalQueryTimeout } from "../middleware/queryTimeout";

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.mongodb.uri, {
      // Connection pool settings for better performance
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      // Retry settings
      retryWrites: true,
      retryReads: true,
      // Compression
      compressors: ['zlib'],
    });
    logger.info("✅ MongoDB connected successfully");

    // Enable query profiling in development and staging
    if (config.env === 'development' || config.env === 'staging') {
      await enableQueryProfiling();
    }

    // Configure global query timeout (5 seconds)
    configureGlobalQueryTimeout(5000);
  } catch (error) {
    logger.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}

/**
 * Enable MongoDB query profiling for performance monitoring
 */
async function enableQueryProfiling(): Promise<void> {
  try {
    // Enable Mongoose debug mode to log all queries
    mongoose.set('debug', (collectionName: string, method: string, query: any, doc: any) => {
      const queryInfo = {
        collection: collectionName,
        method: method,
        query: JSON.stringify(query),
        doc: doc ? JSON.stringify(doc).substring(0, 100) : undefined,
      };
      logger.debug('Mongoose Query', queryInfo);
    });

    // Set MongoDB profiler to log slow queries (> 100ms)
    if (mongoose.connection.db) {
      // Use command directly to set profiling with slowms option
      await mongoose.connection.db.command({
        profile: 1,
        slowms: 100,
      });
      logger.info("✅ MongoDB query profiling enabled (slow queries > 100ms)");
    }
  } catch (error) {
    logger.warn("⚠️ Could not enable query profiling:", error);
  }
}

// Mongoose connection events
mongoose.connection.on("connected", () => {
  logger.info("Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  logger.error("Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  logger.warn("Mongoose disconnected from MongoDB");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  logger.info("Mongoose connection closed due to app termination");
  process.exit(0);
});
