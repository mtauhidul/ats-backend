import mongoose, { Document, Schema } from 'mongoose';

export interface IApplication extends Document {
  jobId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  
  // Candidate Info
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  
  // Resume & Documents
  resumeUrl: string;
  resumeOriginalName: string;
  coverLetter?: string;
  additionalDocuments?: Array<{
    url: string;
    originalName: string;
    type: string;
  }>;
  
  // Parsed Resume Data (from AI)
  parsedData?: {
    summary?: string;
    skills?: string[];
    experience?: Array<{
      company: string;
      title: string;
      duration: string;
      description?: string;
    }>;
    education?: Array<{
      institution: string;
      degree: string;
      field?: string;
      year?: string;
    }>;
    certifications?: string[];
    languages?: string[];
  };
  
  // Application Details
  status: 'pending' | 'reviewing' | 'shortlisted' | 'rejected' | 'approved';
  source: 'manual' | 'direct_apply' | 'email_automation';
  sourceEmail?: string; // If from email automation
  sourceEmailAccountId?: mongoose.Types.ObjectId;
  
  // Pipeline
  pipelineStageId?: mongoose.Types.ObjectId;
  
  // Notes & Communication
  notes?: string;
  internalNotes?: string;
  
  // Timestamps
  appliedAt: Date;
  reviewedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  
  // Assignment
  assignedTo?: mongoose.Types.ObjectId;
  reviewedBy?: mongoose.Types.ObjectId;
  
  // Metadata
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    
    // Candidate Info
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    
    // Resume & Documents
    resumeUrl: {
      type: String,
      required: true,
    },
    resumeOriginalName: {
      type: String,
      required: true,
    },
    coverLetter: {
      type: String,
    },
    additionalDocuments: [{
      url: String,
      originalName: String,
      type: String,
    }],
    
    // Parsed Resume Data
    parsedData: {
      summary: String,
      skills: [String],
      experience: [{
        company: String,
        title: String,
        duration: String,
        description: String,
      }],
      education: [{
        institution: String,
        degree: String,
        field: String,
        year: String,
      }],
      certifications: [String],
      languages: [String],
    },
    
    // Application Details
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'shortlisted', 'rejected', 'approved'],
      default: 'pending',
      index: true,
    },
    source: {
      type: String,
      enum: ['manual', 'direct_apply', 'email_automation'],
      required: true,
      index: true,
    },
    sourceEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    sourceEmailAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'EmailAccount',
    },
    
    // Pipeline
    pipelineStageId: {
      type: Schema.Types.ObjectId,
      ref: 'Pipeline.stages',
    },
    
    // Notes
    notes: {
      type: String,
    },
    internalNotes: {
      type: String,
    },
    
    // Timestamps
    appliedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reviewedAt: {
      type: Date,
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    
    // Assignment
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    
    // Metadata
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
ApplicationSchema.index({ jobId: 1, status: 1 });
ApplicationSchema.index({ clientId: 1, status: 1 });
ApplicationSchema.index({ email: 1 });
ApplicationSchema.index({ status: 1, appliedAt: -1 });
ApplicationSchema.index({ source: 1, status: 1 });
ApplicationSchema.index({ assignedTo: 1, status: 1 });

// Prevent duplicate applications for same job
ApplicationSchema.index({ jobId: 1, email: 1 }, { unique: true });

// Virtual for full name
ApplicationSchema.virtual('fullName').get(function (this: IApplication) {
  return `${this.firstName} ${this.lastName}`;
});

export const Application = mongoose.model<IApplication>('Application', ApplicationSchema);
