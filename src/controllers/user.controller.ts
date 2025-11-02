import { Request, Response } from 'express';
import { userService, candidateService, teamMemberService } from '../services/firestore';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';
import { sendTeamMemberUpdateEmail } from '../services/email.service';

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

    // Get all users
    let allUsers = await userService.find([]);

    // Apply filters
    if (role) {
      allUsers = allUsers.filter((user: any) => user.role === role);
    }

    if (isActive !== undefined) {
      const activeFilter = isActive === 'true';
      allUsers = allUsers.filter((user: any) => user.isActive === activeFilter);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      allUsers = allUsers.filter((user: any) =>
        user.firstName?.toLowerCase().includes(searchLower) ||
        user.lastName?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      );
    }

    // Get total count after filtering
    const totalCount = allUsers.length;

    // Calculate pagination
    const pagination = paginateResults(totalCount, {
      page,
      limit,
      sort: sortBy,
      order: sortOrder,
    });

    // Apply sorting
    allUsers.sort((a: any, b: any) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Apply pagination
    const skip = (page - 1) * limit;
    const users = allUsers.slice(skip, skip + limit);

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

    // Validate ID parameter
    if (!id || id === 'undefined' || id === 'null') {
      throw new BadRequestError('User ID is required');
    }

    // Validate ID format (string validation for Firestore)
    if (typeof id !== 'string' || id.length === 0) {
      throw new BadRequestError('Invalid User ID format');
    }

    const user = await userService.findById(id);

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

    // Validate ID parameter
    if (!id || id === 'undefined' || id === 'null') {
      throw new BadRequestError('User ID is required');
    }

    // Validate ID format (string validation for Firestore)
    if (typeof id !== 'string' || id.length === 0) {
      throw new BadRequestError('Invalid User ID format');
    }

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

    await userService.update(id, updates as any);
    const user = await userService.findById(id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    logger.info(`User updated: ${user.email} by ${req.user?.email}`);

    // Send notification email about profile/role changes
    if (user.email) {
      try {
        const changes = Object.keys(updates).map(key => {
          if (key === 'role') {
            return `Role changed to ${updates[key]}`;
          } else if (key === 'isActive') {
            return `Status changed to ${updates[key] ? 'active' : 'inactive'}`;
          } else if (key === 'permissions') {
            return 'Permissions updated';
          } else {
            const fieldName = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
            return `${fieldName} updated`;
          }
        });
        
        const updaterName = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Administrator';
        
        await sendTeamMemberUpdateEmail(
          user.email,
          user.firstName,
          changes,
          updaterName
        );
        logger.info(`User update notification email sent to ${user.email}`);
      } catch (emailError) {
        // Log error but don't fail the request
        logger.error(`Failed to send user update email to ${user.email}:`, emailError);
      }
    }

    successResponse(res, user, 'User updated successfully');
  }
);

/**
 * Delete user (permanent delete with validation)
 */
export const deleteUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    // Validate ID parameter
    if (!id || id === 'undefined' || id === 'null') {
      throw new BadRequestError('User ID is required');
    }

    // Validate ID format (string validation for Firestore)
    if (typeof id !== 'string' || id.length === 0) {
      throw new BadRequestError('Invalid User ID format');
    }

    const user = await userService.findById(id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if user has any active candidates assigned
    const allCandidates = await candidateService.find([]);
    const activeCandidates = allCandidates.filter((candidate: any) =>
      candidate.assignedTo === id &&
      !['rejected', 'withdrawn'].includes(candidate.status)
    );

    if (activeCandidates.length > 0) {
      throw new BadRequestError(
        `Cannot delete user. This user has ${activeCandidates.length} active candidate(s) assigned. Please reassign or close these candidates first.`
      );
    }

    // Count team member assignments before deletion for logging
    const allTeamMembers = await teamMemberService.find([]);
    const userTeamMembers = allTeamMembers.filter((tm: any) => tm.userId === id);
    const teamAssignmentsCount = userTeamMembers.length;
    
    // Delete all team member assignments for this user
    await Promise.all(
      userTeamMembers.map((tm: any) => teamMemberService.delete(tm.id))
    );

    // Permanently delete the user
    await userService.delete(id);

    logger.info(`User permanently deleted: ${user.email} (removed ${teamAssignmentsCount} team assignment(s)) by ${req.user?.email}`);

    successResponse(res, { id: user.id, deleted: true }, 'User deleted successfully');
  }
);

/**
 * Get user statistics
 */
export const getUserStats = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    // Get all users
    const allUsers = await userService.find([]);

    // Calculate total and active users
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter((user: any) => user.isActive).length;

    // Group by role
    const roleBreakdown = allUsers.reduce((acc: any, user: any) => {
      const role = user.role || 'user';
      acc[role] = (acc[role] || 0) + 1;
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
