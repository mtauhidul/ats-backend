import mongoose, { Document, Schema } from 'mongoose';

export interface ITeamMember extends Document {
  userId: mongoose.Types.ObjectId;
  jobId?: mongoose.Types.ObjectId; // Optional - team members can be created without job assignment
  role: 'admin' | 'recruiter' | 'hiring_manager' | 'interviewer' | 'coordinator';
  permissions: {
    canViewApplications: boolean;
    canReviewApplications: boolean;
    canScheduleInterviews: boolean;
    canViewFeedback: boolean;
    canProvideFeedback: boolean;
  };
  isActive: boolean;
  addedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberSchema = new Schema<ITeamMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: false, // Optional - can assign to job later
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'recruiter', 'hiring_manager', 'interviewer', 'coordinator'],
      required: true,
      index: true,
    },
    permissions: {
      canViewApplications: {
        type: Boolean,
        default: true,
      },
      canReviewApplications: {
        type: Boolean,
        default: false,
      },
      canScheduleInterviews: {
        type: Boolean,
        default: false,
      },
      canViewFeedback: {
        type: Boolean,
        default: false,
      },
      canProvideFeedback: {
        type: Boolean,
        default: false,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Unique constraint: same user can only be on a team once for the same job (if job is specified)
TeamMemberSchema.index({ userId: 1, jobId: 1 }, { unique: true, sparse: true });
TeamMemberSchema.index({ jobId: 1, isActive: 1 });
TeamMemberSchema.index({ userId: 1, isActive: 1 });
TeamMemberSchema.index({ role: 1, isActive: 1 });

export const TeamMember = mongoose.model<ITeamMember>('TeamMember', TeamMemberSchema);
