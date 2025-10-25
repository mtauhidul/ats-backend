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
  
  // Status & Pipeline
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
      index: true,
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
    
    // Status & Pipeline
    status: {
      type: String,
      enum: ['active', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn'],
      default: 'active',
      index: true,
    },
    currentPipelineStageId: {
      type: Schema.Types.ObjectId,
      ref: 'Pipeline.stages',
    },
    
    // Tags & Categories
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
  }
);

// Indexes
CandidateSchema.index({ email: 1 });
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

// Virtual for full name
CandidateSchema.virtual('fullName').get(function (this: ICandidate) {
  return `${this.firstName} ${this.lastName}`;
});

export const Candidate = mongoose.model<ICandidate>('Candidate', CandidateSchema);
