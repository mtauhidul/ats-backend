import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getTeamMembers,
  getTeamMemberById,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  getJobTeamMembers,
} from '../controllers/teamMember.controller';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/team/job/:jobId
 * @desc    Get all team members for a specific job
 * @access  All authenticated users
 */
router.get('/job/:jobId', getJobTeamMembers);

/**
 * @route   GET /api/team
 * @desc    Get all team members with filters
 * @access  All authenticated users
 */
router.get('/', getTeamMembers);

/**
 * @route   GET /api/team/:id
 * @desc    Get team member by ID
 * @access  All authenticated users
 */
router.get('/:id', getTeamMemberById);

/**
 * @route   POST /api/team
 * @desc    Add new team member to job
 * @access  Recruiter, Admin, Super Admin
 */
router.post(
  '/',
  requireRole('recruiter', 'admin', 'super_admin'),
  createTeamMember
);

/**
 * @route   PUT /api/team/:id
 * @desc    Update team member
 * @access  Recruiter, Admin, Super Admin
 */
router.put(
  '/:id',
  requireRole('recruiter', 'admin', 'super_admin'),
  updateTeamMember
);

/**
 * @route   PATCH /api/team/:id
 * @desc    Update team member (partial)
 * @access  Recruiter, Admin, Super Admin
 */
router.patch(
  '/:id',
  requireRole('recruiter', 'admin', 'super_admin'),
  updateTeamMember
);

/**
 * @route   DELETE /api/team/:id
 * @desc    Remove team member
 * @access  Recruiter, Admin, Super Admin
 */
router.delete(
  '/:id',
  requireRole('recruiter', 'admin', 'super_admin'),
  deleteTeamMember
);

export default router;
