import mongoose, { Document, Schema } from 'mongoose';

export interface IJob extends Document {
  title: string;
  clientId: mongoose.Types.ObjectId;
  description: string;
  requirements: string[];
  responsibilities: string[];
  location: string;
  locationType: 'on-site' | 'hybrid' | 'remote';
  jobType: 'full-time' | 'part-time' | 'contract' | 'internship';
  experienceLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };
  skills: string[];
  benefits?: string[];
  pipelineId?: mongoose.Types.ObjectId;
  categoryIds: mongoose.Types.ObjectId[];
  tagIds: mongoose.Types.ObjectId[];
  status: 'draft' | 'open' | 'closed' | 'on-hold';
  openings: number;
  applicationDeadline?: Date;
  startDate?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  hiringManagerId?: mongoose.Types.ObjectId;
  recruiterIds: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    requirements: [{
      type: String,
    }],
    responsibilities: [{
      type: String,
    }],
    location: {
      type: String,
      required: true,
      trim: true,
    },
    locationType: {
      type: String,
      enum: ['on-site', 'hybrid', 'remote'],
      required: true,
      index: true,
    },
    jobType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship'],
      required: true,
      index: true,
    },
    experienceLevel: {
      type: String,
      enum: ['entry', 'mid', 'senior', 'lead', 'executive'],
      required: true,
      index: true,
    },
    salaryRange: {
      min: Number,
      max: Number,
      currency: {
        type: String,
        default: 'USD',
      },
    },
    skills: [{
      type: String,
      trim: true,
    }],
    benefits: [{
      type: String,
    }],
    pipelineId: {
      type: Schema.Types.ObjectId,
      ref: 'Pipeline',
      index: true,
    },
    categoryIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Category',
    }],
    tagIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Tag',
    }],
    status: {
      type: String,
      enum: ['draft', 'open', 'closed', 'on-hold'],
      default: 'draft',
      index: true,
    },
    openings: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    applicationDeadline: {
      type: Date,
      index: true,
    },
    startDate: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    hiringManagerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    recruiterIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
JobSchema.index({ title: 'text', description: 'text' });
JobSchema.index({ clientId: 1, status: 1 });
JobSchema.index({ status: 1, priority: 1 });
JobSchema.index({ createdAt: -1 });
JobSchema.index({ applicationDeadline: 1 });

export const Job = mongoose.model<IJob>('Job', JobSchema);
