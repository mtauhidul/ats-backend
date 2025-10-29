import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getInterviews,
  getInterviewById,
  createInterview,
  updateInterview,
  cancelInterview,
  addFeedback,
  deleteInterview,
  getUpcomingInterviews,
} from '../controllers/interview.controller';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/interviews/upcoming
 * @desc    Get upcoming interviews
 * @access  All authenticated users
 */
router.get('/upcoming', getUpcomingInterviews);

/**
 * @route   GET /api/interviews
 * @desc    Get all interviews with filters
 * @access  All authenticated users
 */
router.get('/', getInterviews);

/**
 * @route   GET /api/interviews/:id
 * @desc    Get interview by ID
 * @access  All authenticated users
 */
router.get('/:id', getInterviewById);

/**
 * @route   POST /api/interviews
 * @desc    Create new interview
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.post(
  '/',
  requireRole('recruiter', 'hiring_manager', 'admin'),
  createInterview
);

/**
 * @route   PUT /api/interviews/:id
 * @desc    Update interview
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.put(
  '/:id',
  requireRole('recruiter', 'hiring_manager', 'admin'),
  updateInterview
);

/**
 * @route   PATCH /api/interviews/:id
 * @desc    Update interview (partial)
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.patch(
  '/:id',
  requireRole('recruiter', 'hiring_manager', 'admin'),
  updateInterview
);

/**
 * @route   POST /api/interviews/:id/cancel
 * @desc    Cancel interview
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.post(
  '/:id/cancel',
  requireRole('recruiter', 'hiring_manager', 'admin'),
  cancelInterview
);

/**
 * @route   POST /api/interviews/:id/feedback
 * @desc    Add feedback to interview
 * @access  Interviewer, Recruiter, Hiring Manager, Admin, Super Admin
 */
router.post(
  '/:id/feedback',
  requireRole('interviewer', 'recruiter', 'hiring_manager', 'admin'),
  addFeedback
);

/**
 * @route   DELETE /api/interviews/:id
 * @desc    Delete interview
 * @access  Admin, Super Admin
 */
router.delete(
  '/:id',
  requireRole('admin'),
  deleteInterview
);

export default router;
