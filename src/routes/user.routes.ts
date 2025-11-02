import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { uploadAvatar } from '../middleware/upload';
import {
  getUsers,
  getUserById,
  getCurrentUser,
  updateUser,
  deleteUser,
  getUserStats,
  uploadUserAvatar,
  deleteUserAvatar,
} from '../controllers/user.controller';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/users/me
 * @desc    Get current user profile
 * @access  All authenticated users
 */
router.get('/me', getCurrentUser);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Admin, Super Admin
 */
router.get(
  '/stats',
  requireRole('admin'),
  getUserStats
);

/**
 * @route   GET /api/users
 * @desc    Get all users with filters
 * @access  Admin, Super Admin, Recruiter
 */
router.get(
  '/',
  requireRole('admin', 'recruiter'),
  getUsers
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Admin, Super Admin, Recruiter
 */
router.get(
  '/:id',
  requireRole('admin', 'recruiter'),
  getUserById
);

/**
 * @route   POST /api/users/:id/avatar
 * @desc    Upload user avatar
 * @access  Authenticated user (own profile) or Admin
 */
router.post(
  '/:id/avatar',
  uploadAvatar,
  uploadUserAvatar
);

/**
 * @route   DELETE /api/users/:id/avatar
 * @desc    Delete user avatar
 * @access  Authenticated user (own profile) or Admin
 */
router.delete(
  '/:id/avatar',
  deleteUserAvatar
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Admin, Super Admin
 */
router.put(
  '/:id',
  requireRole('admin'),
  updateUser
);

/**
 * @route   PATCH /api/users/:id
 * @desc    Update user (partial)
 * @access  Admin, Super Admin
 */
router.patch(
  '/:id',
  requireRole('admin'),
  updateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Deactivate user
 * @access  Admin, Super Admin
 */
router.delete(
  '/:id',
  requireRole('admin'),
  deleteUser
);

export default router;
