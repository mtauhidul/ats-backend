import express from 'express';
import { validate } from '../middleware/validation';
import { authenticate, requireRole } from '../middleware/auth';
import {
  createCandidate,
  getCandidates,
  getCandidateById,
  updateCandidate,
  deleteCandidate,
  moveCandidateStage,
  rescoreCandidate,
  bulkMoveCandidates,
  getCandidateStats,
  getTopCandidates,
  addCandidatesToPipeline,
  getCandidatesWithoutPipeline,
  getDashboardAnalytics,
} from '../controllers/candidate.controller';
import {
  createCandidateSchema,
  updateCandidateSchema,
  listCandidatesSchema,
  candidateIdSchema,
  moveCandidateStageSchema,
  rescoreCandidateSchema,
  bulkMoveCandidatesSchema,
} from '../types/candidate.types';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * @route   POST /api/candidates
 * @desc    Create new candidate (manual entry)
 * @access  Recruiter, Admin, Super Admin
 */
router.post(
  '/',
  requireRole('recruiter', 'admin'),
  validate(createCandidateSchema),
  createCandidate
);

/**
 * @route   GET /api/candidates
 * @desc    Get all candidates with filters
 * @access  Recruiter, Admin, Super Admin, Hiring Manager
 */
router.get(
  '/',
  requireRole('recruiter', 'admin', 'hiring_manager'),
  validate(listCandidatesSchema),
  getCandidates
);

/**
 * @route   GET /api/candidates/stats
 * @desc    Get candidate statistics
 * @access  Recruiter, Admin, Super Admin, Hiring Manager
 */
router.get(
  '/stats',
  requireRole('recruiter', 'admin', 'hiring_manager'),
  getCandidateStats
);

/**
 * @route   GET /api/candidates/top
 * @desc    Get top candidates by AI score
 * @access  Recruiter, Admin, Super Admin, Hiring Manager
 */
router.get(
  '/top',
  requireRole('recruiter', 'admin', 'hiring_manager'),
  getTopCandidates
);

/**
 * @route   GET /api/candidates/:id
 * @desc    Get candidate by ID
 * @access  Recruiter, Admin, Super Admin, Hiring Manager, Interviewer
 */
router.get(
  '/:id',
  requireRole('recruiter', 'admin', 'hiring_manager', 'interviewer'),
  validate(candidateIdSchema),
  getCandidateById
);

/**
 * @route   PUT /api/candidates/:id
 * @desc    Update candidate
 * @access  Recruiter, Admin, Super Admin
 */
router.put(
  '/:id',
  requireRole('recruiter', 'admin'),
  validate(updateCandidateSchema),
  updateCandidate
);

/**
 * @route   PATCH /api/candidates/:id
 * @desc    Update candidate (partial update)
 * @access  Recruiter, Admin, Super Admin
 */
router.patch(
  '/:id',
  requireRole('recruiter', 'admin'),
  validate(updateCandidateSchema),
  updateCandidate
);

/**
 * @route   DELETE /api/candidates/:id
 * @desc    Delete candidate
 * @access  Admin, Super Admin
 */
router.delete(
  '/:id',
  requireRole('admin'),
  validate(candidateIdSchema),
  deleteCandidate
);

/**
 * @route   POST /api/candidates/:id/move-stage
 * @desc    Move candidate to different pipeline stage
 * @access  Recruiter, Admin, Super Admin, Hiring Manager
 */
router.post(
  '/:id/move-stage',
  requireRole('recruiter', 'admin', 'hiring_manager'),
  validate(moveCandidateStageSchema),
  moveCandidateStage
);

/**
 * @route   POST /api/candidates/:id/rescore
 * @desc    Re-score candidate against a job
 * @access  Recruiter, Admin, Super Admin
 */
router.post(
  '/:id/rescore',
  requireRole('recruiter', 'admin'),
  validate(rescoreCandidateSchema),
  rescoreCandidate
);

/**
 * @route   POST /api/candidates/bulk/move-stage
 * @desc    Bulk move candidates to new stage
 * @access  Recruiter, Admin, Super Admin
 */
router.post(
  '/bulk/move-stage',
  requireRole('recruiter', 'admin'),
  validate(bulkMoveCandidatesSchema),
  bulkMoveCandidates
);

/**
 * @route   POST /api/candidates/pipeline/add
 * @desc    Add candidates to a pipeline (assign to first stage)
 * @access  Recruiter, Admin, Super Admin
 */
router.post(
  '/pipeline/add',
  requireRole('recruiter', 'admin'),
  addCandidatesToPipeline
);

/**
 * @route   GET /api/candidates/pipeline/unassigned
 * @desc    Get candidates for a job that are not in any pipeline
 * @access  Recruiter, Admin, Super Admin, Hiring Manager
 */
router.get(
  '/pipeline/unassigned',
  requireRole('recruiter', 'admin', 'hiring_manager'),
  getCandidatesWithoutPipeline
);

/**
 * @route   GET /api/candidates/analytics/dashboard
 * @desc    Get dashboard analytics (application trends by date)
 * @access  All authenticated users
 */
router.get(
  '/analytics/dashboard',
  getDashboardAnalytics
);

export default router;
