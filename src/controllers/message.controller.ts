import { Request, Response } from "express";
import mongoose from "mongoose";
import { Message } from "../models";
import logger from "../utils/logger";

// Generate conversationId from two user IDs (sorted to ensure consistency)
function generateConversationId(userId1: string, userId2: string): string {
  const ids = [userId1, userId2].sort();
  return `${ids[0]}_${ids[1]}`;
}

/**
 * Get all messages for the authenticated user (organized by conversations)
 */
export const getMessages = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    // Get only internal messages (not email tracking) where user is sender or recipient
    const messages = await Message.find({
      $or: [{ senderId: userId }, { recipientId: userId }],
      conversationId: { $exists: true, $ne: null }, // Only internal messages have conversationId
      emailId: { $exists: false }, // Exclude email tracking records
    })
      .sort({ sentAt: -1 })
      .limit(1000) // Limit to recent messages
      .lean();

    // Transform _id to id for frontend compatibility
    const transformedMessages = messages.map((msg) => {
      // Skip messages without required internal messaging fields
      if (!msg.senderId || !msg.recipientId) {
        return null;
      }
      return {
        ...msg,
        id: msg._id.toString(),
        senderId: msg.senderId.toString(),
        recipientId: msg.recipientId.toString(),
        _id: undefined,
      };
    }).filter(Boolean);

    // Group messages by conversation
    const conversationsMap = new Map();

    transformedMessages.forEach((msg: any) => {
      const conversationId = msg.conversationId;

      if (!conversationsMap.has(conversationId)) {
        // Determine the other participant
        const isCurrentUserSender = msg.senderId === userId;
        const participantId = isCurrentUserSender
          ? msg.recipientId
          : msg.senderId;
        const participantName = isCurrentUserSender
          ? msg.recipientName
          : msg.senderName;
        const participantAvatar = isCurrentUserSender
          ? msg.recipientAvatar
          : msg.senderAvatar;
        const participantRole = isCurrentUserSender
          ? msg.recipientRole
          : msg.senderRole;

        conversationsMap.set(conversationId, {
          id: conversationId,
          participantId,
          participantName,
          participantAvatar,
          participantRole,
          lastMessage: msg.message,
          lastMessageTime: msg.sentAt,
          unreadCount: 0,
          messages: [],
        });
      }

      const conversation = conversationsMap.get(conversationId);
      conversation.messages.push(msg);

      // Count unread messages sent BY current user (not read by other person yet)
      // Badge shows how many of YOUR messages are unread by THEM
      if (msg.senderId === userId && !msg.read) {
        conversation.unreadCount++;
      }
    });

    const conversations = Array.from(conversationsMap.values());

    // Sort messages within each conversation by sentAt ascending (oldest first)
    conversations.forEach(conv => {
      conv.messages.sort((a: any, b: any) =>
        new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      );
    });

    res.status(200).json({
      status: "success",
      data: {
        messages: transformedMessages,
        conversations,
        total: transformedMessages.length,
      },
    });
  } catch (error: any) {
    logger.error("Error fetching messages:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch messages",
      error: error.message,
    });
  }
};

/**
 * Get a single message by ID
 */
export const getMessageById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const message = await Message.findOne({
      _id: id,
      $or: [{ senderId: userId }, { recipientId: userId }],
    }).lean();

    if (!message || !message.senderId || !message.recipientId) {
      res.status(404).json({
        status: "error",
        message: "Message not found",
      });
      return;
    }

    const transformedMessage = {
      ...message,
      id: (message._id as any).toString(),
      senderId: message.senderId.toString(),
      recipientId: message.recipientId.toString(),
      _id: undefined,
    };

    res.status(200).json({
      status: "success",
      data: transformedMessage,
    });
  } catch (error: any) {
    logger.error("Error fetching message:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch message",
      error: error.message,
    });
  }
};

/**
 * Send a new message
 */
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const user = req.user;

    if (!user) {
      res.status(401).json({
        status: "error",
        message: "User not authenticated",
      });
      return;
    }

    const {
      recipientId,
      recipientName,
      recipientRole,
      recipientAvatar,
      message: messageText,
      conversationId,
    } = req.body;

    // Validate required fields
    if (!recipientId || !messageText) {
      res.status(400).json({
        status: "error",
        message: "recipientId and message are required",
      });
      return;
    }

    // Convert string IDs to ObjectId
    const senderObjectId = new mongoose.Types.ObjectId(userId);
    const recipientObjectId = new mongoose.Types.ObjectId(recipientId);

    // Generate or use provided conversationId
    const finalConversationId =
      conversationId || generateConversationId(userId!, recipientId);

    const message = await Message.create({
      conversationId: finalConversationId,
      senderId: senderObjectId,
      senderName: `${user.firstName} ${user.lastName}`.trim() || user.email,
      senderRole: user.role,
      senderAvatar: user.avatar || "",
      recipientId: recipientObjectId,
      recipientName,
      recipientRole,
      recipientAvatar: recipientAvatar || "",
      message: messageText,
      read: false,
      sentAt: new Date(),
    });

    const transformedMessage = {
      ...message.toObject(),
      id: (message._id as any).toString(),
      senderId: message.senderId?.toString() || '',
      recipientId: message.recipientId?.toString() || '',
      _id: undefined,
    };

    logger.info(`Message sent from ${userId} to ${recipientId}`);

    res.status(201).json({
      status: "success",
      data: transformedMessage,
    });
  } catch (error: any) {
    logger.error("Error sending message:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to send message",
      error: error.message,
    });
  }
};

/**
 * Update message (mark as read)
 */
export const updateMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { read } = req.body;

    // Only recipient can mark message as read
    const message = await Message.findOneAndUpdate(
      { _id: id, recipientId: userId },
      { read },
      { new: true }
    ).lean();

    if (!message || !message.senderId || !message.recipientId) {
      res.status(404).json({
        status: "error",
        message: "Message not found or you are not the recipient",
      });
      return;
    }

    const transformedMessage = {
      ...message,
      id: (message._id as any).toString(),
      senderId: message.senderId.toString(),
      recipientId: message.recipientId.toString(),
      _id: undefined,
    };

    res.status(200).json({
      status: "success",
      data: transformedMessage,
    });
  } catch (error: any) {
    logger.error("Error updating message:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update message",
      error: error.message,
    });
  }
};

/**
 * Delete a message
 */
export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Only sender can delete their own messages
    const message = await Message.findOneAndDelete({
      _id: id,
      senderId: userId,
    });

    if (!message) {
      res.status(404).json({
        status: "error",
        message: "Message not found or you are not the sender",
      });
      return;
    }

    res.status(200).json({
      status: "success",
      message: "Message deleted successfully",
    });
  } catch (error: any) {
    logger.error("Error deleting message:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete message",
      error: error.message,
    });
  }
};

/**
 * Get messages in a specific conversation
 */
export const getConversationMessages = async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;

    const messages = await Message.find({
      conversationId,
      $or: [{ senderId: userId }, { recipientId: userId }],
    })
      .sort({ sentAt: 1 })
      .lean();

    const transformedMessages = messages
      .filter((msg) => msg.senderId && msg.recipientId)
      .map((msg) => ({
        ...msg,
        id: (msg._id as any).toString(),
        senderId: msg.senderId!.toString(),
        recipientId: msg.recipientId!.toString(),
        _id: undefined,
      }));

    res.status(200).json({
      status: "success",
      data: {
        messages: transformedMessages,
        total: transformedMessages.length,
      },
    });
  } catch (error: any) {
    logger.error("Error fetching conversation messages:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch conversation messages",
      error: error.message,
    });
  }
};

/**
 * Mark all messages in a conversation as read
 */
export const markConversationAsRead = async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;

    await Message.updateMany(
      {
        conversationId,
        recipientId: userId,
        read: false,
      },
      { read: true }
    );

    res.status(200).json({
      status: "success",
      message: "All messages in conversation marked as read",
    });
  } catch (error: any) {
    logger.error("Error marking conversation as read:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to mark conversation as read",
      error: error.message,
    });
  }
};
