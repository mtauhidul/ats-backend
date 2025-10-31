import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  // Internal messaging
  conversationId?: string;
  senderId?: mongoose.Types.ObjectId;
  senderName?: string;
  senderRole?: string;
  senderAvatar?: string;
  recipientId?: mongoose.Types.ObjectId;
  recipientName?: string;
  recipientRole?: string;
  recipientAvatar?: string;
  message?: string;
  read?: boolean;
  sentAt?: Date;
  
  // Email tracking (for candidate communications)
  candidateId?: mongoose.Types.ObjectId;
  subject?: string;
  body?: string;
  from?: string;
  to?: string;
  direction?: 'inbound' | 'outbound';
  status?: 'received' | 'sent' | 'unmatched';
  receivedAt?: Date;
  emailId?: string; // Resend email ID
  
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    // Internal messaging
    conversationId: {
      type: String,
      index: true,
      required: function(this: IMessage) {
        // Required for internal messages (not email tracking)
        return !this.emailId;
      },
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: function(this: IMessage) {
        // Required for internal messages (not email tracking)
        return !this.emailId;
      },
    },
    senderName: {
      type: String,
    },
    senderRole: {
      type: String,
    },
    senderAvatar: {
      type: String,
      default: '',
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: function(this: IMessage) {
        // Required for internal messages (not email tracking)
        return !this.emailId;
      },
    },
    recipientName: {
      type: String,
    },
    recipientRole: {
      type: String,
    },
    recipientAvatar: {
      type: String,
      default: '',
    },
    message: {
      type: String,
      required: function(this: IMessage) {
        // Required for internal messages (not email tracking)
        return !this.emailId;
      },
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    
    // Email tracking (for candidate communications)
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      index: true,
    },
    subject: {
      type: String,
    },
    body: {
      type: String,
    },
    from: {
      type: String,
      lowercase: true,
      trim: true,
    },
    to: {
      type: String,
      lowercase: true,
      trim: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      index: true,
    },
    status: {
      type: String,
      enum: ['received', 'sent', 'unmatched'],
      index: true,
    },
    receivedAt: {
      type: Date,
    },
    emailId: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
messageSchema.index({ conversationId: 1, sentAt: -1 });
messageSchema.index({ senderId: 1, recipientId: 1 });
messageSchema.index({ recipientId: 1, read: 1 });
messageSchema.index({ candidateId: 1, receivedAt: -1 });
messageSchema.index({ direction: 1, status: 1 });
// Compound index for internal message queries (separates from email tracking)
messageSchema.index({ senderId: 1, conversationId: 1, emailId: 1, sentAt: -1 });
messageSchema.index({ recipientId: 1, conversationId: 1, emailId: 1, sentAt: -1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);
