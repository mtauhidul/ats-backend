import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'application'
  | 'interview'
  | 'status_change'
  | 'job'
  | 'offer'
  | 'team'
  | 'reminder'
  | 'client'
  | 'system';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  isImportant: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expiresAt?: Date;
  relatedEntity: {
    type: string;
    id: string;
    name: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'application',
        'interview',
        'status_change',
        'job',
        'offer',
        'team',
        'reminder',
        'client',
        'system',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    isImportant: {
      type: Boolean,
      default: false,
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: false,
    },
    relatedEntity: {
      type: {
        type: String,
        required: false,
      },
      id: {
        type: String,
        required: false,
      },
      name: {
        type: String,
        required: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, isImportant: 1 });
notificationSchema.index({ expiresAt: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
