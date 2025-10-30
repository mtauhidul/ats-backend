import mongoose, { Document, Schema } from "mongoose";

// Frontend-compatible Client schema
export interface IClient extends Document {
  // Basic Information (Required)
  companyName: string;
  email: string;
  phone: string;
  website?: string;
  logo?: string;

  // Classification (Required)
  industry:
    | "technology"
    | "healthcare"
    | "finance"
    | "education"
    | "retail"
    | "manufacturing"
    | "consulting"
    | "real_estate"
    | "hospitality"
    | "other";
  companySize: "1-50" | "51-200" | "201-500" | "500+";
  status: "active" | "inactive" | "pending" | "on_hold";

  // Location (Structured object matching frontend)
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };

  // Description
  description?: string;

  // Contacts - Array of contact persons
  contacts?: Array<{
    id?: string;
    name: string;
    email: string;
    phone?: string;
    position?: string;
    isPrimary: boolean;
  }>;

  // Statistics (Auto-calculated)
  statistics?: {
    totalJobs: number;
    activeJobs: number;
    closedJobs: number;
    draftJobs: number;
    totalCandidates: number;
    activeCandidates: number;
    hiredCandidates: number;
    rejectedCandidates: number;
    averageTimeToHire?: number;
    successRate?: number;
  };

  // Relations
  jobIds?: mongoose.Types.ObjectId[];

  // Communication Notes
  communicationNotes?: Array<{
    id: string;
    clientId: string;
    type: "email" | "phone" | "meeting" | "video_call" | "general";
    subject: string;
    content: string;
    createdBy: string;
    createdByName: string;
    createdAt: Date;
    updatedAt: Date;
  }>;

  // Activity History
  activityHistory?: Array<{
    id: string;
    clientId: string;
    action: string;
    description: string;
    performedBy: string;
    performedByName: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }>;

  // Tags
  tags?: string[];

  // Assignment
  assignedTo?: mongoose.Types.ObjectId;
  assignedToName?: string;

  // Metadata
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    // Basic Information
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    logo: {
      type: String,
    },

    // Classification
    industry: {
      type: String,
      enum: [
        "technology",
        "healthcare",
        "finance",
        "education",
        "retail",
        "manufacturing",
        "consulting",
        "real_estate",
        "hospitality",
        "other",
      ],
      required: true,
    },
    companySize: {
      type: String,
      enum: ["1-50", "51-200", "201-500", "500+"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending", "on_hold"],
      default: "active",
    },

    // Location - Structured object
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },

    // Description
    description: String,

    // Contacts array
    contacts: [
      {
        id: String,
        name: {
          type: String,
          required: true,
        },
        email: {
          type: String,
          required: true,
        },
        phone: String,
        position: String,
        isPrimary: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Statistics
    statistics: {
      totalJobs: { type: Number, default: 0 },
      activeJobs: { type: Number, default: 0 },
      closedJobs: { type: Number, default: 0 },
      draftJobs: { type: Number, default: 0 },
      totalCandidates: { type: Number, default: 0 },
      activeCandidates: { type: Number, default: 0 },
      hiredCandidates: { type: Number, default: 0 },
      rejectedCandidates: { type: Number, default: 0 },
      averageTimeToHire: Number,
      successRate: Number,
    },

    // Relations
    jobIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Job",
      },
    ],

    // Communication Notes
    communicationNotes: [
      {
        id: String,
        clientId: String,
        type: {
          type: String,
          enum: ["email", "phone", "meeting", "video_call", "general"],
        },
        subject: String,
        content: String,
        createdBy: String,
        createdByName: String,
        createdAt: Date,
        updatedAt: Date,
      },
    ],

    // Activity History
    activityHistory: [
      {
        id: String,
        clientId: String,
        action: String,
        description: String,
        performedBy: String,
        performedByName: String,
        timestamp: Date,
        metadata: Schema.Types.Mixed,
      },
    ],

    // Tags
    tags: [String],

    // Assignment
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    assignedToName: String,

    // Metadata
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
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret: any) {
        // Convert _id to id for frontend compatibility
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
ClientSchema.index({ companyName: 1 });
ClientSchema.index({ status: 1 });
ClientSchema.index({ email: 1 });
ClientSchema.index({ createdAt: -1 });
ClientSchema.index({ assignedTo: 1 });

// Pre-save hook to initialize statistics if not present
ClientSchema.pre("save", function (next) {
  if (!this.statistics) {
    this.statistics = {
      totalJobs: 0,
      activeJobs: 0,
      closedJobs: 0,
      draftJobs: 0,
      totalCandidates: 0,
      activeCandidates: 0,
      hiredCandidates: 0,
      rejectedCandidates: 0,
    };
  }
  next();
});

export const Client = mongoose.model<IClient>("Client", ClientSchema);
