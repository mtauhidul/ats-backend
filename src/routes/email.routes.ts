import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getEmails,
  getEmailById,
  sendEmail,
  createDraft,
  updateDraft,
  sendDraft,
  deleteEmail,
  getEmailThread,
  getCandidateEmails,
  getEmailStats,
} from '../controllers/email.controller';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/emails/stats
 * @desc    Get email statistics
 * @access  Recruiter, Admin, Super Admin
 */
router.get(
  '/stats',
  requireRole('recruiter', 'admin', 'super_admin'),
  getEmailStats
);

/**
 * @route   GET /api/emails/thread/:threadId
 * @desc    Get email thread
 * @access  All authenticated users
 */
router.get('/thread/:threadId', getEmailThread);

/**
 * @route   GET /api/emails/candidate/:candidateId
 * @desc    Get all emails for a candidate
 * @access  All authenticated users
 */
router.get('/candidate/:candidateId', getCandidateEmails);

/**
 * @route   GET /api/emails
 * @desc    Get all emails with filters
 * @access  All authenticated users
 */
router.get('/', getEmails);

/**
 * @route   GET /api/emails/:id
 * @desc    Get email by ID
 * @access  All authenticated users
 */
router.get('/:id', getEmailById);

/**
 * @route   POST /api/emails
 * @desc    Send new email
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.post(
  '/',
  requireRole('recruiter', 'hiring_manager', 'admin', 'super_admin'),
  sendEmail
);

/**
 * @route   POST /api/emails/draft
 * @desc    Create draft email
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.post(
  '/draft',
  requireRole('recruiter', 'hiring_manager', 'admin', 'super_admin'),
  createDraft
);

/**
 * @route   PUT /api/emails/draft/:id
 * @desc    Update draft email
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.put(
  '/draft/:id',
  requireRole('recruiter', 'hiring_manager', 'admin', 'super_admin'),
  updateDraft
);

/**
 * @route   PATCH /api/emails/draft/:id
 * @desc    Update draft email (partial)
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.patch(
  '/draft/:id',
  requireRole('recruiter', 'hiring_manager', 'admin', 'super_admin'),
  updateDraft
);

/**
 * @route   POST /api/emails/draft/:id/send
 * @desc    Send draft email
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.post(
  '/draft/:id/send',
  requireRole('recruiter', 'hiring_manager', 'admin', 'super_admin'),
  sendDraft
);

/**
 * @route   DELETE /api/emails/:id
 * @desc    Delete email
 * @access  Admin, Super Admin
 */
router.delete(
  '/:id',
  requireRole('admin', 'super_admin'),
  deleteEmail
);

export default router;
