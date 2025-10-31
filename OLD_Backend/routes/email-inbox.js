// Email inbox retrieval routes
// routes/email-inbox.js
const express = require("express");
const router = express.Router();
const { validateApiKey } = require("../middleware/auth");
const { db } = require("../services/firebaseService");
const logger = require("../utils/logger");

// Apply auth middleware to all routes
router.use(validateApiKey);

/**
 * Retrieve email inbox with threading
 * GET /api/email/inbox/retrieve
 * Returns organized email threads for frontend display
 */
router.get("/retrieve", async (req, res, next) => {
  try {
    logger.info("Retrieving email inbox threads");

    // Get real email threads from Firestore (ordered by last_message_at)
    const threadsSnapshot = await db.collection("email_threads")
      .orderBy("last_message_at", "desc")
      .limit(50)
      .get();

    const threads = [];
    
    for (const threadDoc of threadsSnapshot.docs) {
      const threadData = threadDoc.data();
      
      // Get messages for this thread (without compound query to avoid index requirement)
      const messagesSnapshot = await db.collection("email_messages")
        .where("thread_id", "==", threadDoc.id)
        .get();

      // Sort messages by timestamp manually (to avoid index requirement)
      const messages = messagesSnapshot.docs
        .map(msgDoc => {
          const msgData = msgDoc.data();
          return {
            id: msgDoc.id,
            from: msgData.from_email,
            to: msgData.to_emails,
            cc: msgData.cc_emails || [],
            bcc: msgData.bcc_emails || [],
            subject: msgData.subject,
            body: msgData.body,
            timestamp: msgData.timestamp?.toDate?.()?.toISOString() || msgData.timestamp,
            isRead: msgData.is_read || false,
            direction: msgData.direction,
            sortTimestamp: msgData.timestamp?.toDate?.()?.getTime() || new Date(msgData.timestamp).getTime()
          };
        })
        .sort((a, b) => a.sortTimestamp - b.sortTimestamp) // Sort by timestamp ascending
        .map(msg => {
          // Remove the sorting helper field
          const { sortTimestamp, ...cleanMsg } = msg;
          return cleanMsg;
        });

      // Only include threads that have messages
      if (messages.length > 0) {
        threads.push({
          id: threadDoc.id,
          subject: threadData.subject,
          participants: threadData.participants || [],
          lastMessageAt: threadData.last_message_at?.toDate?.()?.toISOString() || threadData.last_message_at,
          messages: messages
        });
      }
    }

    logger.info(`Retrieved ${threads.length} email threads from database`);

    res.status(200).json({
      success: true,
      threads: threads
    });

  } catch (error) {
    logger.error("Email inbox retrieval error:", error);
    next(error);
  }
});

/**
 * Mark message as read
 * POST /api/email/inbox/mark-read
 * Body: { messageId: string }
 */
router.post("/mark-read", async (req, res, next) => {
  try {
    const { messageId } = req.body;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: messageId"
      });
    }

    await db.collection("email_messages").doc(messageId).update({
      is_read: true,
      read_at: new Date()
    });

    logger.info(`Marked message ${messageId} as read`);

    res.status(200).json({
      success: true,
      message: "Message marked as read"
    });

  } catch (error) {
    logger.error("Mark message as read error:", error);
    next(error);
  }
});

/**
 * Get inbox statistics
 * GET /api/email/inbox/stats
 */
router.get("/stats", async (req, res, next) => {
  try {
    const stats = {
      totalThreads: 0,
      unreadMessages: 0,
      totalMessages: 0
    };

    // Get thread count
    const threadsSnapshot = await db.collection("email_threads").get();
    stats.totalThreads = threadsSnapshot.size;

    // Get message counts
    const messagesSnapshot = await db.collection("email_messages").get();
    stats.totalMessages = messagesSnapshot.size;

    // Get unread count
    const unreadSnapshot = await db.collection("email_messages")
      .where("is_read", "==", false)
      .get();
    stats.unreadMessages = unreadSnapshot.size;

    res.status(200).json({
      success: true,
      stats: stats
    });

  } catch (error) {
    logger.error("Inbox stats error:", error);
    next(error);
  }
});

module.exports = router;