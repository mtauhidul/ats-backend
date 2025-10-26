import { Request, Response } from "express";
import { INotification, Notification } from "../models";
import logger from "../utils/logger";

/**
 * Get all notifications for the authenticated user
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

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
export const getNotificationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const notification = await Notification.findOne({
      _id: id,
      userId,
    }).lean();

    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found",
      });
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
export const updateNotification = async (req: Request, res: Response) => {
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
      return res.status(404).json({
        status: "error",
        message: "Notification not found",
      });
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
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId,
    });

    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found",
      });
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
