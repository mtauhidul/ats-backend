/**
 * Activity Logging Service
 * Tracks user activities across the system
 */

import ActivityLog from '../models/ActivityLog';
import logger from '../utils/logger';

export interface LogActivityParams {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a user activity
 */
export const logActivity = async (params: LogActivityParams): Promise<void> => {
  try {
    await ActivityLog.create({
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceName: params.resourceName,
      metadata: params.metadata,
    });
  } catch (error) {
    // Don't throw error to avoid breaking main operations
    logger.error('Failed to log activity:', error);
  }
};

/**
 * Get user activities
 */
export const getUserActivities = async (
  userId: string,
  limit: number = 20
): Promise<any[]> => {
  return ActivityLog.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};
