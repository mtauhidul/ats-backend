import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Application, Candidate, Job, Pipeline } from '../models';
import openaiService from '../services/openai.service';
import cloudinaryService from '../services/cloudinary.service';
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
 * Transform application for frontend compatibility
 * Maps backend field names to frontend expected names
 */
const transformApplication = (app: any) => {
  const transformed = app.toObject ? app.toObject() : app;
  
  return {
    ...transformed,
    id: transformed._id,
    targetJobId: transformed.jobId || null,
    targetClientId: transformed.clientId || null,
    submittedAt: transformed.appliedAt || transformed.createdAt,
    lastUpdated: transformed.updatedAt,
  };
};

/**
 * Create new application
 * Supports all three submission methods
 */
export const createApplication = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreateApplicationInput = req.body;

    let job = null;

    // Verify job exists if jobId is provided
    if (data.jobId) {
      job = await Job.findById(data.jobId);
      if (!job) {
        throw new NotFoundError('Job not found');
      }

      // Check for duplicate application for this job
      const existingApplication = await Application.findOne({
        jobId: data.jobId,
        email: data.email,
      });

      if (existingApplication) {
        throw new CustomValidationError(
          `Application already exists for this job with email: ${data.email}`
        );
      }

      // Set clientId from job if not provided
      if (!data.clientId && job.clientId) {
        data.clientId = job.clientId.toString();
      }
    }

    // If email_automation source, verify sourceEmailAccountId is provided
    if (data.source === 'email_automation' && !data.sourceEmailAccountId) {
      throw new CustomValidationError(
        'sourceEmailAccountId is required for email_automation source'
      );
    }

    // Create application
    const application = await Application.create(data);

    // Populate references
    await application.populate([
      { path: 'jobId', select: 'title location employmentType' },
      { path: 'clientId', select: 'companyName logo' },
      { path: 'sourceEmailAccountId', select: 'name email' },
    ]);

    const jobInfo = job ? `for job ${job.title}` : 'without job assignment';
    logger.info(
      `Application created: ${application.email} ${jobInfo} via ${data.source}`
    );

    successResponse(res, transformApplication(application), 'Application created successfully', 201);
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
        applications: applications.map(transformApplication),
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

    successResponse(res, transformApplication(application), 'Application retrieved successfully');
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

    successResponse(res, transformApplication(application), 'Application updated successfully');
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

    // Delete resume from Cloudinary if exists
    if (application.resumeUrl) {
      try {
        // Extract public ID from Cloudinary URL
        // URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{version}/{public_id}.{format}
        const urlParts = application.resumeUrl.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        if (uploadIndex !== -1 && urlParts.length > uploadIndex + 1) {
          // Get everything after 'upload/' and before the file extension
          const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join('/');
          const publicId = publicIdWithExtension.split('.')[0];
          
          await cloudinaryService.deleteFile(publicId, 'raw');
          logger.info(`Deleted resume from Cloudinary: ${publicId}`);
        }
      } catch (error) {
        logger.error('Error deleting resume from Cloudinary:', error);
        // Continue with application deletion even if Cloudinary deletion fails
      }
    }

    // Delete additional documents from Cloudinary if exists
    if (application.additionalDocuments && application.additionalDocuments.length > 0) {
      for (const doc of application.additionalDocuments) {
        if (doc.url) {
          try {
            const urlParts = doc.url.split('/');
            const uploadIndex = urlParts.indexOf('upload');
            if (uploadIndex !== -1 && urlParts.length > uploadIndex + 1) {
              const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join('/');
              const publicId = publicIdWithExtension.split('.')[0];
              
              await cloudinaryService.deleteFile(publicId, 'raw');
              logger.info(`Deleted document from Cloudinary: ${publicId}`);
            }
          } catch (error) {
            logger.error('Error deleting document from Cloudinary:', error);
            // Continue with deletion
          }
        }
      }
    }

    // Delete application from database
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
 * Bulk delete applications
 */
export const bulkDeleteApplications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { applicationIds }: { applicationIds: string[] } = req.body;

    // Validate all IDs
    const validIds = applicationIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length !== applicationIds.length) {
      throw new CustomValidationError('Some application IDs are invalid');
    }

    // Get all applications to delete
    const applications = await Application.find({ _id: { $in: validIds } });

    if (applications.length === 0) {
      throw new NotFoundError('No applications found with provided IDs');
    }

    // Check if any application has been approved (converted to candidate)
    const candidateCheck = await Candidate.findOne({ 
      applicationId: { $in: validIds } 
    });
    
    if (candidateCheck) {
      throw new CustomValidationError(
        'Cannot delete applications that have been approved as candidates'
      );
    }

    let deletedFilesCount = 0;

    // Delete files from Cloudinary for each application
    for (const application of applications) {
      // Delete resume from Cloudinary if exists
      if (application.resumeUrl) {
        try {
          const urlParts = application.resumeUrl.split('/');
          const uploadIndex = urlParts.indexOf('upload');
          if (uploadIndex !== -1 && urlParts.length > uploadIndex + 1) {
            const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join('/');
            const publicId = publicIdWithExtension.split('.')[0];
            
            await cloudinaryService.deleteFile(publicId, 'raw');
            deletedFilesCount++;
          }
        } catch (error) {
          logger.error(`Error deleting resume from Cloudinary for application ${application._id}:`, error);
        }
      }

      // Delete additional documents from Cloudinary if exists
      if (application.additionalDocuments && application.additionalDocuments.length > 0) {
        for (const doc of application.additionalDocuments) {
          if (doc.url) {
            try {
              const urlParts = doc.url.split('/');
              const uploadIndex = urlParts.indexOf('upload');
              if (uploadIndex !== -1 && urlParts.length > uploadIndex + 1) {
                const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join('/');
                const publicId = publicIdWithExtension.split('.')[0];
                
                await cloudinaryService.deleteFile(publicId, 'raw');
                deletedFilesCount++;
              }
            } catch (error) {
              logger.error(`Error deleting document from Cloudinary:`, error);
            }
          }
        }
      }
    }

    // Delete all applications from database
    const result = await Application.deleteMany({ _id: { $in: validIds } });

    logger.info(`Bulk deleted ${result.deletedCount} applications and ${deletedFilesCount} files from Cloudinary`);

    successResponse(
      res,
      {
        deletedCount: result.deletedCount,
        deletedFilesCount,
      },
      `Successfully deleted ${result.deletedCount} applications`
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
