import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Candidate, Job } from '../models';
import openaiService from '../services/openai.service';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError, ValidationError as CustomValidationError } from '../utils/errors';
import logger from '../utils/logger';
import {
  CreateCandidateInput,
  UpdateCandidateInput,
  ListCandidatesQuery,
  MoveCandidateStageInput,
  RescoreCandidateInput,
  BulkMoveCandidatesInput,
} from '../types/candidate.types';

/**
 * Create new candidate (manual entry)
 */
export const createCandidate = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreateCandidateInput = req.body;

    // Verify job exists
    const job = await Job.findById(data.jobId);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    // Check for duplicate candidate - using email only since candidate can apply to multiple jobs
    const existingCandidate = await Candidate.findOne({
      email: data.email,
    });

    if (existingCandidate) {
      // Check if already applied to this job
      if (existingCandidate.jobIds.some(id => id.toString() === data.jobId)) {
        throw new CustomValidationError(
          `Candidate already exists for this job with email: ${data.email}`
        );
      }
    }

    // Create candidate
    const candidate = await Candidate.create({
      ...data,
      jobIds: [data.jobId], // First job
      status: data.status || 'active',
      source: 'manual_import',
      jobApplications: [{
        jobId: data.jobId,
        status: data.status || 'active',
        appliedAt: new Date(),
        lastStatusChange: new Date(),
        emailIds: [],
        emailsSent: 0,
        emailsReceived: 0,
      }],
    });

    // Populate references
    await candidate.populate([
      { path: 'jobIds', select: 'title location employmentType' },
      { path: 'applicationId', select: 'source appliedAt' },
    ]);

    logger.info(`Candidate created manually: ${candidate.email} for job ${job.title}`);

    successResponse(res, candidate, 'Candidate created successfully', 201);
  }
);

/**
 * Get all candidates with filters and pagination
 */
export const getCandidates = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      jobId,
      status,
      currentStage,
      minScore,
      maxScore,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as any as ListCandidatesQuery;

    // Build filter
    const filter: any = {};
    if (jobId) filter.jobIds = jobId; // Check if jobId is in the array
    if (status) filter.status = status;
    if (currentStage) filter.currentPipelineStageId = currentStage;
    
    // AI Score filtering
    if (minScore !== undefined || maxScore !== undefined) {
      filter['aiScore.overallScore'] = {};
      if (minScore !== undefined) filter['aiScore.overallScore'].$gte = minScore;
      if (maxScore !== undefined) filter['aiScore.overallScore'].$lte = maxScore;
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const totalCount = await Candidate.countDocuments(filter);

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

    // Fetch data with nested population
    const candidates = await Candidate.find(filter)
      .populate({
        path: 'jobIds',
        select: 'title location employmentType clientId',
        populate: {
          path: 'clientId',
          select: 'companyName logo email industry'
        }
      })
      .populate('applicationId', 'source appliedAt')
      .populate('assignedTo', 'firstName lastName email avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() for better performance with plain objects

    logger.info(`Found ${candidates.length} candidates`);

    // Manually populate currentStage for each candidate
    const { Pipeline } = await import('../models/Pipeline');
    
    const candidatesWithStage = await Promise.all(
      candidates.map(async (candidate: any) => {
        if (candidate.currentPipelineStageId) {
          try {
            const pipeline = await Pipeline.findOne({
              'stages._id': candidate.currentPipelineStageId
            });
            
            if (pipeline) {
              const stageId = candidate.currentPipelineStageId.toString();
              const stage = pipeline.stages.find(
                (s: any) => s._id.toString() === stageId
              );
              
              if (stage) {
                candidate.currentStage = {
                  id: stage._id.toString(),
                  name: stage.name,
                  color: stage.color,
                  order: stage.order,
                };
                logger.info(`Populated stage "${stage.name}" for candidate ${candidate.firstName} ${candidate.lastName}`);
              }
            }
          } catch (error) {
            logger.error('Error populating stage for candidate:', error);
          }
        }
        
        return candidate;
      })
    );

    successResponse(
      res,
      {
        candidates: candidatesWithStage,
        pagination,
      },
      'Candidates retrieved successfully'
    );
  }
);

/**
 * Get single candidate by ID
 */
export const getCandidateById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const candidate = await Candidate.findById(id)
      .populate({
        path: 'jobIds',
        select: 'title description location employmentType salaryRange requirements skills clientId',
        populate: {
          path: 'clientId',
          select: 'companyName logo email industry address'
        }
      })
      .populate({
        path: 'jobApplications.jobId',
        select: 'title description location employmentType salaryRange requirements skills clientId',
        populate: {
          path: 'clientId',
          select: 'companyName logo email industry address'
        }
      })
      .populate('applicationId', 'source appliedAt resumeUrl parsedData')
      .populate('assignedTo', 'firstName lastName email avatar');

    if (!candidate) {
      throw new NotFoundError('Candidate not found');
    }

    // Get the current pipeline stage name if available
    let currentStage = null;
    if (candidate.currentPipelineStageId) {
      const Pipeline = (await import('../models/Pipeline')).Pipeline;
      const pipeline = await Pipeline.findOne({
        'stages._id': candidate.currentPipelineStageId
      });
      
      if (pipeline) {
        const stage = pipeline.stages.find(
          (s: any) => s._id.toString() === candidate.currentPipelineStageId?.toString()
        );
        if (stage) {
          currentStage = {
            id: stage._id,
            name: stage.name,
            color: stage.color,
            order: stage.order
          };
        }
      }
    }

    // Add currentStage to response
    const candidateData: any = candidate.toJSON();
    if (currentStage) {
      candidateData.currentStage = currentStage;
    }

    successResponse(res, candidateData, 'Candidate retrieved successfully');
  }
);

/**
 * Update candidate
 */
export const updateCandidate = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates: UpdateCandidateInput = req.body;

    const candidate = await Candidate.findById(id);

    if (!candidate) {
      throw new NotFoundError('Candidate not found');
    }

    // Check if email is being changed and if it creates a duplicate
    if (updates.email && updates.email !== candidate.email) {
      const existingCandidate = await Candidate.findOne({
        email: updates.email,
        _id: { $ne: id },
      });

      if (existingCandidate) {
        throw new CustomValidationError(
          `Candidate already exists with email: ${updates.email}`
        );
      }
    }

    // Update fields
    Object.assign(candidate, updates);
    await candidate.save();

    // Populate references
    await candidate.populate([
      { path: 'jobIds', select: 'title location employmentType' },
      { path: 'applicationId', select: 'source appliedAt' },
      { path: 'assignedTo', select: 'firstName lastName email avatar' },
    ]);

    logger.info(`Candidate updated: ${candidate.email}`);

    successResponse(res, candidate, 'Candidate updated successfully');
  }
);

/**
 * Delete candidate
 */
export const deleteCandidate = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const candidate = await Candidate.findById(id);

    if (!candidate) {
      throw new NotFoundError('Candidate not found');
    }

    // Check if candidate is hired (might want to prevent deletion)
    if (candidate.status === 'hired') {
      throw new CustomValidationError(
        'Cannot delete a hired candidate. Please change status first.'
      );
    }

    await candidate.deleteOne();

    logger.info(`Candidate deleted: ${candidate.email}`);

    successResponse(res, null, 'Candidate deleted successfully');
  }
);

/**
 * Move candidate to different pipeline stage
 */
export const moveCandidateStage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { newStage, notes }: MoveCandidateStageInput = req.body;

    const candidate = await Candidate.findById(id);

    if (!candidate) {
      throw new NotFoundError('Candidate not found');
    }

    // Update stage - newStage is the stage ID (ObjectId)
    candidate.currentPipelineStageId = newStage as any;
    if (notes) {
      candidate.notes = candidate.notes ? `${candidate.notes}\n\n${notes}` : notes;
    }
    await candidate.save();

    logger.info(`Candidate ${candidate.email} moved to stage: ${newStage}`);

    successResponse(res, candidate, 'Candidate stage updated successfully');
  }
);

/**
 * Re-score candidate against a job
 */
export const rescoreCandidate = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { jobId }: RescoreCandidateInput = req.body;

    const candidate = await Candidate.findById(id).populate('applicationId');

    if (!candidate) {
      throw new NotFoundError('Candidate not found');
    }

    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    logger.info(`Re-scoring candidate: ${candidate.email} against job ${job.title}`);

    // Get parsed data from application if available
    let parsedData: any = {
      summary: '',
      skills: [],
      experience: [],
      education: [],
      certifications: [],
      languages: [],
      extractedText: '',
    };

    if (candidate.applicationId) {
      const application = candidate.applicationId as any;
      if (application.parsedData) {
        parsedData = {
          ...application.parsedData,
          extractedText: '',
        };
      }
    }

    // Perform AI scoring
    const aiScore = await openaiService.scoreCandidate(
      parsedData,
      job.description || '',
      job.requirements || []
    );

    // Update candidate with new score including the additional fields
    candidate.aiScore = {
      ...aiScore,
      scoredForJobId: jobId as any,
      scoredAt: new Date(),
    };
    await candidate.save();

    logger.info(
      `Candidate re-scored: ${candidate.email} with score: ${aiScore.overallScore}`
    );

    successResponse(res, candidate, 'Candidate re-scored successfully');
  }
);

/**
 * Bulk move candidates to new stage
 */
export const bulkMoveCandidates = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { candidateIds, newStage, notes }: BulkMoveCandidatesInput = req.body;

    // Validate all IDs
    const validIds = candidateIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length !== candidateIds.length) {
      throw new CustomValidationError('Some candidate IDs are invalid');
    }

    // Update candidates - newStage is the stage ID
    const updateData: any = { currentPipelineStageId: newStage };
    if (notes) {
      updateData.$push = { notes };
    }

    const result = await Candidate.updateMany(
      { _id: { $in: validIds } },
      updateData
    );

    logger.info(`Bulk moved ${result.modifiedCount} candidates to stage: ${newStage}`);

    successResponse(
      res,
      {
        modifiedCount: result.modifiedCount,
        newStage,
      },
      `Successfully moved ${result.modifiedCount} candidates`
    );
  }
);

/**
 * Add candidates to a pipeline (assign to first stage)
 * Used when adding candidates from pipeline page
 */
export const addCandidatesToPipeline = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { candidateIds, pipelineId, jobId } = req.body;

    // Validate inputs
    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      throw new CustomValidationError('candidateIds must be a non-empty array');
    }

    if (!pipelineId) {
      throw new CustomValidationError('pipelineId is required');
    }

    // Validate all candidate IDs
    const validIds = candidateIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length !== candidateIds.length) {
      throw new CustomValidationError('Some candidate IDs are invalid');
    }

    // Get the pipeline and its first stage
    const Pipeline = (await import('../models/Pipeline')).Pipeline;
    const pipeline = await Pipeline.findById(pipelineId);

    if (!pipeline) {
      throw new NotFoundError('Pipeline not found');
    }

    if (!pipeline.stages || pipeline.stages.length === 0) {
      throw new CustomValidationError('Pipeline has no stages defined');
    }

    // Get the first stage (sorted by order)
    const sortedStages = pipeline.stages.sort((a: any, b: any) => a.order - b.order);
    const firstStage = sortedStages[0];

    logger.info(`Adding ${validIds.length} candidates to pipeline ${pipeline.name}, first stage: ${firstStage.name}`);

    // If jobId is provided, verify candidates belong to this job
    if (jobId) {
      const candidatesToUpdate = await Candidate.find({
        _id: { $in: validIds },
        jobIds: jobId
      });

      if (candidatesToUpdate.length !== validIds.length) {
        throw new CustomValidationError('Some candidates do not belong to the specified job');
      }
    }

    // Update candidates - assign to first stage
    const result = await Candidate.updateMany(
      { _id: { $in: validIds } },
      { 
        currentPipelineStageId: firstStage._id,
        updatedBy: (req as any).user?.id
      }
    );

    logger.info(`Successfully added ${result.modifiedCount} candidates to pipeline ${pipeline.name}`);

    successResponse(
      res,
      {
        modifiedCount: result.modifiedCount,
        pipelineId,
        stageName: firstStage.name,
        stageId: firstStage._id
      },
      `Successfully added ${result.modifiedCount} candidates to pipeline`
    );
  }
);

/**
 * Get candidates for a job that are not in any pipeline
 * Used for the "Add to Pipeline" modal
 */
export const getCandidatesWithoutPipeline = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.query;

    if (!jobId) {
      throw new CustomValidationError('jobId is required');
    }

    // Find candidates for this job that have no pipeline stage assigned
    const candidates = await Candidate.find({
      jobIds: jobId,
      $or: [
        { currentPipelineStageId: null },
        { currentPipelineStageId: { $exists: false } }
      ]
    })
    .select('firstName lastName email phone avatar skills aiScore status createdAt')
    .sort({ createdAt: -1 });

    logger.info(`Found ${candidates.length} candidates without pipeline for job ${jobId}`);

    successResponse(
      res,
      candidates,
      `Found ${candidates.length} candidates without pipeline assignment`
    );
  }
);

/**
 * Get candidate statistics
 */
export const getCandidateStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.query;

    const filter: any = {};
    if (jobId) filter.jobIds = jobId;

    const stats = await Candidate.aggregate([
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
          byStage: [
            {
              $group: {
                _id: '$currentPipelineStageId',
                count: { $sum: 1 },
              },
            },
          ],
          averageScore: [
            {
              $group: {
                _id: null,
                avgOverallScore: { $avg: '$aiScore.overallScore' },
                avgSkillsMatch: { $avg: '$aiScore.skillsMatch' },
                avgExperienceMatch: { $avg: '$aiScore.experienceMatch' },
                avgEducationMatch: { $avg: '$aiScore.educationMatch' },
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
      byStage: stats[0].byStage.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      averageScores: stats[0].averageScore[0] || {
        avgOverallScore: 0,
        avgSkillsMatch: 0,
        avgExperienceMatch: 0,
        avgEducationMatch: 0,
      },
    };

    successResponse(res, result, 'Candidate statistics retrieved successfully');
  }
);

/**
 * Get top candidates by AI score
 */
export const getTopCandidates = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { jobId, limit = '10' } = req.query;

    const filter: any = { status: 'active' };
    if (jobId) filter.jobIds = jobId;

    const candidates = await Candidate.find(filter)
      .populate('jobIds', 'title location')
      .sort({ 'aiScore.overallScore': -1 })
      .limit(parseInt(limit as string, 10));

    successResponse(res, candidates, 'Top candidates retrieved successfully');
  }
);

/**
 * Get dashboard analytics
 * Returns candidate applications grouped by date for chart
 */
export const getDashboardAnalytics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { days = '90' } = req.query;
    const daysNum = parseInt(days as string, 10);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Aggregate candidates by date
    const analytics = await Candidate.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 },
          sources: { $push: "$source" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Format the data for the chart
    const chartData = analytics.map(item => ({
      date: item._id,
      applications: item.count,
      // Group by source type if needed
      directSubmissions: item.sources.filter((s: string) => s === 'direct_submission' || s === 'manual_import').length,
      emailApplications: item.sources.filter((s: string) => s === 'email' || s === 'email_application').length,
    }));

    successResponse(res, chartData, 'Dashboard analytics retrieved successfully');
  }
);
