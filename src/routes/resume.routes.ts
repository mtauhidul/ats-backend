import { Router } from 'express';
import {
  parseResume,
  parseAndSaveResume,
  reparseApplicationResume,
} from '../controllers/resume.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { uploadResume } from '../middleware/upload';
import { validate } from '../middleware/validation';
import {
  parseResumeSchema,
  parseAndSaveResumeSchema,
} from '../types/resume.types';

const router = Router();

// All resume routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/resumes/parse
 * @desc    Parse resume and return JSON (manual import workflow)
 * @access  Recruiter, Admin, Super Admin
 */
router.post(
  '/parse',
  requireRole('recruiter', 'admin', 'super_admin'),
  uploadResume,
  validate(parseResumeSchema),
  parseResume
);

/**
 * @route   POST /api/resumes/parse-and-save
 * @desc    Parse resume and auto-create application (direct apply workflow)
 * @access  Recruiter, Admin, Super Admin
 */
router.post(
  '/parse-and-save',
  requireRole('recruiter', 'admin', 'super_admin'),
  uploadResume,
  validate(parseAndSaveResumeSchema),
  parseAndSaveResume
);

/**
 * @route   POST /api/resumes/reparse/:id
 * @desc    Re-parse existing application's resume
 * @access  Recruiter, Admin, Super Admin
 */
router.post(
  '/reparse/:id',
  requireRole('recruiter', 'admin', 'super_admin'),
  reparseApplicationResume
);

export default router;
