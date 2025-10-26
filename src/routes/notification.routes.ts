import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  getNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  deleteAllNotifications,
  markAllAsRead,
} from '../controllers/notification.controller';

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);

// Get all notifications for authenticated user
router.get('/', getNotifications);

// Mark all notifications as read
router.patch('/mark-all-read', markAllAsRead);

// Delete all notifications
router.delete('/clear-all', deleteAllNotifications);

// Get single notification
router.get('/:id', getNotificationById);

// Create notification (typically called internally by other services)
router.post('/', createNotification);

// Update notification (mark as read)
router.patch('/:id', updateNotification);

// Delete notification
router.delete('/:id', deleteNotification);

export default router;
