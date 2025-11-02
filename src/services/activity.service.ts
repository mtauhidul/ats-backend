/**
 * Activity Logging Service
 * Tracks user activities across the system
 */

import { activityLogService } from './firestore';
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
    await activityLogService.create({
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceName: params.resourceName,
      metadata: params.metadata,
    } as any);
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
  let activities = await activityLogService.find([]);
  activities = activities
    .filter((log: any) => log.userId === userId)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
  return activities;
};
