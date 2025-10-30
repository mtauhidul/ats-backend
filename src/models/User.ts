import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  avatar?: string;
  phone?: string;
  title?: string; // Job title/position
  department?: string;
  role:
    | "admin"
    | "recruiter"
    | "hiring_manager"
    | "interviewer"
    | "coordinator";
  isActive: boolean;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  magicLinkToken?: string;
  magicLinkExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  refreshToken?: string;
  lastLogin?: Date;
  permissions?: {
    canManageClients?: boolean;
    canManageJobs?: boolean;
    canReviewApplications?: boolean;
    canManageCandidates?: boolean;
    canSendEmails?: boolean;
    canManageTeam?: boolean;
    canAccessAnalytics?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
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
    passwordHash: {
      type: String,
      required: true,
      select: false, // Don't return password hash by default
    },
    avatar: {
      type: String,
    },
    phone: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: [
        "admin",
        "recruiter",
        "hiring_manager",
        "interviewer",
        "coordinator",
      ],
      default: "recruiter",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    magicLinkToken: {
      type: String,
      select: false,
    },
    magicLinkExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    lastLogin: {
      type: Date,
    },
    permissions: {
      type: {
        canManageClients: { type: Boolean, default: false },
        canManageJobs: { type: Boolean, default: false },
        canReviewApplications: { type: Boolean, default: true },
        canManageCandidates: { type: Boolean, default: false },
        canSendEmails: { type: Boolean, default: true },
        canManageTeam: { type: Boolean, default: false },
        canAccessAnalytics: { type: Boolean, default: false },
      },
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Note: email already has unique index from unique: true
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ emailVerificationToken: 1 });
UserSchema.index({ magicLinkToken: 1 });
UserSchema.index({ passwordResetToken: 1 });

// Virtual for full name
UserSchema.virtual("fullName").get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

// Methods
UserSchema.methods.toJSON = function () {
  const user = this.toObject();
  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    avatar: user.avatar,
    phone: user.phone,
    title: user.title,
    department: user.department,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    lastLogin: user.lastLogin,
    permissions: user.permissions,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const User = mongoose.model<IUser>("User", UserSchema);
