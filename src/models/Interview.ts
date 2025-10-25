import mongoose, { Document, Schema } from 'mongoose';

export interface IInterview extends Document {
  candidateId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  applicationId?: mongoose.Types.ObjectId;
  
  // Interview Details
  type: 'phone' | 'video' | 'in-person' | 'technical' | 'hr' | 'final';
  round: number;
  title: string;
  description?: string;
  
  // Scheduling
  scheduledAt: Date;
  duration: number; // minutes
  timezone: string;
  location?: string; // For in-person
  
  // Video Meeting (Zoom)
  meetingLink?: string;
  meetingId?: string;
  meetingPassword?: string;
  zoomMeetingDetails?: any; // Full Zoom response
  
  // Participants
  interviewerIds: mongoose.Types.ObjectId[];
  organizerId: mongoose.Types.ObjectId;
  
  // Status
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  
  // Feedback
  feedback?: Array<{
    interviewerId: mongoose.Types.ObjectId;
    rating: number; // 1-5
    strengths: string[];
    weaknesses: string[];
    comments: string;
    recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no';
    submittedAt: Date;
  }>;
  
  // Notes
  notes?: string;
  internalNotes?: string;
  
  // Reminders
  reminderSent?: boolean;
  reminderSentAt?: Date;
  
  // Metadata
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InterviewSchema = new Schema<IInterview>(
  {
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
      index: true,
    },
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
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      index: true,
    },
    
    // Interview Details
    type: {
      type: String,
      enum: ['phone', 'video', 'in-person', 'technical', 'hr', 'final'],
      required: true,
      index: true,
    },
    round: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    
    // Scheduling
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    duration: {
      type: Number,
      required: true,
      default: 60,
      min: 15,
    },
    timezone: {
      type: String,
      required: true,
      default: 'UTC',
    },
    location: String,
    
    // Video Meeting
    meetingLink: String,
    meetingId: String,
    meetingPassword: String,
    zoomMeetingDetails: Schema.Types.Mixed,
    
    // Participants
    interviewerIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    organizerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // Status
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
      default: 'scheduled',
      index: true,
    },
    
    // Feedback
    feedback: [{
      interviewerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      strengths: [String],
      weaknesses: [String],
      comments: String,
      recommendation: {
        type: String,
        enum: ['strong_yes', 'yes', 'maybe', 'no', 'strong_no'],
      },
      submittedAt: Date,
    }],
    
    // Notes
    notes: String,
    internalNotes: String,
    
    // Reminders
    reminderSent: {
      type: Boolean,
      default: false,
    },
    reminderSentAt: Date,
    
    // Metadata
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
InterviewSchema.index({ candidateId: 1, scheduledAt: -1 });
InterviewSchema.index({ jobId: 1, status: 1 });
InterviewSchema.index({ status: 1, scheduledAt: 1 });
InterviewSchema.index({ interviewerIds: 1, scheduledAt: 1 });
InterviewSchema.index({ organizerId: 1, scheduledAt: -1 });

export const Interview = mongoose.model<IInterview>('Interview', InterviewSchema);
