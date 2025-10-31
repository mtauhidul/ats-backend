import mongoose from "mongoose";
import logger from "../utils/logger";
import { config } from "./index";

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
  } catch (error) {
    logger.error("❌ MongoDB connection error:", error);
    process.exit(1);
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
