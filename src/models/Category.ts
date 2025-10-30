import mongoose, { Document, Schema } from "mongoose";

export interface ICategory extends Document {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  type: "job" | "candidate" | "general";
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
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
      default: "#3B82F6",
    },
    icon: {
      type: String,
    },
    type: {
      type: String,
      enum: ["job", "candidate", "general"],
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
CategorySchema.index({ type: 1, isActive: 1 });

export const Category = mongoose.model<ICategory>("Category", CategorySchema);
