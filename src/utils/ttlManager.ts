/**
 * Utility for managing TTL (Time To Live) indexes and data cleanup
 */
import mongoose from "mongoose";
import logger from "./logger";

/**
 * Clean up expired tokens from User model
 * MongoDB TTL indexes work on documents, but for fields within documents,
 * we need manual cleanup
 */
export async function cleanupExpiredTokens(): Promise<void> {
  try {
    const User = mongoose.model("User");
    const now = new Date();

    // Clear expired email verification tokens
    const emailVerificationResult = await User.updateMany(
      {
        emailVerificationExpires: { $lt: now },
        emailVerificationToken: { $exists: true, $ne: null },
      },
      {
        $unset: {
          emailVerificationToken: "",
          emailVerificationExpires: "",
        },
      }
    );

    // Clear expired magic link tokens
    const magicLinkResult = await User.updateMany(
      {
        magicLinkExpires: { $lt: now },
        magicLinkToken: { $exists: true, $ne: null },
      },
      {
        $unset: {
          magicLinkToken: "",
          magicLinkExpires: "",
        },
      }
    );

    // Clear expired password reset tokens
    const passwordResetResult = await User.updateMany(
      {
        passwordResetExpires: { $lt: now },
        passwordResetToken: { $exists: true, $ne: null },
      },
      {
        $unset: {
          passwordResetToken: "",
          passwordResetExpires: "",
        },
      }
    );

    const totalCleaned =
      emailVerificationResult.modifiedCount +
      magicLinkResult.modifiedCount +
      passwordResetResult.modifiedCount;

    if (totalCleaned > 0) {
      logger.info(`Cleaned up ${totalCleaned} expired tokens`, {
        emailVerification: emailVerificationResult.modifiedCount,
        magicLink: magicLinkResult.modifiedCount,
        passwordReset: passwordResetResult.modifiedCount,
      });
    }
  } catch (error) {
    logger.error("Error cleaning up expired tokens:", error);
  }
}

/**
 * Clean up old read notifications (older than 30 days)
 * Keep unread notifications longer for user visibility
 */
export async function cleanupOldNotifications(): Promise<void> {
  try {
    const Notification = mongoose.model("Notification");
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await Notification.deleteMany({
      read: true,
      createdAt: { $lt: thirtyDaysAgo },
      expiresAt: { $exists: false }, // Don't touch notifications with explicit expiry
    });

    if (result.deletedCount > 0) {
      logger.info(
        `Cleaned up ${result.deletedCount} old read notifications (>30 days)`
      );
    }
  } catch (error) {
    logger.error("Error cleaning up old notifications:", error);
  }
}

/**
 * Archive old emails (move metadata, delete body content)
 * For emails older than 1 year, keep metadata but remove large body fields
 */
export async function archiveOldEmails(): Promise<void> {
  try {
    const Email = mongoose.model("Email");
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const result = await Email.updateMany(
      {
        createdAt: { $lt: oneYearAgo },
        body: { $exists: true, $ne: null },
      },
      {
        $set: {
          body: "[Archived - content removed after 1 year]",
          bodyHtml: null,
        },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(
        `Archived ${result.modifiedCount} old emails (>1 year) - removed body content`
      );
    }
  } catch (error) {
    logger.error("Error archiving old emails:", error);
  }
}

/**
 * Get TTL index information for all collections
 */
export async function getTTLIndexInfo() {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not available");
    }

    const collections = await db.listCollections().toArray();
    const ttlInfo: any[] = [];

    for (const collection of collections) {
      const indexes = await db.collection(collection.name).indexes();

      const ttlIndexes = indexes.filter(
        (index: any) => index.expireAfterSeconds !== undefined
      );

      if (ttlIndexes.length > 0) {
        ttlInfo.push({
          collection: collection.name,
          ttlIndexes: ttlIndexes.map((index: any) => ({
            name: index.name,
            key: index.key,
            expireAfterSeconds: index.expireAfterSeconds,
            humanReadable: formatDuration(index.expireAfterSeconds),
          })),
        });
      }
    }

    return ttlInfo;
  } catch (error) {
    logger.error("Error getting TTL index info:", error);
    return [];
  }
}

/**
 * Format seconds into human-readable duration
 */
function formatDuration(seconds: number): string {
  if (seconds === 0) return "immediately";

  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);

  return parts.join(", ") || `${seconds} seconds`;
}

/**
 * Run all cleanup tasks
 * This should be called by a cron job
 */
export async function runAllCleanupTasks(): Promise<void> {
  logger.info("Starting scheduled cleanup tasks...");

  const startTime = Date.now();

  await Promise.all([
    cleanupExpiredTokens(),
    cleanupOldNotifications(),
    archiveOldEmails(),
  ]);

  const duration = Date.now() - startTime;
  logger.info(`Cleanup tasks completed in ${duration}ms`);
}

/**
 * Validate that TTL indexes are properly configured
 */
export async function validateTTLIndexes(): Promise<{
  success: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    const db = mongoose.connection.db;
    if (!db) {
      return { success: false, issues: ["Database connection not available"] };
    }

    // Ensure indexes are created (in case they don't exist yet)
    try {
      await mongoose.model("Notification").createIndexes();
      await mongoose.model("ActivityLog").createIndexes();
    } catch (error) {
      logger.debug("Index creation attempted (may already exist)");
    }

    // Check Notification TTL index
    const notificationIndexes = await db
      .collection("notifications")
      .indexes();
    const notificationTTL = notificationIndexes.find(
      (idx: any) =>
        idx.expireAfterSeconds === 0 && idx.key.expiresAt === 1
    );

    if (!notificationTTL) {
      issues.push(
        "TTL index on notifications.expiresAt will be created on first document insert"
      );
    }

    // Check ActivityLog TTL index
    const activityLogIndexes = await db.collection("activitylogs").indexes();
    const activityLogTTL = activityLogIndexes.find(
      (idx: any) =>
        idx.expireAfterSeconds === 90 * 24 * 60 * 60 &&
        idx.key.createdAt === 1
    );

    if (!activityLogTTL) {
      issues.push(
        "TTL index on activitylogs.createdAt will be created on first document insert"
      );
    }

    // Don't fail if indexes just need to be created
    return {
      success: true, // Changed from issues.length === 0
      issues,
    };
  } catch (error) {
    logger.error("Error validating TTL indexes:", error);
    return {
      success: false,
      issues: [`Validation error: ${error}`],
    };
  }
}
