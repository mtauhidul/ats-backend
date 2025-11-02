import { FirestoreBaseService } from "./base.service";

export interface IActivityLog {
  id?: string;
  userId: string;
  action: string; // e.g., 'reviewed_candidate', 'sent_email', 'updated_job', 'login'
  resourceType?: string; // e.g., 'candidate', 'job', 'client', 'application'
  resourceId?: string;
  resourceName?: string; // For display: candidate name, job title, etc.
  metadata?: Record<string, unknown>; // Additional context
  createdAt: Date;
}

class ActivityLogService extends FirestoreBaseService<IActivityLog> {
  constructor() {
    super("activityLogs");
  }

  /**
   * Find activity logs by user ID
   */
  async findByUserId(
    userId: string,
    options?: { limit?: number }
  ): Promise<IActivityLog[]> {
    return this.find(
      [{ field: "userId", operator: "==", value: userId }],
      {
        orderBy: [{ field: "createdAt", direction: "desc" }],
        limit: options?.limit || 50,
      }
    );
  }

  /**
   * Find activity logs by action
   */
  async findByAction(
    action: string,
    options?: { limit?: number }
  ): Promise<IActivityLog[]> {
    return this.find(
      [{ field: "action", operator: "==", value: action }],
      {
        orderBy: [{ field: "createdAt", direction: "desc" }],
        limit: options?.limit || 50,
      }
    );
  }

  /**
   * Find activity logs by resource
   */
  async findByResource(
    resourceType: string,
    resourceId: string,
    options?: { limit?: number }
  ): Promise<IActivityLog[]> {
    return this.find(
      [
        { field: "resourceType", operator: "==", value: resourceType },
        { field: "resourceId", operator: "==", value: resourceId },
      ],
      {
        orderBy: [{ field: "createdAt", direction: "desc" }],
        limit: options?.limit || 50,
      }
    );
  }

  /**
   * Find activity logs by resource type
   */
  async findByResourceType(
    resourceType: string,
    options?: { limit?: number }
  ): Promise<IActivityLog[]> {
    return this.find(
      [{ field: "resourceType", operator: "==", value: resourceType }],
      {
        orderBy: [{ field: "createdAt", direction: "desc" }],
        limit: options?.limit || 50,
      }
    );
  }

  /**
   * Find activity logs within date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: { limit?: number; userId?: string }
  ): Promise<IActivityLog[]> {
    const filters: any[] = [
      { field: "createdAt", operator: ">=", value: startDate },
      { field: "createdAt", operator: "<=", value: endDate },
    ];

    if (options?.userId) {
      filters.push({ field: "userId", operator: "==", value: options.userId });
    }

    return this.find(filters, {
      orderBy: [{ field: "createdAt", direction: "desc" }],
      limit: options?.limit || 100,
    });
  }

  /**
   * Find recent activity (last N days)
   */
  async findRecent(days: number = 7, userId?: string): Promise<IActivityLog[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const filters: any[] = [
      { field: "createdAt", operator: ">=", value: cutoffDate },
    ];

    if (userId) {
      filters.push({ field: "userId", operator: "==", value: userId });
    }

    return this.find(filters, {
      orderBy: [{ field: "createdAt", direction: "desc" }],
      limit: 100,
    });
  }

  /**
   * Log an activity
   */
  async log(activity: Omit<IActivityLog, "id" | "createdAt">): Promise<string> {
    return this.create({
      ...activity,
      createdAt: new Date(),
    });
  }

  /**
   * Delete old activity logs (older than N days)
   * Note: In Firestore, we can use TTL policies or this manual cleanup
   */
  async deleteOldLogs(days: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const oldLogs = await this.find([
      { field: "createdAt", operator: "<=", value: cutoffDate },
    ]);

    const deletions = oldLogs.map((log) => this.delete(log.id!));
    await Promise.all(deletions);

    return oldLogs.length;
  }

  /**
   * Get activity summary for user
   */
  async getUserActivitySummary(
    userId: string,
    days: number = 30
  ): Promise<Record<string, number>> {
    const activities = await this.findRecent(days, userId);

    const summary: Record<string, number> = {};

    activities.forEach((activity) => {
      summary[activity.action] = (summary[activity.action] || 0) + 1;
    });

    return summary;
  }

  /**
   * Get activity summary by resource type
   */
  async getResourceActivitySummary(
    resourceType: string,
    resourceId: string
  ): Promise<Record<string, number>> {
    const activities = await this.findByResource(resourceType, resourceId);

    const summary: Record<string, number> = {};

    activities.forEach((activity) => {
      summary[activity.action] = (summary[activity.action] || 0) + 1;
    });

    return summary;
  }

  /**
   * Subscribe to user activities
   */
  subscribeToUserActivities(
    userId: string,
    callback: (activities: IActivityLog[]) => void,
    options?: { limit?: number }
  ): () => void {
    return this.subscribeToCollection(
      [{ field: "userId", operator: "==", value: userId }],
      callback,
      {
        orderBy: [{ field: "createdAt", direction: "desc" }],
        limit: options?.limit || 50,
      }
    );
  }

  /**
   * Subscribe to resource activities
   */
  subscribeToResourceActivities(
    resourceType: string,
    resourceId: string,
    callback: (activities: IActivityLog[]) => void,
    options?: { limit?: number }
  ): () => void {
    return this.subscribeToCollection(
      [
        { field: "resourceType", operator: "==", value: resourceType },
        { field: "resourceId", operator: "==", value: resourceId },
      ],
      callback,
      {
        orderBy: [{ field: "createdAt", direction: "desc" }],
        limit: options?.limit || 50,
      }
    );
  }
}

export const activityLogService = new ActivityLogService();
