import { FirestoreBaseService } from "./base.service";

export type NotificationType =
  | "application"
  | "interview"
  | "status_change"
  | "job"
  | "offer"
  | "team"
  | "reminder"
  | "client"
  | "system";

export interface INotification {
  id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  isImportant: boolean;
  priority: "low" | "medium" | "high" | "urgent";
  expiresAt?: Date;
  relatedEntity: {
    type: string;
    id: string;
    name: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

class NotificationService extends FirestoreBaseService<INotification> {
  constructor() {
    super("notifications");
  }

  /**
   * Find notifications by user ID
   */
  async findByUserId(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean }
  ): Promise<INotification[]> {
    const filters: any[] = [
      { field: "userId", operator: "==", value: userId },
    ];

    if (options?.unreadOnly) {
      filters.push({ field: "read", operator: "==", value: false });
    }

    return this.find(filters, {
      orderBy: [{ field: "createdAt", direction: "desc" }],
      limit: options?.limit,
    });
  }

  /**
   * Find unread notifications by user ID
   */
  async findUnreadByUserId(userId: string): Promise<INotification[]> {
    return this.findByUserId(userId, { unreadOnly: true });
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.count([
      { field: "userId", operator: "==", value: userId },
      { field: "read", operator: "==", value: false },
    ]);
  }

  /**
   * Find important notifications for user
   */
  async findImportantByUserId(userId: string): Promise<INotification[]> {
    return this.find(
      [
        { field: "userId", operator: "==", value: userId },
        { field: "isImportant", operator: "==", value: true },
        { field: "read", operator: "==", value: false },
      ],
      { orderBy: [{ field: "createdAt", direction: "desc" }] }
    );
  }

  /**
   * Find notifications by type
   */
  async findByType(
    userId: string,
    type: NotificationType
  ): Promise<INotification[]> {
    return this.find(
      [
        { field: "userId", operator: "==", value: userId },
        { field: "type", operator: "==", value: type },
      ],
      { orderBy: [{ field: "createdAt", direction: "desc" }] }
    );
  }

  /**
   * Find notifications by priority
   */
  async findByPriority(
    userId: string,
    priority: INotification["priority"]
  ): Promise<INotification[]> {
    return this.find(
      [
        { field: "userId", operator: "==", value: userId },
        { field: "priority", operator: "==", value: priority },
      ],
      { orderBy: [{ field: "createdAt", direction: "desc" }] }
    );
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<void> {
    await this.update(id, {
      read: true,
      updatedAt: new Date(),
    });
  }

  /**
   * Mark notification as unread
   */
  async markAsUnread(id: string): Promise<void> {
    await this.update(id, {
      read: false,
      updatedAt: new Date(),
    });
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    const unreadNotifications = await this.findUnreadByUserId(userId);

    const updates = unreadNotifications.map((notification) =>
      this.markAsRead(notification.id!)
    );

    await Promise.all(updates);
  }

  /**
   * Delete expired notifications
   */
  async deleteExpired(): Promise<number> {
    const now = new Date();
    const expiredNotifications = await this.find([
      { field: "expiresAt", operator: "<=", value: now },
    ]);

    const deletions = expiredNotifications.map((notification) =>
      this.delete(notification.id!)
    );

    await Promise.all(deletions);
    return expiredNotifications.length;
  }

  /**
   * Delete old read notifications (older than N days)
   */
  async deleteOldReadNotifications(days: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const oldNotifications = await this.find([
      { field: "read", operator: "==", value: true },
      { field: "createdAt", operator: "<=", value: cutoffDate },
    ]);

    const deletions = oldNotifications.map((notification) =>
      this.delete(notification.id!)
    );

    await Promise.all(deletions);
    return oldNotifications.length;
  }

  /**
   * Create notification with related entity
   */
  async createWithEntity(
    notification: Omit<INotification, "id" | "createdAt" | "updatedAt">
  ): Promise<string> {
    return this.create({
      ...notification,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Bulk create notifications for multiple users
   */
  async createForMultipleUsers(
    userIds: string[],
    notificationData: Omit<
      INotification,
      "id" | "userId" | "createdAt" | "updatedAt"
    >
  ): Promise<string[]> {
    const notifications = userIds.map((userId) => ({
      ...notificationData,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    return this.batchCreate(notifications);
  }

  /**
   * Subscribe to user notifications
   */
  subscribeToUserNotifications(
    userId: string,
    callback: (notifications: INotification[]) => void,
    options?: { limit?: number; unreadOnly?: boolean }
  ): () => void {
    const filters: any[] = [
      { field: "userId", operator: "==", value: userId },
    ];

    if (options?.unreadOnly) {
      filters.push({ field: "read", operator: "==", value: false });
    }

    return this.subscribeToCollection(filters, callback, {
      orderBy: [{ field: "createdAt", direction: "desc" }],
      limit: options?.limit,
    });
  }

  /**
   * Subscribe to unread count for user
   */
  subscribeToUnreadCount(
    userId: string,
    callback: (count: number) => void
  ): () => void {
    return this.subscribeToUserNotifications(
      userId,
      (notifications) => {
        callback(notifications.length);
      },
      { unreadOnly: true }
    );
  }
}

export const notificationService = new NotificationService();
