import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  clerkId?: string; // Optional - for users created internally without Clerk auth
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  phone?: string;
  title?: string; // Job title/position
  department?: string;
  role: 'super_admin' | 'admin' | 'recruiter' | 'hiring_manager' | 'interviewer';
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    clerkId: {
      type: String,
      required: false, // Optional - not all users come through Clerk
      unique: true,
      sparse: true, // Only enforce uniqueness when clerkId is present
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
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
      enum: ['super_admin', 'admin', 'recruiter', 'hiring_manager', 'interviewer'],
      default: 'recruiter',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserSchema.index({ clerkId: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1, isActive: 1 });

// Virtual for full name
UserSchema.virtual('fullName').get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

// Methods
UserSchema.methods.toJSON = function () {
  const user = this.toObject();
  return {
    id: user._id,
    clerkId: user.clerkId,
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
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const User = mongoose.model<IUser>('User', UserSchema);
