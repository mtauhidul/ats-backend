/**
 * Activity Log Controller
 * Handles activity log retrieval
 */

import { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../utils/helpers';
import { getUserActivities } from '../services/activity.service';

/**
 * Get activities for a specific user
 */
export const getUserActivityLog = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const activities = await getUserActivities(userId, limit);

    successResponse(res, activities, 'Activities retrieved successfully');
  }
);

/**
 * Get current user's activities
 */
export const getMyActivities = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const activities = await getUserActivities(userId, limit);

    successResponse(res, activities, 'Activities retrieved successfully');
  }
);
