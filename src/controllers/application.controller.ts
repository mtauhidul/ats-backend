import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Application, Candidate, Job, Pipeline } from '../models';
import openaiService from '../services/openai.service';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError, ValidationError as CustomValidationError } from '../utils/errors';
import logger from '../utils/logger';
import {
  CreateApplicationInput,
  UpdateApplicationInput,
  ListApplicationsQuery,
  ApproveApplicationInput,
  BulkUpdateStatusInput,
} from '../types/application.types';

/**
 * Create new application
 * Supports all three submission methods
 */
export const createApplication = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreateApplicationInput = req.body;

    // Verify job exists
    const job = await Job.findById(data.jobId);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    // Check for duplicate application
    const existingApplication = await Application.findOne({
      jobId: data.jobId,
      email: data.email,
    });

    if (existingApplication) {
      throw new CustomValidationError(
        `Application already exists for this job with email: ${data.email}`
      );
    }

    // If email_automation source, verify sourceEmailAccountId is provided
    if (data.source === 'email_automation' && !data.sourceEmailAccountId) {
      throw new CustomValidationError(
        'sourceEmailAccountId is required for email_automation source'
      );
    }

    // Create application
    const application = await Application.create({
      ...data,
      clientId: data.clientId || job.clientId,
    });

    // Populate references
    await application.populate([
      { path: 'jobId', select: 'title location employmentType' },
      { path: 'clientId', select: 'name logo' },
      { path: 'sourceEmailAccountId', select: 'name email' },
    ]);

    logger.info(
      `Application created: ${application.email} for job ${job.title} via ${data.source}`
    );

    successResponse(res, application, 'Application created successfully', 201);
  }
);

/**
 * Get all applications with filters and pagination
 */
export const getApplications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      jobId,
      clientId,
      status,
      source,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as any as ListApplicationsQuery;

    // Build filter
    const filter: any = {};
    if (jobId) filter.jobId = jobId;
    if (clientId) filter.clientId = clientId;
    if (status) filter.status = status;
    if (source) filter.source = source;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const totalCount = await Application.countDocuments(filter);

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
    const applications = await Application.find(filter)
      .populate('jobId', 'title location employmentType')
      .populate('clientId', 'name logo')
      .populate('sourceEmailAccountId', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    successResponse(
      res,
      {
        applications,
        pagination,
      },
      'Applications retrieved successfully'
    );
  }
);

/**
 * Get single application by ID
 */
export const getApplicationById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const application = await Application.findById(id)
      .populate('jobId', 'title description location employmentType salaryRange')
      .populate('clientId', 'name logo website industry')
      .populate('sourceEmailAccountId', 'name email')
      .populate('candidateId', 'firstName lastName email status currentStage aiScore');

    if (!application) {
      throw new NotFoundError('Application not found');
    }

    successResponse(res, application, 'Application retrieved successfully');
  }
);

/**
 * Update application
 */
export const updateApplication = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates: UpdateApplicationInput = req.body;

    const application = await Application.findById(id);

    if (!application) {
      throw new NotFoundError('Application not found');
    }

    // Check if email is being changed and if it creates a duplicate
    if (updates.email && updates.email !== application.email) {
      const existingApplication = await Application.findOne({
        jobId: application.jobId,
        email: updates.email,
        _id: { $ne: id },
      });

      if (existingApplication) {
        throw new CustomValidationError(
          `Application already exists for this job with email: ${updates.email}`
        );
      }
    }

    // Update fields
    Object.assign(application, updates);
    await application.save();

    // Populate references
    await application.populate([
      { path: 'jobId', select: 'title location employmentType' },
      { path: 'clientId', select: 'name logo' },
    ]);

    logger.info(`Application updated: ${application.email}`);

    successResponse(res, application, 'Application updated successfully');
  }
);

/**
 * Delete application (soft delete)
 */
export const deleteApplication = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const application = await Application.findById(id);

    if (!application) {
      throw new NotFoundError('Application not found');
    }

    // Check if application has been approved (converted to candidate)
    const existingCandidate = await Candidate.findOne({ applicationId: id });
    if (existingCandidate) {
      throw new CustomValidationError(
        'Cannot delete application that has been approved as candidate'
      );
    }

    await application.deleteOne();

    logger.info(`Application deleted: ${application.email}`);

    successResponse(res, null, 'Application deleted successfully');
  }
);

/**
 * Approve application and create candidate with AI scoring
 */
export const approveApplication = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { jobId, assignToPipeline, initialStage, notes }: ApproveApplicationInput = req.body;

    const application = await Application.findById(id);

    if (!application) {
      throw new NotFoundError('Application not found');
    }

    // Check if already approved (check if candidate exists)
    const existingCandidate = await Candidate.findOne({ applicationId: id });
    if (existingCandidate) {
      throw new CustomValidationError('Application has already been approved');
    }

    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) {
      throw new NotFoundError('Job not found for scoring');
    }

    logger.info(`Approving application: ${application.email} for job ${job.title}`);

    // Get pipeline (use provided or job's default)
    let pipeline: any = null;
    let stage = initialStage || 'Applied';

    if (assignToPipeline) {
      pipeline = await Pipeline.findById(assignToPipeline);
      if (!pipeline) {
        throw new NotFoundError('Pipeline not found');
      }
      // Use first stage if initialStage not provided
      if (!initialStage && pipeline.stages && pipeline.stages.length > 0) {
        stage = pipeline.stages[0].name;
      }
    } else if (job.pipelineId) {
      pipeline = await Pipeline.findById(job.pipelineId);
      if (pipeline && !initialStage && pipeline.stages && pipeline.stages.length > 0) {
        stage = pipeline.stages[0].name;
      }
    }

    // Perform AI scoring
    logger.info(`Scoring candidate against job requirements...`);
    
    // Prepare parsed data for scoring
    const parsedDataForScoring: any = {
      summary: application.parsedData?.summary,
      skills: application.parsedData?.skills,
      experience: application.parsedData?.experience,
      education: application.parsedData?.education,
      certifications: application.parsedData?.certifications,
      languages: application.parsedData?.languages,
      extractedText: '',
    };

    const aiScore = await openaiService.scoreCandidate(
      parsedDataForScoring,
      job.description || '',
      job.requirements || []
    );

    // Create candidate
    const candidate = await Candidate.create({
      applicationId: application._id,
      jobId,
      clientId: application.clientId,
      firstName: application.firstName,
      lastName: application.lastName,
      email: application.email,
      phone: application.phone,
      resumeUrl: application.resumeUrl,
      pipelineId: pipeline?._id,
      currentStage: stage,
      status: 'active',
      aiScore,
      scoredForJobId: jobId,
      notes: notes || application.notes,
      source: application.source,
    });

    // Update application status
    application.status = 'approved';
    application.approvedAt = new Date();
    await application.save();

    // Populate candidate data
    await candidate.populate([
      { path: 'jobId', select: 'title location employmentType' },
      { path: 'clientId', select: 'name logo' },
      { path: 'pipelineId', select: 'name stages' },
    ]);

    logger.info(
      `Candidate created from application: ${candidate.email} with AI score: ${aiScore.overallScore}`
    );

    successResponse(
      res,
      {
        candidate,
        application,
      },
      'Application approved and candidate created successfully',
      201
    );
  }
);

/**
 * Bulk update application status
 */
export const bulkUpdateStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { applicationIds, status, notes }: BulkUpdateStatusInput = req.body;

    // Validate all IDs
    const validIds = applicationIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length !== applicationIds.length) {
      throw new CustomValidationError('Some application IDs are invalid');
    }

    // Update applications
    const updateData: any = { status };
    if (notes) {
      updateData.$push = { notes };
    }

    const result = await Application.updateMany(
      { _id: { $in: validIds } },
      updateData
    );

    logger.info(`Bulk updated ${result.modifiedCount} applications to status: ${status}`);

    successResponse(
      res,
      {
        modifiedCount: result.modifiedCount,
        status,
      },
      `Successfully updated ${result.modifiedCount} applications`
    );
  }
);

/**
 * Get application statistics
 */
export const getApplicationStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.query;

    const filter: any = {};
    if (jobId) filter.jobId = jobId;

    const stats = await Application.aggregate([
      { $match: filter },
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],
          bySource: [
            {
              $group: {
                _id: '$source',
                count: { $sum: 1 },
              },
            },
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
        acc[item._id] = item.count;
        return acc;
      }, {}),
      bySource: stats[0].bySource.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };

    successResponse(res, result, 'Application statistics retrieved successfully');
  }
);
