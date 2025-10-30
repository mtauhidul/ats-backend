import { Request, Response } from 'express';
import { Interview, Candidate, Job } from '../models';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError } from '../utils/errors';
import logger from '../utils/logger';
import zoomService from '../services/zoom.service';
import emailService from '../services/email.service';
import { logActivity } from '../services/activity.service';

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
      .populate('clientId', 'companyName')
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
      .populate('clientId', 'companyName')
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

    // Create Zoom meeting if requested and interview is video type
    if (data.createZoomMeeting && interview.type === 'video') {
      try {
        const zoomMeeting = await zoomService.createMeeting({
          topic: `${interview.title} - ${candidate.firstName} ${candidate.lastName}`,
          startTime: interview.scheduledAt,
          duration: interview.duration,
          timezone: interview.timezone,
          agenda: interview.description || `Interview for ${job.title}`,
        });

        interview.meetingLink = zoomMeeting.join_url;
        interview.meetingId = zoomMeeting.id;
        interview.meetingPassword = zoomMeeting.password;
        interview.zoomMeetingDetails = zoomMeeting;
        await interview.save();

        logger.info(`Zoom meeting created for interview: ${interview._id}`);
      } catch (error: any) {
        logger.error('Failed to create Zoom meeting:', error);
        // Don't fail the interview creation if Zoom fails
      }
    }

    // Populate references
    await interview.populate([
      { path: 'candidateId', select: 'firstName lastName email' },
      { path: 'jobId', select: 'title' },
      { path: 'clientId', select: 'name' },
      { path: 'interviewerIds', select: 'firstName lastName email avatar' },
      { path: 'organizerId', select: 'firstName lastName email' },
    ]);

    // Send email notification to candidate if sendEmail flag is true
    if (data.sendEmail) {
      try {
        const interviewerNames = interview.interviewerIds && Array.isArray(interview.interviewerIds)
          ? interview.interviewerIds
              .map((interviewer: any) => 
                `${interviewer.firstName || ''} ${interviewer.lastName || ''}`.trim()
              )
              .filter((name: string) => name.length > 0)
          : [];

        await emailService.sendInterviewNotificationEmail({
          candidateEmail: candidate.email,
          candidateName: `${candidate.firstName} ${candidate.lastName}`,
          jobTitle: job.title,
          interviewTitle: interview.title,
          interviewType: interview.type,
          scheduledAt: interview.scheduledAt,
          duration: interview.duration,
          meetingLink: interview.meetingLink,
          meetingPassword: interview.meetingPassword,
          interviewerNames: interviewerNames.length > 0 ? interviewerNames : undefined,
          isInstant: data.isInstant || false,
        });

        logger.info(`Interview notification email sent to candidate: ${candidate.email}`);
      } catch (error: any) {
        logger.error('Failed to send interview notification email:', error);
        // Don't fail the interview creation if email fails
      }
    }

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

/**
 * Create Zoom meeting for an interview
 */
export const createZoomMeeting = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const interview = await Interview.findById(id)
      .populate('candidateId', 'firstName lastName email')
      .populate('jobId', 'title');

    if (!interview) {
      throw new NotFoundError('Interview not found');
    }

    if (interview.meetingLink) {
      successResponse(res, interview, 'Interview already has a Zoom meeting');
      return;
    }

    // Create Zoom meeting
    const zoomMeeting = await zoomService.createMeeting({
      topic: `${interview.title} - ${(interview.candidateId as any).firstName} ${(interview.candidateId as any).lastName}`,
      startTime: interview.scheduledAt,
      duration: interview.duration,
      timezone: interview.timezone,
      agenda: interview.description || `Interview for ${(interview.jobId as any).title}`,
    });

    // Update interview with Zoom details
    interview.meetingLink = zoomMeeting.join_url;
    interview.meetingId = zoomMeeting.id;
    interview.meetingPassword = zoomMeeting.password;
    interview.zoomMeetingDetails = zoomMeeting;
    await interview.save();

    logger.info(`Zoom meeting created for interview ${id}`);

    successResponse(res, interview, 'Zoom meeting created successfully');
  }
);

/**
 * Complete interview and add review
 */
export const completeInterview = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { rating, feedback, recommendation, strengths, weaknesses } = req.body;

    // Validate required fields
    if (!feedback || !rating) {
      throw new Error('Feedback and rating are required');
    }

    // Find the interview
    const interview = await Interview.findById(id)
      .populate('candidateId', 'firstName lastName email')
      .populate('jobId', 'title')
      .populate('interviewerIds', 'firstName lastName email');

    if (!interview) {
      throw new NotFoundError('Interview not found');
    }

    // Update interview status and add feedback
    interview.status = 'completed';
    interview.completedAt = new Date();
    
    // Map recommendation to interview model format
    let mappedRecommendation: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no' = 'maybe';
    if (recommendation === 'hire') mappedRecommendation = 'strong_yes';
    else if (recommendation === 'reject') mappedRecommendation = 'no';
    else if (recommendation === 'hold') mappedRecommendation = 'maybe';
    else if (recommendation === 'pending') mappedRecommendation = 'maybe';
    
    // Add feedback to the interview (matching Interview model structure)
    const feedbackEntry = {
      interviewerId: req.user?._id as any,
      rating: Number(rating),
      strengths: strengths ? [strengths] : [],
      weaknesses: weaknesses ? [weaknesses] : [],
      comments: feedback,
      recommendation: mappedRecommendation,
      submittedAt: new Date(),
    };

    if (!interview.feedback) {
      interview.feedback = [];
    }
    interview.feedback.push(feedbackEntry);

    await interview.save();

    logger.info(`Interview ${id} completed by ${req.user?.email} with rating ${rating} and recommendation ${recommendation}`);

    // Log activity for the interviewer
    if (req.user?._id) {
      await logActivity({
        userId: req.user._id.toString(),
        action: 'completed_interview',
        resourceType: 'interview',
        resourceId: id,
        resourceName: `Interview for ${(interview.candidateId as any)?.firstName || 'Candidate'} ${(interview.candidateId as any)?.lastName || ''} - ${(interview.jobId as any)?.title || 'Position'}`,
        metadata: {
          rating,
          recommendation: mappedRecommendation,
          candidateId: interview.candidateId,
          jobId: interview.jobId,
        },
      });
    }

    // Populate the updated interview
    await interview.populate([
      { path: 'candidateId', select: 'firstName lastName email' },
      { path: 'jobId', select: 'title' },
      { path: 'interviewerIds', select: 'firstName lastName email avatar' },
      { path: 'feedback.interviewerId', select: 'firstName lastName email avatar' },
    ]);

    logger.info(`Interview ${id} completed by ${req.user?.email} with rating ${rating}`);

    successResponse(res, interview, 'Interview completed and review submitted successfully');
  }
);
