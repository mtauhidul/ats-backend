import mongoose, { Document, Schema } from 'mongoose';

export interface IPipelineStage {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  order: number;
  color?: string;
  isActive: boolean;
}

export interface IPipeline extends Document {
  name: string;
  description?: string;
  type: 'candidate' | 'interview' | 'custom';
  stages: IPipelineStage[];
  isDefault: boolean;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PipelineStageSchema = new Schema<IPipelineStage>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      min: 0,
    },
    color: {
      type: String,
      default: '#6B7280',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const PipelineSchema = new Schema<IPipeline>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['candidate', 'interview', 'custom'],
      default: 'candidate',
      index: true,
    },
    stages: [PipelineStageSchema],
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret: any) {
        // Convert _id to id for frontend compatibility
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        
        // Transform stage _ids to id
        if (ret.stages && Array.isArray(ret.stages)) {
          ret.stages = ret.stages.map((stage: any) => {
            if (stage._id) {
              stage.id = stage._id.toString();
              delete stage._id;
            }
            return stage;
          });
        }
        
        return ret;
      },
    },
  }
);

// Indexes
PipelineSchema.index({ name: 1 });
PipelineSchema.index({ type: 1, isActive: 1 });
PipelineSchema.index({ isDefault: 1 });

// Only one default pipeline per type
PipelineSchema.index({ type: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

export const Pipeline = mongoose.model<IPipeline>('Pipeline', PipelineSchema);
