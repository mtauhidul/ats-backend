import express from 'express';
import { validate } from '../middleware/validation';
import { authenticate, requireRole } from '../middleware/auth';
import {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  bulkUpdateJobStatus,
  getJobStats,
} from '../controllers/job.controller';
import {
  createJobSchema,
  updateJobSchema,
  listJobsSchema,
  jobIdSchema,
  bulkUpdateJobStatusSchema,
} from '../types/job.types';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/jobs
 * @desc    Create new job
 * @access  Recruiter, Admin, Super Admin
 */
router.post(
  '/',
  requireRole('recruiter', 'admin', 'super_admin'),
  validate(createJobSchema),
  createJob
);

/**
 * @route   GET /api/jobs
 * @desc    Get all jobs with filters
 * @access  All authenticated users
 */
router.get(
  '/',
  validate(listJobsSchema),
  getJobs
);

/**
 * @route   GET /api/jobs/stats
 * @desc    Get job statistics
 * @access  Recruiter, Admin, Super Admin, Hiring Manager
 */
router.get(
  '/stats',
  requireRole('recruiter', 'admin', 'super_admin', 'hiring_manager'),
  getJobStats
);

/**
 * @route   GET /api/jobs/:id
 * @desc    Get job by ID
 * @access  All authenticated users
 */
router.get(
  '/:id',
  validate(jobIdSchema),
  getJobById
);

/**
 * @route   PUT /api/jobs/:id
 * @desc    Update job
 * @access  Recruiter, Admin, Super Admin
 */
router.put(
  '/:id',
  requireRole('recruiter', 'admin', 'super_admin'),
  validate(updateJobSchema),
  updateJob
);

/**
 * @route   DELETE /api/jobs/:id
 * @desc    Delete job
 * @access  Admin, Super Admin
 */
router.delete(
  '/:id',
  requireRole('admin', 'super_admin'),
  validate(jobIdSchema),
  deleteJob
);

/**
 * @route   POST /api/jobs/bulk/status
 * @desc    Bulk update job status
 * @access  Recruiter, Admin, Super Admin
 */
router.post(
  '/bulk/status',
  requireRole('recruiter', 'admin', 'super_admin'),
  validate(bulkUpdateJobStatusSchema),
  bulkUpdateJobStatus
);

export default router;
