import mongoose, { Document, Schema } from 'mongoose';

export interface IJob extends Document {
  title: string;
  clientId: mongoose.Types.ObjectId;
  description: string;
  requirements: string[];
  responsibilities: string[];
  location: string;
  locationType: 'onsite' | 'hybrid' | 'remote';
  jobType: 'full_time' | 'part_time' | 'contract' | 'internship';
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
  status: 'draft' | 'open' | 'closed' | 'on_hold';
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
      enum: ['onsite', 'hybrid', 'remote'],
      required: true,
      index: true,
    },
    jobType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'internship'],
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
      enum: ['draft', 'open', 'closed', 'on_hold'],
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
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret: any) {
        // Convert _id to id for frontend compatibility
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;

        // Note: We don't transform requirements/skills here anymore
        // The frontend normalizeJob() function handles the transformation
        // from backend format (requirements: string[], skills: string[])
        // to frontend format (requirements: object with experience + skills)

        return ret;
      },
    },
  }
);

// Indexes
JobSchema.index({ title: 'text', description: 'text' });
JobSchema.index({ clientId: 1, status: 1 });
JobSchema.index({ status: 1, priority: 1 });
JobSchema.index({ createdAt: -1 });
JobSchema.index({ applicationDeadline: 1 });

export const Job = mongoose.model<IJob>('Job', JobSchema);
