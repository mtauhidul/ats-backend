import { Request, Response } from "express";
import { INotification, Notification, User } from "../models";
import logger from "../utils/logger";

/**
 * Get all notifications for the authenticated user
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    // First, clean up any expired important notices
    await Notification.deleteMany({
      isImportant: true,
      expiresAt: { $lt: new Date() },
    });

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Transform _id to id for frontend compatibility
    const transformedNotifications = notifications.map((notif) => ({
      ...notif,
      id: notif._id.toString(),
      _id: undefined,
    }));

    res.status(200).json({
      status: "success",
      data: {
        notifications: transformedNotifications,
        total: transformedNotifications.length,
        unread: transformedNotifications.filter((n: any) => !n.read).length,
      },
    });
  } catch (error: any) {
    logger.error("Error fetching notifications:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

/**
 * Get a single notification by ID
 */
export const getNotificationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const notification = await Notification.findOne({
      _id: id,
      userId,
    }).lean();

    if (!notification) {
      res.status(404).json({
        status: "error",
        message: "Notification not found",
      });
      return;
    }

    const transformedNotification = {
      ...notification,
      id: notification._id.toString(),
      _id: undefined,
    };

    res.status(200).json({
      status: "success",
      data: transformedNotification,
    });
  } catch (error: any) {
    logger.error("Error fetching notification:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch notification",
      error: error.message,
    });
  }
};

/**
 * Create a new notification
 */
export const createNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { type, title, message, relatedEntity } = req.body;

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      relatedEntity: relatedEntity || null,
      read: false,
    });

    const notificationObj = notification.toObject() as INotification & {
      _id: any;
    };

    const transformedNotification = {
      ...notificationObj,
      id: notificationObj._id.toString(),
      _id: undefined,
    };

    logger.info(`Notification created for user ${userId}: ${title}`);

    res.status(201).json({
      status: "success",
      data: transformedNotification,
    });
  } catch (error: any) {
    logger.error("Error creating notification:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to create notification",
      error: error.message,
    });
  }
};

/**
 * Update notification (mark as read)
 */
export const updateNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { read } = req.body;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { read },
      { new: true }
    ).lean();

    if (!notification) {
      res.status(404).json({
        status: "error",
        message: "Notification not found",
      });
      return;
    }

    const transformedNotification = {
      ...notification,
      id: notification._id.toString(),
      _id: undefined,
    };

    res.status(200).json({
      status: "success",
      data: transformedNotification,
    });
  } catch (error: any) {
    logger.error("Error updating notification:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update notification",
      error: error.message,
    });
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId,
    });

    if (!notification) {
      res.status(404).json({
        status: "error",
        message: "Notification not found",
      });
      return;
    }

    res.status(200).json({
      status: "success",
      message: "Notification deleted successfully",
    });
  } catch (error: any) {
    logger.error("Error deleting notification:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete notification",
      error: error.message,
    });
  }
};

/**
 * Delete all notifications for the authenticated user
 */
export const deleteAllNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    const result = await Notification.deleteMany({ userId });

    res.status(200).json({
      status: "success",
      message: "All notifications deleted successfully",
      data: {
        deletedCount: result.deletedCount,
      },
    });
  } catch (error: any) {
    logger.error("Error deleting all notifications:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete notifications",
      error: error.message,
    });
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    await Notification.updateMany({ userId, read: false }, { read: true });

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const transformedNotifications = notifications.map((notif) => ({
      ...notif,
      id: notif._id.toString(),
      _id: undefined,
    }));

    res.status(200).json({
      status: "success",
      data: {
        notifications: transformedNotifications,
      },
    });
  } catch (error: any) {
    logger.error("Error marking all as read:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to mark notifications as read",
      error: error.message,
    });
  }
};

/**
 * Broadcast important notice to all team members (Admin only)
 */
export const broadcastImportantNotice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, title, message, priority, expiresAt } = req.body;

    // Get all active users
    const users = await User.find({ isActive: true }).select('_id');

    if (users.length === 0) {
      res.status(404).json({
        status: "error",
        message: "No active users found",
      });
      return;
    }

    // Create notifications for all users
    const notifications = users.map((user) => ({
      userId: user._id,
      type: type || 'system',
      title,
      message,
      isImportant: true,
      priority: priority || 'high',
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      read: false,
      relatedEntity: null,
    }));

    const createdNotifications = await Notification.insertMany(notifications);

    logger.info(
      `Important notice broadcast to ${users.length} users by admin: ${title}`
    );

    res.status(201).json({
      status: "success",
      message: `Important notice sent to ${users.length} team members`,
      data: {
        count: createdNotifications.length,
        recipients: users.length,
      },
    });
  } catch (error: any) {
    logger.error("Error broadcasting important notice:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to broadcast important notice",
      error: error.message,
    });
  }
};

/**
 * Clean up expired important notices
 * This can be called by a cron job or scheduled task
 */
export const cleanupExpiredNotices = async (): Promise<number> => {
  try {
    const result = await Notification.deleteMany({
      isImportant: true,
      expiresAt: { $lt: new Date() },
    });

    const deletedCount = result.deletedCount || 0;

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} expired important notices`);
    }

    return deletedCount;
  } catch (error: any) {
    logger.error("Error cleaning up expired notices:", error);
    throw error;
  }
};
