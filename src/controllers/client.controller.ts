import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Client } from '../models';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError, ValidationError as CustomValidationError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';
import {
  CreateClientInput,
  UpdateClientInput,
  ListClientsQuery,
} from '../types/client.types';

/**
 * Calculate statistics for a client
 */
async function calculateClientStatistics(clientId: string) {
  const Job = mongoose.model('Job');
  const Candidate = mongoose.model('Candidate');

  // Get all jobs for this client
  const jobs = await Job.find({ clientId }).select('status');
  
  const totalJobs = jobs.length;
  const activeJobs = jobs.filter((j: any) => j.status === 'open').length;
  const closedJobs = jobs.filter((j: any) => j.status === 'closed').length;
  const draftJobs = jobs.filter((j: any) => j.status === 'draft').length;

  // Get all candidates for this client's jobs
  const jobIds = jobs.map((j: any) => j._id);
  const candidates = await Candidate.find({ 
    jobIds: { $in: jobIds } 
  }).select('status createdAt');

  const totalCandidates = candidates.length;
  const activeCandidates = candidates.filter((c: any) => 
    ['active', 'interviewing', 'offered'].includes(c.status)
  ).length;
  const hiredCandidates = candidates.filter((c: any) => c.status === 'hired').length;
  const rejectedCandidates = candidates.filter((c: any) => 
    ['rejected', 'withdrawn'].includes(c.status)
  ).length;

  // Calculate success rate
  const successRate = totalCandidates > 0 
    ? Math.round((hiredCandidates / totalCandidates) * 100) 
    : 0;

  // Calculate average time to hire (simplified - days from candidate creation to hired)
  const hiredCandidates_list = candidates.filter((c: any) => c.status === 'hired');
  let averageTimeToHire = 0;
  if (hiredCandidates_list.length > 0) {
    const totalDays = hiredCandidates_list.reduce((sum: number, candidate: any) => {
      const days = Math.floor((Date.now() - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    averageTimeToHire = Math.round(totalDays / hiredCandidates_list.length);
  }

  return {
    totalJobs,
    activeJobs,
    closedJobs,
    draftJobs,
    totalCandidates,
    activeCandidates,
    hiredCandidates,
    rejectedCandidates,
    successRate,
    averageTimeToHire,
  };
}

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
      .limit(limit)
      .lean(); // Use lean for better performance

    // Calculate statistics for ALL clients in batch (avoid N+1 queries)
    const Job = mongoose.model('Job');
    const Candidate = mongoose.model('Candidate');
    
    const clientIds = clients.map((c: any) => c._id);
    
    // Batch fetch all jobs for all clients in ONE query
    const allJobs = await Job.find({ 
      clientId: { $in: clientIds } 
    }).select('clientId status').lean();
    
    // Get all job IDs
    const allJobIds = allJobs.map((j: any) => j._id);
    
    // Batch fetch all candidates for all jobs in ONE query
    const allCandidates = await Candidate.find({
      jobIds: { $in: allJobIds }
    }).select('jobIds status').lean();
    
    // Group jobs by clientId for fast lookup
    const jobsByClient = new Map();
    allJobs.forEach((job: any) => {
      const clientId = job.clientId.toString();
      if (!jobsByClient.has(clientId)) {
        jobsByClient.set(clientId, []);
      }
      jobsByClient.get(clientId).push(job);
    });
    
    // Group candidates by clientId (via their jobs)
    const candidatesByClient = new Map();
    allCandidates.forEach((candidate: any) => {
      const jobIds = candidate.jobIds.map((id: any) => id.toString());
      allJobs.forEach((job: any) => {
        if (jobIds.includes(job._id.toString())) {
          const clientId = job.clientId.toString();
          if (!candidatesByClient.has(clientId)) {
            candidatesByClient.set(clientId, []);
          }
          candidatesByClient.get(clientId).push(candidate);
        }
      });
    });
    
    // Calculate statistics for each client using cached data
    const clientsWithStats = clients.map((client: any) => {
      const clientId = (client._id || client.id).toString();
      const jobs = jobsByClient.get(clientId) || [];
      const candidates = candidatesByClient.get(clientId) || [];
      
      const totalJobs = jobs.length;
      const activeJobs = jobs.filter((j: any) => j.status === 'open').length;
      const closedJobs = jobs.filter((j: any) => j.status === 'closed').length;
      const draftJobs = jobs.filter((j: any) => j.status === 'draft').length;
      
      // Deduplicate candidates by ID
      const uniqueCandidates = Array.from(
        new Map(candidates.map((c: any) => [c._id.toString(), c])).values()
      );
      
      const totalCandidates = uniqueCandidates.length;
      const activeCandidates = uniqueCandidates.filter((c: any) =>
        ['active', 'interviewing', 'offered'].includes(c.status)
      ).length;
      const hiredCandidates = uniqueCandidates.filter((c: any) => c.status === 'hired').length;
      const rejectedCandidates = uniqueCandidates.filter((c: any) =>
        ['rejected', 'withdrawn'].includes(c.status)
      ).length;
      
      const successRate = totalCandidates > 0
        ? Math.round((hiredCandidates / totalCandidates) * 100)
        : 0;
      
      return {
        ...client,
        id: client._id.toString(), // Transform _id to id for frontend
        statistics: {
          totalJobs,
          activeJobs,
          closedJobs,
          draftJobs,
          totalCandidates,
          activeCandidates,
          hiredCandidates,
          rejectedCandidates,
          successRate,
        },
      };
    });

    successResponse(
      res,
      {
        clients: clientsWithStats,
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

    // Validate ID - prevent "undefined" or invalid ObjectId
    if (!id || id === 'undefined' || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid client ID');
    }

    const client = await Client.findById(id)
      .populate('assignedTo', 'firstName lastName email');

    if (!client) {
      throw new NotFoundError('Client not found');
    }

    // Transform the client data to match frontend schema
    const clientData = client.toJSON();

    // Calculate real-time statistics
    const statistics = await calculateClientStatistics(id);

    // Populate assignedToName if assignedTo exists
    let assignedToId = clientData.assignedTo;
    let assignedToName = clientData.assignedToName || '';

    if (clientData.assignedTo && typeof clientData.assignedTo === 'object') {
      const assignedToUser = clientData.assignedTo as any;
      assignedToName = `${assignedToUser.firstName} ${assignedToUser.lastName}`.trim();
      assignedToId = assignedToUser.id || assignedToUser._id?.toString();
    }

    // Build response matching frontend schema exactly
    const response = {
      id: clientData.id,
      companyName: clientData.companyName,
      email: clientData.email || '',
      phone: clientData.phone || '',
      website: clientData.website || '',
      logo: clientData.logo || '',
      industry: clientData.industry,
      companySize: clientData.companySize || '',
      status: clientData.status,
      address: clientData.address || {
        street: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
      },
      description: clientData.description || '',
      contacts: clientData.contacts || [],
      statistics,
      jobIds: clientData.jobIds || [],
      tags: clientData.tags || [],
      assignedTo: assignedToId || '',
      assignedToName: assignedToName,
      createdAt: clientData.createdAt,
      updatedAt: clientData.updatedAt,
    };

    successResponse(
      res,
      response,
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
