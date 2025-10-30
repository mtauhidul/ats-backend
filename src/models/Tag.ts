import mongoose, { Document, Schema } from "mongoose";

export interface ITag extends Document {
  name: string;
  description?: string;
  color?: string;
  type: "job" | "candidate" | "skill" | "general";
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema = new Schema<ITag>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      default: "#10B981",
    },
    type: {
      type: String,
      enum: ["job", "candidate", "skill", "general"],
      default: "general",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Note: name already has unique index from unique: true
TagSchema.index({ type: 1, isActive: 1 });

export const Tag = mongoose.model<ITag>("Tag", TagSchema);
