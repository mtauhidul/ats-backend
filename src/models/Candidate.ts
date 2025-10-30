import mongoose, { Document, Schema } from 'mongoose';

export interface ICandidate extends Document {
  // Personal Info
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  location?: string;
  avatar?: string;
  
  // Professional Info
  currentTitle?: string;
  currentCompany?: string;
  yearsOfExperience?: number;
  linkedinUrl?: string;
  portfolioUrl?: string;
  
  // Resume & Documents
  resumeUrl: string;
  resumeOriginalName: string;
  additionalDocuments?: Array<{
    url: string;
    originalName: string;
    type: string;
  }>;
  
  // Parsed Resume Data (from AI)
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
  
  // AI Scoring (when converted from application)
  aiScore?: {
    overallScore: number; // 0-100
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
    summary: string;
    strengths: string[];
    concerns: string[];
    recommendation: 'strong_fit' | 'good_fit' | 'moderate_fit' | 'poor_fit';
    scoredForJobId: mongoose.Types.ObjectId;
    scoredAt: Date;
  };
  
  // Application History
  applicationId: mongoose.Types.ObjectId; // Original application
  jobIds: mongoose.Types.ObjectId[]; // Jobs applied to
  
  // Job Applications - Per-job tracking
  jobApplications: Array<{
    jobId: mongoose.Types.ObjectId;
    applicationId?: mongoose.Types.ObjectId;
    status: 'active' | 'interviewing' | 'offered' | 'hired' | 'rejected' | 'withdrawn';
    appliedAt: Date;
    lastStatusChange: Date;
    currentStage?: string;
    notes?: string;
    rating?: number;
    resumeScore?: number;
    interviewScheduled?: Date;
    rejectionReason?: string;
    withdrawalReason?: string;
    emailIds: mongoose.Types.ObjectId[];
    lastEmailDate?: Date;
    emailsSent: number;
    emailsReceived: number;
    lastEmailSubject?: string;
  }>;
  
  // Status & Pipeline (for current/primary job application)
  status: 'active' | 'interviewing' | 'offered' | 'hired' | 'rejected' | 'withdrawn';
  currentPipelineStageId?: mongoose.Types.ObjectId;
  
  // Tags & Categories
  tagIds: mongoose.Types.ObjectId[];
  categoryIds: mongoose.Types.ObjectId[];
  
  // Notes
  notes?: string;
  internalNotes?: string;
  
  // Assignment
  assignedTo?: mongoose.Types.ObjectId;
  
  // Metadata
  source: 'application' | 'manual_import' | 'referral';
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CandidateSchema = new Schema<ICandidate>(
  {
    // Personal Info
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
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
    },
    
    // Professional Info
    currentTitle: {
      type: String,
      trim: true,
    },
    currentCompany: {
      type: String,
      trim: true,
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
    },
    linkedinUrl: {
      type: String,
      trim: true,
    },
    portfolioUrl: {
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
    additionalDocuments: [{
      url: String,
      originalName: String,
      type: String,
    }],
    
    // Parsed Resume Data
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
    
    // AI Scoring
    aiScore: {
      overallScore: {
        type: Number,
        min: 0,
        max: 100,
      },
      skillsMatch: {
        type: Number,
        min: 0,
        max: 100,
      },
      experienceMatch: {
        type: Number,
        min: 0,
        max: 100,
      },
      educationMatch: {
        type: Number,
        min: 0,
        max: 100,
      },
      summary: String,
      strengths: [String],
      concerns: [String],
      recommendation: {
        type: String,
        enum: ['strong_fit', 'good_fit', 'moderate_fit', 'poor_fit'],
      },
      scoredForJobId: {
        type: Schema.Types.ObjectId,
        ref: 'Job',
      },
      scoredAt: Date,
    },
    
    // Application History
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    jobIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Job',
    }],
    
    // Job Applications - Per-job tracking
    jobApplications: [{
      jobId: {
        type: Schema.Types.ObjectId,
        ref: 'Job',
        required: true,
      },
      applicationId: {
        type: Schema.Types.ObjectId,
        ref: 'Application',
      },
      status: {
        type: String,
        enum: ['active', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn'],
        default: 'active',
      },
      appliedAt: {
        type: Date,
        default: Date.now,
      },
      lastStatusChange: {
        type: Date,
        default: Date.now,
      },
      currentStage: String,
      notes: String,
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      resumeScore: {
        type: Number,
        min: 0,
        max: 100,
      },
      interviewScheduled: Date,
      rejectionReason: String,
      withdrawalReason: String,
      emailIds: [{
        type: Schema.Types.ObjectId,
        ref: 'Email',
      }],
      lastEmailDate: Date,
      emailsSent: {
        type: Number,
        default: 0,
      },
      emailsReceived: {
        type: Number,
        default: 0,
      },
      lastEmailSubject: String,
    }],
    
    // Status & Pipeline (for current/primary job application)
    status: {
      type: String,
      enum: ['active', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn'],
      default: 'active',
    },
    currentPipelineStageId: {
      type: Schema.Types.ObjectId,
      ref: 'Pipeline.stages',
    },    // Tags & Categories
    tagIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Tag',
    }],
    categoryIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Category',
    }],
    
    // Notes
    notes: String,
    internalNotes: String,
    
    // Assignment
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    
    // Metadata
    source: {
      type: String,
      enum: ['application', 'manual_import', 'referral'],
      default: 'application',
    },
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
// Note: email already has unique index from unique: true
CandidateSchema.index({ status: 1 });
CandidateSchema.index({ assignedTo: 1, status: 1 });
CandidateSchema.index({ 'aiScore.overallScore': -1 });
CandidateSchema.index({ jobIds: 1 });
CandidateSchema.index({ createdAt: -1 });

// Full text search
CandidateSchema.index({ 
  firstName: 'text', 
  lastName: 'text', 
  email: 'text', 
  skills: 'text',
  currentTitle: 'text',
  currentCompany: 'text'
});

// Virtual for id (for frontend compatibility)
CandidateSchema.virtual('id').get(function (this: ICandidate) {
  return (this._id as mongoose.Types.ObjectId).toString();
});

// Virtual for full name
CandidateSchema.virtual('fullName').get(function (this: ICandidate) {
  return `${this.firstName} ${this.lastName}`;
});

export const Candidate = mongoose.model<ICandidate>('Candidate', CandidateSchema);
