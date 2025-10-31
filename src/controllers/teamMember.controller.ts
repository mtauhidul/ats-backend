import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { TeamMember, User, Job } from '../models';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError, BadRequestError } from '../utils/errors';
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
      .populate('userId', 'firstName lastName email avatar role phone title department')
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
      .populate('userId', 'firstName lastName email avatar role phone title department')
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

    let userId: string;
    let jobId: string | undefined;

    // Case 1: Creating team member with existing userId and jobId (team member for a specific job)
    if (data.userId && data.jobId) {
      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(data.userId)) {
        logger.error(`Invalid userId format: ${data.userId}`);
        throw new BadRequestError('Invalid User ID format');
      }

      if (!mongoose.Types.ObjectId.isValid(data.jobId)) {
        logger.error(`Invalid jobId format: ${data.jobId}`);
        throw new BadRequestError('Invalid Job ID format');
      }

      // Verify user exists
      logger.info(`Looking up user with ID: ${data.userId}`);
      const user = await User.findById(data.userId);
      if (!user) {
        logger.error(`User not found with ID: ${data.userId}`);
        throw new NotFoundError('User');
      }

      // Verify job exists
      logger.info(`Looking up job with ID: ${data.jobId}`);
      const job = await Job.findById(data.jobId);
      if (!job) {
        logger.error(`Job not found with ID: ${data.jobId}`);
        throw new NotFoundError('Job');
      }

      // Check if team member already exists
      const existingTeamMember = await TeamMember.findOne({
        userId: data.userId,
        jobId: data.jobId,
        isActive: true,
      });

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
      let user = await User.findOne({ email: data.email.toLowerCase() });

      if (!user) {
        // Create new user
        logger.info(`Creating new user with email: ${data.email}`);
        user = await User.create({
          email: data.email.toLowerCase(),
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role || 'recruiter',
          avatar: data.avatar,
          phone: data.phone,
          title: data.title,
          department: data.department,
          isActive: data.status === 'active' || data.status === undefined,
        });
        logger.info(`New user created: ${user.email} with ID: ${user._id}`);
      } else {
        logger.info(`User already exists with email: ${data.email}, using existing user ID: ${user._id}`);
        
        // Update user fields if they're provided and different
        const updates: Record<string, unknown> = {};
        if (data.firstName && data.firstName !== user.firstName) updates.firstName = data.firstName;
        if (data.lastName && data.lastName !== user.lastName) updates.lastName = data.lastName;
        if (data.phone !== undefined && data.phone !== user.phone) updates.phone = data.phone;
        if (data.title !== undefined && data.title !== user.title) updates.title = data.title;
        if (data.department !== undefined && data.department !== user.department) updates.department = data.department;
        if (data.avatar !== undefined && data.avatar !== user.avatar) updates.avatar = data.avatar;
        
        if (Object.keys(updates).length > 0) {
          await User.findByIdAndUpdate(user._id, updates);
          logger.info(`Updated existing user ${user.email} with new information`);
        }
      }

      userId = String(user._id);
      jobId = data.jobId; // Can be undefined for general team members

      // If jobId is provided, verify it exists
      if (jobId) {
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
          logger.error(`Invalid jobId format: ${jobId}`);
          throw new BadRequestError('Invalid Job ID format');
        }

        const job = await Job.findById(jobId);
        if (!job) {
          logger.error(`Job not found with ID: ${jobId}`);
          throw new NotFoundError('Job');
        }

        // Check if team member already exists for this job
        const existingTeamMember = await TeamMember.findOne({
          userId: userId,
          jobId: jobId,
          isActive: true,
        });

        if (existingTeamMember) {
          logger.warn(`Team member already exists: user ${userId} on job ${jobId}`);
          throw new BadRequestError('User is already a team member on this job');
        }
      } else {
        // Check if general team member (without job) already exists
        const existingGeneralTeamMember = await TeamMember.findOne({
          userId: userId,
          jobId: { $exists: false },
          isActive: true,
        });

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

    // Map frontend permissions to backend permissions
    const backendPermissions = {
      canViewApplications: data.permissions?.canReviewApplications || data.permissions?.canViewApplications || true,
      canReviewApplications: data.permissions?.canReviewApplications || false,
      canScheduleInterviews: data.permissions?.canManageJobs || false,
      canViewFeedback: data.permissions?.canAccessAnalytics || false,
      canProvideFeedback: data.permissions?.canReviewApplications || false,
    };

    // Create team member with mapped data
    const teamMemberData: any = {
      userId,
      role: data.role || 'recruiter',
      permissions: backendPermissions,
      isActive: data.status === 'active' || data.status === undefined,
      addedBy: req.user?._id,
    };

    // Only add jobId if it's provided
    if (jobId) {
      teamMemberData.jobId = jobId;
    }

    // Create team member
    const teamMember = await TeamMember.create(teamMemberData);

    // Populate references
    await teamMember.populate([
      { path: 'userId', select: 'firstName lastName email avatar role phone title department' },
      { path: 'jobId', select: 'title clientId' },
      { path: 'addedBy', select: 'firstName lastName email' },
    ]);

    // Get the populated user for logging
    const populatedUser = await User.findById(userId);
    logger.info(`Team member added: ${populatedUser?.email} to job ${jobId || 'general team'} by ${req.user?.email}`);

    // Send assignment email notification
    if (populatedUser && populatedUser.email) {
      try {
        const assignerName = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Administrator';
        let entityName = 'General Team';
        let entityType = 'team';
        
        if (jobId) {
          const job = await Job.findById(jobId);
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

    // Find the team member first
    const teamMember = await TeamMember.findById(id);
    if (!teamMember) {
      throw new NotFoundError('Team member');
    }

    // Separate user fields from team member fields
    const userFields = ['firstName', 'lastName', 'email', 'phone', 'title', 'department', 'avatar'];
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
      await User.findByIdAndUpdate(
        teamMember.userId,
        userUpdates,
        { new: true, runValidators: true }
      );
      logger.info(`Updated user ${teamMember.userId} with fields: ${Object.keys(userUpdates).join(', ')}`);
      
      // Send notification email about profile changes
      const updatedUser = await User.findById(teamMember.userId);
      if (updatedUser && updatedUser.email) {
        try {
          const changes = Object.keys(userUpdates).map(key => {
            const fieldName = key.charAt(0).toUpperCase() + key.slice(1);
            return `${fieldName} updated`;
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
      await TeamMember.findByIdAndUpdate(
        id,
        teamMemberUpdates,
        { new: true, runValidators: true }
      );
      logger.info(`Updated team member ${id} with fields: ${Object.keys(teamMemberUpdates).join(', ')}`);
      
      // Send notification email about team member changes (role/permissions)
      const user = await User.findById(teamMember.userId);
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

    // Fetch the updated team member with populated fields
    const updatedTeamMember = await TeamMember.findById(id).populate([
      { path: 'userId', select: 'firstName lastName email avatar role phone title department' },
      { path: 'jobId', select: 'title clientId' },
      { path: 'addedBy', select: 'firstName lastName email' },
    ]);

    logger.info(`Team member updated: ${id} by ${req.user?.email}`);

    successResponse(res, updatedTeamMember, 'Team member updated successfully');
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
      .populate('userId', 'firstName lastName email avatar role phone title department')
      .populate('addedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    successResponse(res, teamMembers, 'Job team members retrieved successfully');
  }
);
