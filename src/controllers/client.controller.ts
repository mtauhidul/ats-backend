import { Request, Response } from 'express';
import { Client } from '../models';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError, ValidationError as CustomValidationError } from '../utils/errors';
import logger from '../utils/logger';
import {
  CreateClientInput,
  UpdateClientInput,
  ListClientsQuery,
} from '../types/client.types';

/**
 * Create new client
 */
export const createClient = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreateClientInput = req.body;

    // Check for duplicate client by companyName
    const existingClient = await Client.findOne({ companyName: data.companyName });

    if (existingClient) {
      throw new CustomValidationError(
        `Client already exists with name: ${data.companyName}`
      );
    }

    // Create client
    const client = await Client.create({
      ...data,
      createdBy: req.user?._id,
    });

    logger.info(`Client created: ${client.companyName} by user ${req.user?._id}`);

    successResponse(res, client, 'Client created successfully', 201);
  }
);

/**
 * Get all clients with filters and pagination
 */
export const getClients = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      isActive,
      industry,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as any as ListClientsQuery;

    // Build filter
    const filter: any = {};
    if (isActive !== undefined) filter.isActive = isActive;
    if (industry) filter.industry = { $regex: industry, $options: 'i' };

    if (search) {
      filter.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const totalCount = await Client.countDocuments(filter);

    // Calculate pagination
    const pagination = paginateResults(totalCount, {
      page,
      limit,
      sort: sortBy,
      order: sortOrder,
    });

    // Calculate skip
    const skip = (page - 1) * limit;

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Fetch data
    const clients = await Client.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    successResponse(
      res,
      {
        clients,
        pagination,
      },
      'Clients retrieved successfully'
    );
  }
);

/**
 * Get single client by ID
 */
export const getClientById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const client = await Client.findById(id)
      .populate('createdBy', 'firstName lastName email');

    if (!client) {
      throw new NotFoundError('Client not found');
    }

    // Get job count
    const Job = require('../models').Job;
    const jobCount = await Job.countDocuments({ clientId: id });

    successResponse(
      res,
      {
        ...client.toJSON(),
        jobCount,
      },
      'Client retrieved successfully'
    );
  }
);

/**
 * Update client
 */
export const updateClient = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates: UpdateClientInput = req.body;

    const client = await Client.findById(id);

    if (!client) {
      throw new NotFoundError('Client not found');
    }

    // Check if companyName is being changed and if it creates a duplicate
    if (updates.companyName && updates.companyName !== client.companyName) {
      const existingClient = await Client.findOne({
        companyName: updates.companyName,
        _id: { $ne: id },
      });

      if (existingClient) {
        throw new CustomValidationError(
          `Client already exists with name: ${updates.companyName}`
        );
      }
    }

    // Update fields
    Object.assign(client, updates);
    client.updatedBy = req.user?._id as any;
    await client.save();

    logger.info(`Client updated: ${client.companyName}`);

    successResponse(res, client, 'Client updated successfully');
  }
);

/**
 * Delete client
 */
export const deleteClient = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const client = await Client.findById(id);

    if (!client) {
      throw new NotFoundError('Client not found');
    }

    // Check if there are associated jobs
    const Job = require('../models').Job;
    const jobCount = await Job.countDocuments({ clientId: id });

    if (jobCount > 0) {
      throw new CustomValidationError(
        `Cannot delete client with ${jobCount} active jobs. Please remove or reassign the jobs first.`
      );
    }

    await client.deleteOne();

    logger.info(`Client deleted: ${client.companyName}`);

    successResponse(res, null, 'Client deleted successfully');
  }
);

/**
 * Get client statistics
 */
export const getClientStats = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const stats = await Client.aggregate([
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: '$isActive',
                count: { $sum: 1 },
              },
            },
          ],
          byIndustry: [
            {
              $group: {
                _id: '$industry',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          total: [
            {
              $count: 'count',
            },
          ],
        },
      },
    ]);

    const result = {
      total: stats[0].total[0]?.count || 0,
      byStatus: stats[0].byStatus.reduce((acc: any, item: any) => {
        acc[item._id ? 'active' : 'inactive'] = item.count;
        return acc;
      }, {}),
      topIndustries: stats[0].byIndustry,
    };

    successResponse(res, result, 'Client statistics retrieved successfully');
  }
);
