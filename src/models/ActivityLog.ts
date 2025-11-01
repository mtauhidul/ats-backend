import mongoose, { Document, Schema } from 'mongoose';

export interface IActivityLog extends Document {
  userId: mongoose.Types.ObjectId;
  action: string; // e.g., 'reviewed_candidate', 'sent_email', 'updated_job', 'login'
  resourceType?: string; // e.g., 'candidate', 'job', 'client', 'application'
  resourceId?: mongoose.Types.ObjectId;
  resourceName?: string; // For display: candidate name, job title, etc.
  metadata?: Record<string, unknown>; // Additional context
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      index: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    resourceName: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient user activity queries
ActivityLogSchema.index({ userId: 1, createdAt: -1 });

// TTL index - automatically delete activity logs older than 90 days
// This keeps the database size manageable while retaining recent activity
ActivityLogSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 90 * 24 * 60 * 60, // 90 days in seconds
  }
);

export default mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
