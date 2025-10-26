import { Request, Response } from 'express';
import { TeamMember, User } from '../models';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Get all team members with filters and pagination
 */
export const getTeamMembers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      jobId,
      userId,
      role,
      isActive,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as any;

    // Build filter
    const filter: any = {};
    if (jobId) filter.jobId = jobId;
    if (userId) filter.userId = userId;
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Get total count
    const totalCount = await TeamMember.countDocuments(filter);

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
    const teamMembers = await TeamMember.find(filter)
      .populate('userId', 'firstName lastName email avatar role')
      .populate('jobId', 'title clientId')
      .populate('addedBy', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    successResponse(
      res,
      {
        teamMembers,
        pagination,
      },
      'Team members retrieved successfully'
    );
  }
);

/**
 * Get single team member by ID
 */
export const getTeamMemberById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const teamMember = await TeamMember.findById(id)
      .populate('userId', 'firstName lastName email avatar role')
      .populate('jobId', 'title clientId location')
      .populate('addedBy', 'firstName lastName email');

    if (!teamMember) {
      throw new NotFoundError('Team member not found');
    }

    successResponse(res, teamMember, 'Team member retrieved successfully');
  }
);

/**
 * Create new team member
 */
export const createTeamMember = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = req.body;

    // Verify user exists
    const user = await User.findById(data.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Create team member
    const teamMember = await TeamMember.create({
      ...data,
      addedBy: req.user?._id,
    });

    // Populate references
    await teamMember.populate([
      { path: 'userId', select: 'firstName lastName email avatar role' },
      { path: 'jobId', select: 'title clientId' },
      { path: 'addedBy', select: 'firstName lastName email' },
    ]);

    logger.info(`Team member added: ${user.email} to job ${data.jobId} by ${req.user?.email}`);

    successResponse(res, teamMember, 'Team member added successfully', 201);
  }
);

/**
 * Update team member
 */
export const updateTeamMember = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating certain fields
    delete updates.userId;
    delete updates.jobId;
    delete updates.addedBy;
    delete updates.createdAt;
    delete updates.updatedAt;

    const teamMember = await TeamMember.findByIdAndUpdate(
      id,
      { ...updates },
      { new: true, runValidators: true }
    ).populate([
      { path: 'userId', select: 'firstName lastName email avatar role' },
      { path: 'jobId', select: 'title clientId' },
      { path: 'addedBy', select: 'firstName lastName email' },
    ]);

    if (!teamMember) {
      throw new NotFoundError('Team member not found');
    }

    logger.info(`Team member updated: ${id} by ${req.user?.email}`);

    successResponse(res, teamMember, 'Team member updated successfully');
  }
);

/**
 * Delete team member (soft delete)
 */
export const deleteTeamMember = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const teamMember = await TeamMember.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!teamMember) {
      throw new NotFoundError('Team member not found');
    }

    logger.info(`Team member removed: ${id} by ${req.user?.email}`);

    successResponse(res, teamMember, 'Team member removed successfully');
  }
);

/**
 * Get team members for a specific job
 */
export const getJobTeamMembers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;

    const teamMembers = await TeamMember.find({ jobId, isActive: true })
      .populate('userId', 'firstName lastName email avatar role')
      .populate('addedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    successResponse(res, teamMembers, 'Job team members retrieved successfully');
  }
);
