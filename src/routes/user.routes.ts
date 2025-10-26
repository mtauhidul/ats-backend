import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getUsers,
  getUserById,
  getCurrentUser,
  updateUser,
  deleteUser,
  getUserStats,
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
  requireRole('admin', 'super_admin'),
  getUserStats
);

/**
 * @route   GET /api/users
 * @desc    Get all users with filters
 * @access  Admin, Super Admin, Recruiter
 */
router.get(
  '/',
  requireRole('admin', 'super_admin', 'recruiter'),
  getUsers
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Admin, Super Admin, Recruiter
 */
router.get(
  '/:id',
  requireRole('admin', 'super_admin', 'recruiter'),
  getUserById
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Admin, Super Admin
 */
router.put(
  '/:id',
  requireRole('admin', 'super_admin'),
  updateUser
);

/**
 * @route   PATCH /api/users/:id
 * @desc    Update user (partial)
 * @access  Admin, Super Admin
 */
router.patch(
  '/:id',
  requireRole('admin', 'super_admin'),
  updateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Deactivate user
 * @access  Admin, Super Admin
 */
router.delete(
  '/:id',
  requireRole('admin', 'super_admin'),
  deleteUser
);

export default router;
