import { Request, Response } from 'express';
import { teamMemberService, userService, jobService, candidateService } from '../services/firestore';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError, BadRequestError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { sendAssignmentEmail, sendTeamMemberUpdateEmail } from '../services/email.service';

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
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as any;

    // Fetch all team members
    const allTeamMembers = await teamMemberService.find([]);

    // Apply filters in memory
    let filtered = allTeamMembers.filter((tm: any) => {
      if (jobId && tm.jobId !== jobId) return false;
      if (userId && tm.userId !== userId) return false;
      if (role && tm.role !== role) return false;
      if (isActive !== undefined && tm.isActive !== (isActive === 'true')) return false;
      return true;
    });

    // Sort
    filtered = filtered.sort((a: any, b: any) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Get total count after filtering
    const totalCount = filtered.length;

    // Calculate pagination
    const pagination = paginateResults(totalCount, {
      page,
      limit,
      sort: sortBy,
      order: sortOrder,
    });

    // Apply pagination
    const skip = (page - 1) * limit;
    const teamMembers = filtered.slice(skip, skip + limit);

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

    const teamMember = await teamMemberService.findById(id);

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

    let userId: string;
    let jobId: string | undefined;

    // Case 1: Creating team member with existing userId and jobId (team member for a specific job)
    if (data.userId && data.jobId) {
      // Verify user exists
      logger.info(`Looking up user with ID: ${data.userId}`);
      const user = await userService.findById(data.userId);
      if (!user) {
        logger.error(`User not found with ID: ${data.userId}`);
        throw new NotFoundError('User');
      }

      // Verify job exists
      logger.info(`Looking up job with ID: ${data.jobId}`);
      const job = await jobService.findById(data.jobId);
      if (!job) {
        logger.error(`Job not found with ID: ${data.jobId}`);
        throw new NotFoundError('Job');
      }

      // Check if team member already exists
      const allTeamMembers = await teamMemberService.find([]);
      const existingTeamMember = allTeamMembers.find((tm: any) =>
        tm.userId === data.userId && tm.jobId === data.jobId && tm.isActive === true
      );

      if (existingTeamMember) {
        logger.warn(`Team member already exists: user ${data.userId} on job ${data.jobId}`);
        throw new BadRequestError('User is already a team member on this job');
      }

      userId = data.userId;
      jobId = data.jobId;
    }
    // Case 2: Creating a general team member by user details (email, firstName, lastName)
    else if (data.email) {
      // Validate required fields for new user
      if (!data.firstName || !data.lastName) {
        logger.error('Team member creation failed: firstName and lastName are required when creating by email');
        throw new BadRequestError('First name and last name are required');
      }

      // Check if user with email already exists
      logger.info(`Looking up user by email: ${data.email}`);
      const allUsers = await userService.find([]);
      let user = allUsers.find((u: any) => u.email?.toLowerCase() === data.email.toLowerCase());

      if (!user) {
        // Create new user
        logger.info(`Creating new user with email: ${data.email}`);
        const newUserId = await userService.create({
          email: data.email.toLowerCase(),
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role || 'recruiter',
          avatar: data.avatar,
          phone: data.phone,
          title: data.title,
          department: data.department,
          isActive: data.status === 'active' || data.status === undefined,
        } as any);
        const createdUser = await userService.findById(newUserId);
        if (!createdUser) {
          throw new Error('Failed to create user');
        }
        user = createdUser;
        logger.info(`New user created: ${user.email} with ID: ${user.id}`);
      } else {
        logger.info(`User already exists with email: ${data.email}, using existing user ID: ${user.id}`);
        
        // Update user fields if they're provided and different
        const updates: Record<string, unknown> = {};
        if (data.firstName && data.firstName !== user.firstName) updates.firstName = data.firstName;
        if (data.lastName && data.lastName !== user.lastName) updates.lastName = data.lastName;
        if (data.phone !== undefined && data.phone !== user.phone) updates.phone = data.phone;
        if (data.title !== undefined && data.title !== user.title) updates.title = data.title;
        if (data.department !== undefined && data.department !== user.department) updates.department = data.department;
        if (data.avatar !== undefined && data.avatar !== user.avatar) updates.avatar = data.avatar;
        
        if (Object.keys(updates).length > 0) {
          await userService.update(user.id, updates);
          logger.info(`Updated existing user ${user.email} with new information`);
        }
      }

      userId = user.id;
      jobId = data.jobId; // Can be undefined for general team members

      // If jobId is provided, verify it exists
      if (jobId) {
        const job = await jobService.findById(jobId);
        if (!job) {
          logger.error(`Job not found with ID: ${jobId}`);
          throw new NotFoundError('Job');
        }

        // Check if team member already exists for this job
        const allTeamMembers = await teamMemberService.find([]);
        const existingTeamMember = allTeamMembers.find((tm: any) =>
          tm.userId === userId && tm.jobId === jobId && tm.isActive === true
        );

        if (existingTeamMember) {
          logger.warn(`Team member already exists: user ${userId} on job ${jobId}`);
          throw new BadRequestError('User is already a team member on this job');
        }
      } else {
        // Check if general team member (without job) already exists
        const allTeamMembers = await teamMemberService.find([]);
        const existingGeneralTeamMember = allTeamMembers.find((tm: any) =>
          tm.userId === userId && !tm.jobId && tm.isActive === true
        );

        if (existingGeneralTeamMember) {
          logger.warn(`General team member already exists for user ${userId}`);
          throw new BadRequestError('This user is already a team member');
        }
      }
    }
    // Case 3: Invalid - neither userId+jobId nor email provided
    else {
      logger.error('Team member creation failed: either userId+jobId or email+firstName+lastName are required');
      throw new BadRequestError('Either userId and jobId, or email with firstName and lastName are required');
    }

    // Use unified permissions schema (no mapping/conversion needed)
    // Default permissions based on role if not provided
    const defaultPermissions = {
      canManageClients: false,
      canManageJobs: false,
      canReviewApplications: false,
      canManageCandidates: false,
      canSendEmails: false,
      canManageTeam: false,
      canAccessAnalytics: false,
    };

    const permissions = data.permissions || defaultPermissions;

    // Create team member with unified schema
    const teamMemberData: any = {
      userId,
      role: data.role || 'recruiter',
      permissions,
      isActive: data.status === 'active' || data.status === undefined,
      addedBy: req.user?.id,
    };

    // Only add jobId if it's provided
    if (jobId) {
      teamMemberData.jobId = jobId;
    }

    // Create team member
    const teamMemberId = await teamMemberService.create(teamMemberData);
    const teamMember = await teamMemberService.findById(teamMemberId);

    // Get the user for logging
    const populatedUser = await userService.findById(userId);
    logger.info(`Team member added: ${populatedUser?.email} to job ${jobId || 'general team'} by ${req.user?.email}`);

    // Send assignment email notification
    if (populatedUser && populatedUser.email) {
      try {
        const assignerName = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Administrator';
        let entityName = 'General Team';
        let entityType = 'team';
        
        if (jobId) {
          const job = await jobService.findById(jobId);
          if (job) {
            entityName = job.title;
            entityType = 'job';
          }
        }
        
        await sendAssignmentEmail(
          populatedUser.email,
          populatedUser.firstName,
          entityType,
          entityName,
          assignerName
        );
        logger.info(`Assignment notification email sent to ${populatedUser.email}`);
      } catch (emailError) {
        // Log error but don't fail the request
        logger.error(`Failed to send assignment email to ${populatedUser.email}:`, emailError);
      }
    }

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

    // Try to find by TeamMember ID first
    let teamMember = await teamMemberService.findById(id);
    
    // If not found, try to find by User ID (in case frontend sends user ID)
    if (!teamMember) {
      const allTeamMembers = await teamMemberService.find([]);
      const foundByUserId = allTeamMembers.find((tm: any) => tm.userId === id);
      teamMember = foundByUserId || null;
    }
    
    if (!teamMember) {
      throw new NotFoundError('Team member');
    }

    // Separate user fields from team member fields
    // NOTE: permissions, role are stored in User collection
    const userFields = ['firstName', 'lastName', 'email', 'phone', 'title', 'department', 'avatar', 'permissions', 'role'];
    const userUpdates: Record<string, unknown> = {};
    const teamMemberUpdates: Record<string, unknown> = {};

    // Split updates into user fields and team member fields
    Object.keys(updates).forEach(key => {
      if (userFields.includes(key)) {
        userUpdates[key] = updates[key];
      } else {
        teamMemberUpdates[key] = updates[key];
      }
    });

    // Update user if there are user field updates
    if (Object.keys(userUpdates).length > 0) {
      await userService.update(teamMember.userId, userUpdates);
      logger.info(`Updated user ${teamMember.userId} with fields: ${Object.keys(userUpdates).join(', ')}`);
      
      // Send notification email about profile/permission changes
      const updatedUser = await userService.findById(teamMember.userId);
      if (updatedUser && updatedUser.email) {
        try {
          const changes = Object.keys(userUpdates).map(key => {
            if (key === 'permissions') {
              return 'Permissions updated';
            } else if (key === 'role') {
              return `Role changed to ${userUpdates[key]}`;
            } else {
              const fieldName = key.charAt(0).toUpperCase() + key.slice(1);
              return `${fieldName} updated`;
            }
          });
          
          const updaterName = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Administrator';
          
          await sendTeamMemberUpdateEmail(
            updatedUser.email,
            updatedUser.firstName,
            changes,
            updaterName
          );
          logger.info(`Profile update notification email sent to ${updatedUser.email}`);
        } catch (emailError) {
          logger.error(`Failed to send profile update email to ${updatedUser.email}:`, emailError);
        }
      }
    }

    // Prevent updating certain team member fields
    delete teamMemberUpdates.userId;
    delete teamMemberUpdates.jobId;
    delete teamMemberUpdates.addedBy;
    delete teamMemberUpdates.createdAt;
    delete teamMemberUpdates.updatedAt;

    // Map status to isActive
    if ('status' in teamMemberUpdates) {
      teamMemberUpdates.isActive = teamMemberUpdates.status === 'active';
      delete teamMemberUpdates.status;
    }

    // Update team member if there are team member field updates
    if (Object.keys(teamMemberUpdates).length > 0) {
      await teamMemberService.update(teamMember.id, teamMemberUpdates);
      logger.info(`Updated team member ${id} with fields: ${Object.keys(teamMemberUpdates).join(', ')}`);
      
      // Send notification email about team member changes (role/permissions)
      const user = await userService.findById(teamMember.userId);
      if (user && user.email) {
        try {
          const changes = Object.keys(teamMemberUpdates).map(key => {
            if (key === 'role') {
              return `Role changed to ${teamMemberUpdates[key]}`;
            } else if (key === 'isActive') {
              return `Status changed to ${teamMemberUpdates[key] ? 'active' : 'inactive'}`;
            } else if (key === 'permissions') {
              return 'Permissions updated';
            } else {
              const fieldName = key.charAt(0).toUpperCase() + key.slice(1);
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
          logger.info(`Team member update notification email sent to ${user.email}`);
        } catch (emailError) {
          logger.error(`Failed to send team member update email to ${user.email}:`, emailError);
        }
      }
    }

    // Fetch the updated team member
    const updatedTeamMember = await teamMemberService.findById(teamMember.id);

    logger.info(`Team member updated: ${teamMember.id} by ${req.user?.email}`);

    successResponse(res, updatedTeamMember, 'Team member updated successfully');
  }
);

/**
 * Delete team member (soft delete)
 */
export const deleteTeamMember = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const teamMember = await teamMemberService.findById(id);

    if (!teamMember) {
      throw new NotFoundError('Team member not found');
    }

    // Check if team member has any candidates assigned
    const allCandidates = await candidateService.find([]);
    const assignedCandidates = allCandidates.filter((candidate: any) => {
      const assignedTeamMembers = candidate.assignedTeamMembers || [];
      return assignedTeamMembers.some((tm: any) => {
        const tmId = typeof tm === 'string' ? tm : tm.id || tm._id;
        return tmId === id;
      });
    });

    if (assignedCandidates.length > 0) {
      throw new ValidationError(
        `Cannot delete team member with ${assignedCandidates.length} assigned candidate${assignedCandidates.length > 1 ? 's' : ''}. Please unassign all candidates first.`
      );
    }

    await teamMemberService.update(id, { isActive: false });

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

    const allTeamMembers = await teamMemberService.find([]);
    const teamMembers = allTeamMembers
      .filter((tm: any) => tm.jobId === jobId && tm.isActive === true)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    successResponse(res, teamMembers, 'Job team members retrieved successfully');
  }
);
