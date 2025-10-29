import { Request, Response } from 'express';
import { User, Candidate, TeamMember } from '../models';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Get all users with pagination and filters
 */
export const getUsers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      role,
      isActive,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as any;

    // Build filter
    const filter: any = {};
    if (role) filter.role = role;
    
    // Filter by active status if provided
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const totalCount = await User.countDocuments(filter);

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
    const users = await User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-__v');

    successResponse(
      res,
      {
        users,
        pagination,
      },
      'Users retrieved successfully'
    );
  }
);

/**
 * Get single user by ID
 */
export const getUserById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const user = await User.findById(id).select('-__v');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    successResponse(res, user, 'User retrieved successfully');
  }
);

/**
 * Get current user profile
 */
export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new NotFoundError('User not authenticated');
    }

    successResponse(res, req.user, 'Current user retrieved successfully');
  }
);

/**
 * Update user
 */
export const updateUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating sensitive fields
    delete updates.clerkId;
    delete updates.email;
    delete updates.createdAt;
    delete updates.updatedAt;

    // If role is being changed to admin, automatically grant all permissions
    if (updates.role === 'admin') {
      updates.permissions = {
        canManageClients: true,
        canManageJobs: true,
        canReviewApplications: true,
        canManageCandidates: true,
        canSendEmails: true,
        canManageTeam: true,
        canAccessAnalytics: true,
      };
    }

    const user = await User.findByIdAndUpdate(
      id,
      { ...updates },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    logger.info(`User updated: ${user.email} by ${req.user?.email}`);

    successResponse(res, user, 'User updated successfully');
  }
);

/**
 * Delete user (permanent delete with validation)
 */
export const deleteUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if user has any active candidates assigned
    const activeCandidatesCount = await Candidate.countDocuments({
      assignedTo: id,
      status: { $nin: ['rejected', 'withdrawn'] } // Not rejected or withdrawn
    });

    if (activeCandidatesCount > 0) {
      throw new BadRequestError(
        `Cannot delete user. This user has ${activeCandidatesCount} active candidate(s) assigned. Please reassign or close these candidates first.`
      );
    }

    // Count team member assignments before deletion for logging
    const teamAssignmentsCount = await TeamMember.countDocuments({ userId: id });
    
    // Delete all team member assignments for this user
    await TeamMember.deleteMany({ userId: id });

    // Permanently delete the user
    await User.findByIdAndDelete(id);

    logger.info(`User permanently deleted: ${user.email} (removed ${teamAssignmentsCount} team assignment(s)) by ${req.user?.email}`);

    successResponse(res, { id: user._id, deleted: true }, 'User deleted successfully');
  }
);

/**
 * Get user statistics
 */
export const getUserStats = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });

    const roleBreakdown = stats.reduce((acc: any, stat: any) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    successResponse(
      res,
      {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        roleBreakdown,
      },
      'User statistics retrieved successfully'
    );
  }
);
