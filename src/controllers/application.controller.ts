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
 * 
 * WORKFLOW:
 * 1. Application Stage (this endpoint):
 *    - Requires: firstName, lastName, email, resumeUrl, resumeOriginalName
 *    - Optional: jobId (if mentioned in email), phone, parsedData, resumeRawText, videoIntroUrl
 *    - Status: 'pending' (awaiting review)
 *    - NOT required: clientId (will be auto-fetched from job during approval)
 * 
 * 2. Approval Stage (approveApplication endpoint):
 *    - Recruiter reviews application
 *    - Assigns jobId (if not already provided)
 *    - System automatically fetches clientId from the job
 *    - Creates Candidate with job application record
 *    - Status changes to 'approved'
 * 
 * Supports all three submission methods: manual, direct_apply, email_automation
 */
export const createApplication = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreateApplicationInput = req.body;

    let job = null;

    // Verify job exists if jobId is provided (optional at application stage)
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

    // AI Resume Validation (if resume text is provided)
    let validationResult = null;
    if (data.resumeRawText && data.resumeRawText.trim().length > 0) {
      try {
        logger.info('Running AI validation on resume...');
        validationResult = await openaiService.validateResume(data.resumeRawText);
        
        // Add validation results to data
        data.isValidResume = validationResult.isValid;
        data.validationScore = validationResult.score;
        data.validationReason = validationResult.reason;
        
        logger.info(
          `Resume validation: ${validationResult.isValid ? 'VALID' : 'INVALID'} ` +
          `(score: ${validationResult.score}/100) - ${validationResult.reason}`
        );
      } catch (error: any) {
        logger.error('Resume validation failed:', error);
        // Don't block application creation if validation fails
        // Set to null to indicate validation couldn't be performed
        data.isValidResume = null;
        data.validationScore = null;
        data.validationReason = 'Validation service unavailable';
      }
    } else {
      logger.warn('No resume text provided for validation');
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
      .populate('clientId', 'companyName logo')
      .populate('sourceEmailAccountId', 'name email')
      .populate('teamMembers', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean for better performance

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
      .populate('clientId', 'companyName logo website industry')
      .populate('sourceEmailAccountId', 'name email')
      .populate('candidateId', 'firstName lastName email status currentStage aiScore')
      .populate('teamMembers', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email');

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
    
    // If status is being changed to approved or rejected, set reviewedBy to current user
    if (updates.status && ['approved', 'rejected'].includes(updates.status.toLowerCase())) {
      if ((req as any).user && (req as any).user.id) {
        application.reviewedBy = (req as any).user.id;
      }
    }
    
    await application.save();

    // Populate references
    await application.populate([
      { path: 'jobId', select: 'title location employmentType' },
      { path: 'clientId', select: 'name logo' },
      { path: 'reviewedBy', select: 'firstName lastName email' },
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
    const { jobId, assignToPipeline, notes }: ApproveApplicationInput = req.body;

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

    if (assignToPipeline) {
      pipeline = await Pipeline.findById(assignToPipeline);
      if (!pipeline) {
        throw new NotFoundError('Pipeline not found');
      }
      logger.info(`Using provided pipeline: ${pipeline.name} (ID: ${pipeline._id})`);
    } else if (job.pipelineId) {
      pipeline = await Pipeline.findById(job.pipelineId);
      logger.info(`Job has pipeline: ${pipeline ? pipeline.name : 'NOT FOUND'} (ID: ${job.pipelineId})`);
    } else {
      logger.info(`Job has NO pipeline assigned (job.pipelineId is null/undefined)`);
    }

    // Debug: Log pipeline details
    if (pipeline) {
      console.log('=== PIPELINE DEBUG ===');
      console.log('Pipeline ID:', pipeline._id);
      console.log('Pipeline Name:', pipeline.name);
      console.log('Has stages:', !!pipeline.stages);
      console.log('Stages count:', pipeline.stages?.length || 0);
      if (pipeline.stages && pipeline.stages.length > 0) {
        console.log('First stage:', JSON.stringify({
          id: pipeline.stages[0]._id,
          name: pipeline.stages[0].name,
          order: pipeline.stages[0].order
        }));
      }
      console.log('======================');
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

    // Debug: Log parsedData before creating candidate
    console.log('Creating candidate from application:', {
      applicationId: application._id,
      hasParsedData: !!application.parsedData,
      parsedDataKeys: application.parsedData ? Object.keys(application.parsedData) : [],
      skillsCount: application.parsedData?.skills?.length || 0,
      experienceCount: application.parsedData?.experience?.length || 0,
      educationCount: application.parsedData?.education?.length || 0,
      skillsSample: application.parsedData?.skills?.[0],
      experienceSample: JSON.stringify(application.parsedData?.experience?.[0]),
      educationSample: JSON.stringify(application.parsedData?.education?.[0]),
    });

    // Helper function to calculate years of experience from experience array
    const calculateYearsOfExperience = (experiences: any[]): number => {
      if (!experiences || experiences.length === 0) return 0;
      
      let totalMonths = 0;
      
      for (const exp of experiences) {
        if (!exp.duration) continue;
        
        // Parse duration like "Nov 2020 - Oct 2025" or "2020 - 2025" or "Nov 2020 - Present"
        const durationStr = exp.duration.trim();
        
        // Handle "Present" or "Current"
        const isPresentJob = /present|current/i.test(durationStr);
        
        // Try to extract dates
        const dateMatch = durationStr.match(/(\w+\s+)?(\d{4})\s*[-–]\s*(\w+\s+)?(\d{4}|present|current)/i);
        
        if (dateMatch) {
          const startYear = parseInt(dateMatch[2]);
          const startMonth = dateMatch[1] ? new Date(dateMatch[1] + ' 1').getMonth() : 0;
          
          let endYear: number;
          let endMonth: number;
          
          if (isPresentJob) {
            const now = new Date();
            endYear = now.getFullYear();
            endMonth = now.getMonth();
          } else {
            endYear = parseInt(dateMatch[4]);
            endMonth = dateMatch[3] ? new Date(dateMatch[3] + ' 1').getMonth() : 11;
          }
          
          const months = (endYear - startYear) * 12 + (endMonth - startMonth);
          totalMonths += Math.max(0, months);
        }
      }
      
      // Convert to years (rounded to 1 decimal)
      return Math.round((totalMonths / 12) * 10) / 10;
    };

    // Helper function to filter certifications (remove skill descriptions)
    const filterCertifications = (certifications: string[]): string[] => {
      if (!certifications || certifications.length === 0) return [];
      
      return certifications.filter((cert: string) => {
        // Remove items that are too long (likely skill descriptions, not cert names)
        if (cert.length > 100) return false;
        
        // Remove items that contain phrases like "proficient in", "strong foundation", "experience with"
        const skillPhrases = /proficient in|strong foundation|experience with|skilled in|expertise in|knowledge of/i;
        if (skillPhrases.test(cert)) return false;
        
        return true;
      });
    };

    // Get the first stage of the pipeline (if pipeline exists)
    let firstStageId = null;
    if (pipeline && pipeline.stages && pipeline.stages.length > 0) {
      // Sort stages by order and get the first one
      const sortedStages = pipeline.stages.sort((a: any, b: any) => a.order - b.order);
      firstStageId = sortedStages[0]._id;
      logger.info(`Assigning candidate to first stage: ${sortedStages[0].name} (ID: ${firstStageId})`);
    } else if (pipeline) {
      logger.warn(`Pipeline ${pipeline._id} has no stages defined`);
    } else {
      logger.info('No pipeline assigned - candidate will need to be added to pipeline manually');
    }

    // Prepare candidate data
    const candidateData: any = {
      applicationId: application._id,
      jobIds: [jobId],
      firstName: application.firstName,
      lastName: application.lastName,
      email: application.email,
      phone: application.phone,
      resumeUrl: application.resumeUrl,
      resumeOriginalName: application.resumeOriginalName,
      currentPipelineStageId: firstStageId, // Assign to first stage, not pipeline ID
      status: 'active',
      aiScore,
      notes: notes || application.notes,
      source: 'application',
      createdBy: (req as any).user.id,
      jobApplications: [{
        jobId: jobId,
        applicationId: application._id,
        status: 'active',
        appliedAt: application.createdAt || new Date(),
        lastStatusChange: new Date(),
        resumeScore: aiScore?.overallScore,
        emailIds: [],
        emailsSent: 0,
        emailsReceived: 0,
      }],
    };

    // Copy parsed resume data from application if it exists
    if (application.parsedData) {
      if (application.parsedData.summary) {
        candidateData.summary = application.parsedData.summary;
      }
      if (application.parsedData.skills && application.parsedData.skills.length > 0) {
        candidateData.skills = [...application.parsedData.skills];
      }
      if (application.parsedData.experience && application.parsedData.experience.length > 0) {
        // Map experience data and fix empty company names
        candidateData.experience = application.parsedData.experience.map((exp: any) => {
          let company = exp.company || '';
          
          // If company is empty, try to extract from description or title
          if (!company && exp.description) {
            const companyMatch = exp.description.match(/(?:at|@|for)\s+([A-Z][a-zA-Z\s&]+?)(?:\s*[-–]|\s*,|\s*$)/);
            if (companyMatch) {
              company = companyMatch[1].trim();
            }
          }
          
          return {
            company,
            title: exp.title || '',
            duration: exp.duration || '',
            description: exp.description || '',
          };
        });
        
        // Calculate years of experience from actual work history
        const calculatedYears = calculateYearsOfExperience(candidateData.experience);
        if (calculatedYears > 0) {
          candidateData.yearsOfExperience = calculatedYears;
        }
      }
      if (application.parsedData.education && application.parsedData.education.length > 0) {
        candidateData.education = application.parsedData.education.map((edu: any) => {
          // Ensure field contains actual field of study, not degree type
          let field = edu.field || '';
          
          // If field is a degree type (bachelors, masters, etc.), try to find actual field
          if (/^(bachelor|master|phd|doctorate|associate|diploma)/i.test(field) && edu.degree) {
            // Try to extract field from degree
            const fieldMatch = edu.degree.match(/in\s+([^,]+)/i);
            if (fieldMatch) {
              field = fieldMatch[1].trim();
            } else if (edu.institution) {
              // Check if institution name has field info
              const instFieldMatch = edu.institution.match(/of\s+([^,]+)/i);
              if (instFieldMatch) {
                field = instFieldMatch[1].trim();
              }
            }
          }
          
          return {
            institution: edu.institution || '',
            degree: edu.degree || '',
            field,
            year: edu.year || '',
          };
        });
      }
      if (application.parsedData.certifications && application.parsedData.certifications.length > 0) {
        // Filter out skill descriptions from certifications
        candidateData.certifications = filterCertifications(application.parsedData.certifications);
      }
      if (application.parsedData.languages && application.parsedData.languages.length > 0) {
        candidateData.languages = [...application.parsedData.languages];
      }
    }

    // Create candidate
    const candidate = await Candidate.create(candidateData);
    
    console.log('=== CANDIDATE CREATED ===');
    console.log('Candidate ID:', candidate._id);
    console.log('Candidate Name:', `${candidate.firstName} ${candidate.lastName}`);
    console.log('Job IDs:', candidate.jobIds);
    console.log('Current Pipeline Stage ID:', candidate.currentPipelineStageId);
    console.log('Status:', candidate.status);
    console.log('Skills Count:', candidate.skills?.length || 0);
    console.log('Experience Count:', candidate.experience?.length || 0);
    console.log('Education Count:', candidate.education?.length || 0);
    console.log('========================');

    // Update application status
    application.status = 'approved';
    application.approvedAt = new Date();
    
    // Set reviewedBy to current user
    if ((req as any).user && (req as any).user.id) {
      application.reviewedBy = (req as any).user.id;
    }
    
    await application.save();

    // Populate candidate data (skip pipeline stage to avoid schema issues)
    await candidate.populate([
      { path: 'jobIds', select: 'title location employmentType' },
      { path: 'applicationId', select: 'firstName lastName email' },
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
    
    // If status is approved or rejected, set reviewedBy to current user
    if (status && ['approved', 'rejected'].includes(status.toLowerCase())) {
      if ((req as any).user && (req as any).user.id) {
        updateData.reviewedBy = (req as any).user.id;
      }
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
