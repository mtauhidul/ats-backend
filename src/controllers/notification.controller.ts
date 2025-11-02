import { Request, Response } from "express";
import { notificationService, userService } from "../services/firestore";
import logger from "../utils/logger";

/**
 * Get all notifications for the authenticated user
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    // First, clean up any expired important notices
    const allNotifications = await notificationService.find([]);
    const expiredNotifications = allNotifications.filter((n: any) => 
      n.isImportant && n.expiresAt && new Date(n.expiresAt) < new Date()
    );
    
    await Promise.all(
      expiredNotifications.map((n: any) => notificationService.delete(n.id))
    );

    // Get user's notifications
    let notifications = await notificationService.find([]);
    notifications = notifications
      .filter((n: any) => n.userId === userId)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({
      status: "success",
      data: {
        notifications,
        total: notifications.length,
        unread: notifications.filter((n: any) => !n.read).length,
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

    const notification = await notificationService.findById(id);

    if (!notification || notification.userId !== userId) {
      res.status(404).json({
        status: "error",
        message: "Notification not found",
      });
      return;
    }

    res.status(200).json({
      status: "success",
      data: notification,
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

    const notificationId = await notificationService.create({
      userId,
      type,
      title,
      message,
      relatedEntity: relatedEntity || null,
      read: false,
    } as any);

    const notification = await notificationService.findById(notificationId);

    logger.info(`Notification created for user ${userId}: ${title}`);

    res.status(201).json({
      status: "success",
      data: notification,
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

    const notification = await notificationService.findById(id);

    if (!notification || notification.userId !== userId) {
      res.status(404).json({
        status: "error",
        message: "Notification not found",
      });
      return;
    }

    await notificationService.update(id, { read } as any);

    const updatedNotification = await notificationService.findById(id);

    res.status(200).json({
      status: "success",
      data: updatedNotification,
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

    const notification = await notificationService.findById(id);

    if (!notification || notification.userId !== userId) {
      res.status(404).json({
        status: "error",
        message: "Notification not found",
      });
      return;
    }

    await notificationService.delete(id);

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

    let allNotifications = await notificationService.find([]);
    const userNotifications = allNotifications.filter((n: any) => n.userId === userId);

    await Promise.all(
      userNotifications.map((n: any) => notificationService.delete(n.id))
    );

    res.status(200).json({
      status: "success",
      message: "All notifications deleted successfully",
      data: {
        deletedCount: userNotifications.length,
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

    let allNotifications = await notificationService.find([]);
    const userUnreadNotifications = allNotifications.filter(
      (n: any) => n.userId === userId && !n.read
    );

    await Promise.all(
      userUnreadNotifications.map((n: any) =>
        notificationService.update(n.id, { read: true } as any)
      )
    );

    // Get updated notifications
    allNotifications = await notificationService.find([]);
    let notifications = allNotifications
      .filter((n: any) => n.userId === userId)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({
      status: "success",
      data: {
        notifications,
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
    let allUsers = await userService.find([]);
    const activeUsers = allUsers.filter((u: any) => u.isActive !== false);

    if (activeUsers.length === 0) {
      res.status(404).json({
        status: "error",
        message: "No active users found",
      });
      return;
    }

    // Create notifications for all users
    const notificationPromises = activeUsers.map((user: any) =>
      notificationService.create({
        userId: user.id,
        type: type || 'system',
        title,
        message,
        isImportant: true,
        priority: priority || 'high',
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        read: false,
        relatedEntity: null,
      } as any)
    );

    await Promise.all(notificationPromises);

    logger.info(
      `Important notice broadcast to ${activeUsers.length} users by admin: ${title}`
    );

    res.status(201).json({
      status: "success",
      message: `Important notice sent to ${activeUsers.length} team members`,
      data: {
        count: activeUsers.length,
        recipients: activeUsers.length,
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
    const allNotifications = await notificationService.find([]);
    const expiredNotifications = allNotifications.filter((n: any) => 
      n.isImportant && n.expiresAt && new Date(n.expiresAt) < new Date()
    );

    await Promise.all(
      expiredNotifications.map((n: any) => notificationService.delete(n.id))
    );

    const deletedCount = expiredNotifications.length;

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} expired important notices`);
    }

    return deletedCount;
  } catch (error: any) {
    logger.error("Error cleaning up expired notices:", error);
    throw error;
  }
};
