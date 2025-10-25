import mongoose, { Document, Schema } from 'mongoose';

export interface IEmail extends Document {
  direction: 'inbound' | 'outbound';
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  
  // Attachments
  attachments?: Array<{
    filename: string;
    url: string;
    contentType: string;
    size: number;
  }>;
  
  // Status
  status: 'sent' | 'failed' | 'received' | 'draft';
  sentAt?: Date;
  receivedAt?: Date;
  
  // Relationships
  candidateId?: mongoose.Types.ObjectId;
  applicationId?: mongoose.Types.ObjectId;
  jobId?: mongoose.Types.ObjectId;
  clientId?: mongoose.Types.ObjectId;
  interviewId?: mongoose.Types.ObjectId;
  
  // Email Account (for inbound)
  emailAccountId?: mongoose.Types.ObjectId;
  
  // Metadata
  messageId?: string; // Email message ID
  inReplyTo?: string; // Reply thread
  threadId?: string;
  
  // Error tracking
  error?: string;
  retryCount?: number;
  
  // Sender/Creator
  sentBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EmailSchema = new Schema<IEmail>(
  {
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
      index: true,
    },
    from: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    to: [{
      type: String,
      lowercase: true,
      trim: true,
    }],
    cc: [{
      type: String,
      lowercase: true,
      trim: true,
    }],
    bcc: [{
      type: String,
      lowercase: true,
      trim: true,
    }],
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    bodyHtml: {
      type: String,
    },
    
    // Attachments
    attachments: [{
      filename: String,
      url: String,
      contentType: String,
      size: Number,
    }],
    
    // Status
    status: {
      type: String,
      enum: ['sent', 'failed', 'received', 'draft'],
      default: 'draft',
      index: true,
    },
    sentAt: {
      type: Date,
      index: true,
    },
    receivedAt: {
      type: Date,
      index: true,
    },
    
    // Relationships
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      index: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      index: true,
    },
    interviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Interview',
      index: true,
    },
    
    // Email Account
    emailAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'EmailAccount',
      index: true,
    },
    
    // Metadata
    messageId: {
      type: String,
      index: true,
    },
    inReplyTo: String,
    threadId: {
      type: String,
      index: true,
    },
    
    // Error tracking
    error: String,
    retryCount: {
      type: Number,
      default: 0,
    },
    
    // Sender
    sentBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
EmailSchema.index({ direction: 1, status: 1 });
EmailSchema.index({ candidateId: 1, createdAt: -1 });
EmailSchema.index({ applicationId: 1, createdAt: -1 });
EmailSchema.index({ jobId: 1, createdAt: -1 });
EmailSchema.index({ threadId: 1 });
EmailSchema.index({ sentAt: -1 });

export const Email = mongoose.model<IEmail>('Email', EmailSchema);
