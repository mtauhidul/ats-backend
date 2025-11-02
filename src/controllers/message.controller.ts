import { Request, Response } from "express";
import { messageService } from "../services/firestore";
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

    // Get all messages
    const allMessages = await messageService.find([]);
    
    // Filter messages where user is sender or recipient, with conversationId, and without emailId
    const messages = allMessages.filter((msg: any) => 
      (msg.senderId === userId || msg.recipientId === userId) &&
      msg.conversationId && // Only internal messages have conversationId
      !msg.emailId // Exclude email tracking records
    );

    // Sort by sentAt descending
    messages.sort((a: any, b: any) => 
      new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );

    // Limit to recent messages
    const recentMessages = messages.slice(0, 1000);

    // Transform messages
    const transformedMessages = recentMessages.map((msg: any) => {
      // Skip messages without required internal messaging fields
      if (!msg.senderId || !msg.recipientId) {
        return null;
      }
      return {
        ...msg,
        senderId: msg.senderId.toString(),
        recipientId: msg.recipientId.toString(),
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

    const message = await messageService.findById(id);

    if (!message || !message.senderId || !message.recipientId ||
        (message.senderId !== userId && message.recipientId !== userId)) {
      res.status(404).json({
        status: "error",
        message: "Message not found",
      });
      return;
    }

    const transformedMessage = {
      ...message,
      senderId: message.senderId.toString(),
      recipientId: message.recipientId.toString(),
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

    // Generate or use provided conversationId
    const finalConversationId =
      conversationId || generateConversationId(userId!, recipientId);

    const messageId = await messageService.create({
      conversationId: finalConversationId,
      senderId: userId!,
      senderName: `${user.firstName} ${user.lastName}`.trim() || user.email,
      senderRole: user.role,
      senderAvatar: user.avatar || "",
      recipientId,
      recipientName,
      recipientRole,
      recipientAvatar: recipientAvatar || "",
      message: messageText,
      read: false,
      sentAt: new Date(),
    } as any);

    const message = await messageService.findById(messageId);

    const transformedMessage = {
      ...message,
      senderId: message!.senderId?.toString() || '',
      recipientId: message!.recipientId?.toString() || '',
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

    // Check if message exists and user is the recipient
    const message = await messageService.findById(id);

    if (!message || !message.senderId || !message.recipientId || 
        message.recipientId !== userId) {
      res.status(404).json({
        status: "error",
        message: "Message not found or you are not the recipient",
      });
      return;
    }

    // Update message
    await messageService.update(id, { read } as any);
    const updatedMessage = await messageService.findById(id);

    const transformedMessage = {
      ...updatedMessage,
      senderId: updatedMessage!.senderId!.toString(),
      recipientId: updatedMessage!.recipientId!.toString(),
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

    // Check if message exists and user is the sender
    const message = await messageService.findById(id);

    if (!message || message.senderId !== userId) {
      res.status(404).json({
        status: "error",
        message: "Message not found or you are not the sender",
      });
      return;
    }

    // Delete the message
    await messageService.delete(id);

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

    // Get all messages
    const allMessages = await messageService.find([]);
    
    // Filter by conversationId and user participation
    let messages = allMessages.filter((msg: any) =>
      msg.conversationId === conversationId &&
      (msg.senderId === userId || msg.recipientId === userId)
    );

    // Sort by sentAt ascending
    messages.sort((a: any, b: any) => 
      new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
    );

    const transformedMessages = messages
      .filter((msg: any) => msg.senderId && msg.recipientId)
      .map((msg: any) => ({
        ...msg,
        senderId: msg.senderId!.toString(),
        recipientId: msg.recipientId!.toString(),
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

    // Get all messages in the conversation
    const allMessages = await messageService.find([]);
    
    // Filter messages that need to be marked as read
    const messagesToUpdate = allMessages.filter((msg: any) =>
      msg.conversationId === conversationId &&
      msg.recipientId === userId &&
      !msg.read
    );

    // Update each message
    await Promise.all(
      messagesToUpdate.map((msg: any) =>
        messageService.update(msg.id, { read: true } as any)
      )
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
