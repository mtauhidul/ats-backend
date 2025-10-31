import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailTemplate extends Document {
  name: string;
  subject: string;
  body: string;
  type: 'interview' | 'offer' | 'rejection' | 'follow_up' | 'application_received' | 'general';
  variables: string[];
  isDefault: boolean;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EmailTemplateSchema = new Schema<IEmailTemplate>(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      maxlength: [100, 'Template name cannot exceed 100 characters'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    body: {
      type: String,
      required: [true, 'Body is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['interview', 'offer', 'rejection', 'follow_up', 'application_received', 'general'],
      required: [true, 'Type is required'],
      default: 'general',
    },
    variables: {
      type: [String],
      default: [],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
EmailTemplateSchema.index({ type: 1, isActive: 1 });
EmailTemplateSchema.index({ name: 1 });
EmailTemplateSchema.index({ isDefault: 1 });

export const EmailTemplate = mongoose.model<IEmailTemplate>('EmailTemplate', EmailTemplateSchema);
