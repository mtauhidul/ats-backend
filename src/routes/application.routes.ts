import { Router } from 'express';
import {
  createApplication,
  getApplications,
  getApplicationById,
  updateApplication,
  deleteApplication,
  approveApplication,
  bulkUpdateStatus,
  getApplicationStats,
} from '../controllers/application.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  createApplicationSchema,
  updateApplicationSchema,
  applicationIdSchema,
  listApplicationsSchema,
  approveApplicationSchema,
  bulkUpdateStatusSchema,
} from '../types/application.types';

const router = Router();

// All application routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/applications
 * @desc    Create a new application (manual entry)
 * @access  Recruiter, Admin, Super Admin
 */
router.post(
  '/',
  requireRole('recruiter', 'admin', 'super_admin'),
  validate(createApplicationSchema),
  createApplication
);

/**
 * @route   GET /api/applications
 * @desc    Get all applications with filters and pagination
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.get(
  '/',
  requireRole('recruiter', 'hiring_manager', 'admin', 'super_admin'),
  validate(listApplicationsSchema),
  getApplications
);

/**
 * @route   GET /api/applications/stats
 * @desc    Get application statistics
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.get(
  '/stats',
  requireRole('recruiter', 'hiring_manager', 'admin', 'super_admin'),
  getApplicationStats
);

/**
 * @route   GET /api/applications/:id
 * @desc    Get single application by ID
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.get(
  '/:id',
  requireRole('recruiter', 'hiring_manager', 'admin', 'super_admin'),
  validate(applicationIdSchema),
  getApplicationById
);

/**
 * @route   PUT /api/applications/:id
 * @desc    Update application
 * @access  Recruiter, Admin, Super Admin
 */
router.put(
  '/:id',
  requireRole('recruiter', 'admin', 'super_admin'),
  validate(updateApplicationSchema),
  updateApplication
);

/**
 * @route   PATCH /api/applications/:id
 * @desc    Update application (partial update)
 * @access  Recruiter, Admin, Super Admin
 */
router.patch(
  '/:id',
  requireRole('recruiter', 'admin', 'super_admin'),
  validate(updateApplicationSchema),
  updateApplication
);

/**
 * @route   DELETE /api/applications/:id
 * @desc    Delete application
 * @access  Admin, Super Admin
```

/**
 * @route   DELETE /api/applications/:id
 * @desc    Delete application
 * @access  Admin, Super Admin
 */
router.delete(
  '/:id',
  requireRole('admin', 'super_admin'),
  validate(applicationIdSchema),
  deleteApplication
);

/**
 * @route   POST /api/applications/:id/approve
 * @desc    Approve application and create candidate with AI scoring
 * @access  Recruiter, Admin, Super Admin
 */
router.post(
  '/:id/approve',
  requireRole('recruiter', 'admin', 'super_admin'),
  validate(approveApplicationSchema),
  approveApplication
);

/**
 * @route   POST /api/applications/bulk/status
 * @desc    Bulk update application status
 * @access  Recruiter, Admin, Super Admin
 */
router.post(
  '/bulk/status',
  requireRole('recruiter', 'admin', 'super_admin'),
  validate(bulkUpdateStatusSchema),
  bulkUpdateStatus
);

export default router;
