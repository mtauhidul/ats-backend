import express from 'express';
import { validate } from '../middleware/validation';
import { authenticate, requireRole } from '../middleware/auth';
import {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  getClientStats,
} from '../controllers/client.controller';
import {
  createClientSchema,
  updateClientSchema,
  listClientsSchema,
  clientIdSchema,
} from '../types/client.types';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/clients
 * @desc    Create new client
 * @access  Admin, Super Admin
 */
router.post(
  '/',
  requireRole('admin', 'super_admin'),
  validate(createClientSchema),
  createClient
);

/**
 * @route   GET /api/clients
 * @desc    Get all clients with filters
 * @access  All authenticated users
 */
router.get(
  '/',
  validate(listClientsSchema),
  getClients
);

/**
 * @route   GET /api/clients/stats
 * @desc    Get client statistics
 * @access  Admin, Super Admin
 */
router.get(
  '/stats',
  requireRole('admin', 'super_admin'),
  getClientStats
);

/**
 * @route   GET /api/clients/:id
 * @desc    Get client by ID
 * @access  All authenticated users
 */
router.get(
  '/:id',
  validate(clientIdSchema),
  getClientById
);

/**
 * @route   PUT /api/clients/:id
 * @desc    Update client
 * @access  Admin, Super Admin
 */
router.put(
  '/:id',
  requireRole('admin', 'super_admin'),
  validate(updateClientSchema),
  updateClient
);

/**
 * @route   PATCH /api/clients/:id
 * @desc    Update client (partial update)
 * @access  Admin, Super Admin
 */
router.patch(
  '/:id',
  requireRole('admin', 'super_admin'),
  validate(updateClientSchema),
  updateClient
);

/**
 * @route   DELETE /api/clients/:id
 * @desc    Delete client
 * @access  Admin, Super Admin
 */
router.delete(
  '/:id',
  requireRole('admin', 'super_admin'),
  validate(clientIdSchema),
  deleteClient
);

export default router;
