import { Request, Response } from 'express';
import { Interview, Candidate, Job } from '../models';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Get all interviews with filters and pagination
 */
export const getInterviews = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      candidateId,
      jobId,
      clientId,
      status,
      type,
      sortBy = 'scheduledAt',
      sortOrder = 'desc',
    } = req.query as any;

    // Build filter
    const filter: any = {};
    if (candidateId) filter.candidateId = candidateId;
    if (jobId) filter.jobId = jobId;
    if (clientId) filter.clientId = clientId;
    if (status) filter.status = status;
    if (type) filter.type = type;

    // Get total count
    const totalCount = await Interview.countDocuments(filter);

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
    const interviews = await Interview.find(filter)
      .populate('candidateId', 'firstName lastName email')
      .populate('jobId', 'title')
      .populate('clientId', 'name')
      .populate('interviewerIds', 'firstName lastName email avatar')
      .populate('organizerId', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    successResponse(
      res,
      {
        interviews,
        pagination,
      },
      'Interviews retrieved successfully'
    );
  }
);

/**
 * Get single interview by ID
 */
export const getInterviewById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const interview = await Interview.findById(id)
      .populate('candidateId', 'firstName lastName email phone')
      .populate('jobId', 'title description location')
      .populate('clientId', 'name')
      .populate('applicationId', 'resumeUrl')
      .populate('interviewerIds', 'firstName lastName email avatar role')
      .populate('organizerId', 'firstName lastName email')
      .populate('feedback.interviewerId', 'firstName lastName email avatar');

    if (!interview) {
      throw new NotFoundError('Interview not found');
    }

    successResponse(res, interview, 'Interview retrieved successfully');
  }
);

/**
 * Create new interview
 */
export const createInterview = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = req.body;

    // Verify candidate exists
    const candidate = await Candidate.findById(data.candidateId);
    if (!candidate) {
      throw new NotFoundError('Candidate not found');
    }

    // Verify job exists
    const job = await Job.findById(data.jobId);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    // Create interview
    const interview = await Interview.create({
      ...data,
      status: 'scheduled',
      createdBy: req.user?._id,
      organizerId: data.organizerId || req.user?._id,
    });

    // Populate references
    await interview.populate([
      { path: 'candidateId', select: 'firstName lastName email' },
      { path: 'jobId', select: 'title' },
      { path: 'clientId', select: 'name' },
      { path: 'interviewerIds', select: 'firstName lastName email avatar' },
      { path: 'organizerId', select: 'firstName lastName email' },
    ]);

    logger.info(`Interview created: ${interview.title} for candidate ${candidate.email} by ${req.user?.email}`);

    successResponse(res, interview, 'Interview scheduled successfully', 201);
  }
);

/**
 * Update interview
 */
export const updateInterview = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates = req.body;

    // Add updatedBy
    updates.updatedBy = req.user?._id;

    const interview = await Interview.findByIdAndUpdate(
      id,
      { ...updates },
      { new: true, runValidators: true }
    ).populate([
      { path: 'candidateId', select: 'firstName lastName email' },
      { path: 'jobId', select: 'title' },
      { path: 'clientId', select: 'name' },
      { path: 'interviewerIds', select: 'firstName lastName email avatar' },
      { path: 'organizerId', select: 'firstName lastName email' },
    ]);

    if (!interview) {
      throw new NotFoundError('Interview not found');
    }

    logger.info(`Interview updated: ${id} by ${req.user?.email}`);

    successResponse(res, interview, 'Interview updated successfully');
  }
);

/**
 * Cancel interview
 */
export const cancelInterview = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;

    const interview = await Interview.findByIdAndUpdate(
      id,
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        updatedBy: req.user?._id,
      },
      { new: true }
    ).populate([
      { path: 'candidateId', select: 'firstName lastName email' },
      { path: 'jobId', select: 'title' },
    ]);

    if (!interview) {
      throw new NotFoundError('Interview not found');
    }

    logger.info(`Interview cancelled: ${id} by ${req.user?.email}`);

    successResponse(res, interview, 'Interview cancelled successfully');
  }
);

/**
 * Add feedback to interview
 */
export const addFeedback = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const feedbackData = req.body;

    const interview = await Interview.findById(id);

    if (!interview) {
      throw new NotFoundError('Interview not found');
    }

    // Add feedback
    interview.feedback = interview.feedback || [];
    interview.feedback.push({
      interviewerId: req.user?._id,
      ...feedbackData,
      submittedAt: new Date(),
    });

    // If all interviewers provided feedback, mark as completed
    if (interview.feedback.length >= interview.interviewerIds.length) {
      interview.status = 'completed';
      interview.completedAt = new Date();
    }

    await interview.save();

    await interview.populate([
      { path: 'candidateId', select: 'firstName lastName email' },
      { path: 'feedback.interviewerId', select: 'firstName lastName email avatar' },
    ]);

    logger.info(`Feedback added to interview ${id} by ${req.user?.email}`);

    successResponse(res, interview, 'Feedback added successfully');
  }
);

/**
 * Delete interview
 */
export const deleteInterview = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const interview = await Interview.findByIdAndDelete(id);

    if (!interview) {
      throw new NotFoundError('Interview not found');
    }

    logger.info(`Interview deleted: ${id} by ${req.user?.email}`);

    successResponse(res, { id }, 'Interview deleted successfully');
  }
);

/**
 * Get upcoming interviews
 */
export const getUpcomingInterviews = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { limit = 10 } = req.query;

    const interviews = await Interview.find({
      scheduledAt: { $gte: new Date() },
      status: { $in: ['scheduled', 'confirmed'] },
    })
      .populate('candidateId', 'firstName lastName email')
      .populate('jobId', 'title')
      .populate('interviewerIds', 'firstName lastName email avatar')
      .sort({ scheduledAt: 1 })
      .limit(Number(limit));

    successResponse(res, interviews, 'Upcoming interviews retrieved successfully');
  }
);
