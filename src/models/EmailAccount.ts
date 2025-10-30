import mongoose, { Document, Schema } from "mongoose";
import { decrypt, encrypt } from "../utils/crypto";

export interface IEmailAccount extends Document {
  name: string;
  email: string;
  provider: "gmail" | "outlook" | "custom";

  // IMAP Settings
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPassword: string; // Encrypted
  imapTls: boolean;

  // Automation Settings
  isActive: boolean;
  autoProcessResumes: boolean;
  defaultApplicationStatus: string;
  lastChecked?: Date;

  // Metadata
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  getDecryptedPassword(): string;
  setEncryptedPassword(password: string): void;
}

const EmailAccountSchema = new Schema<IEmailAccount>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    provider: {
      type: String,
      enum: ["gmail", "outlook", "custom"],
      required: true,
    },

    // IMAP Settings
    imapHost: {
      type: String,
      required: true,
    },
    imapPort: {
      type: Number,
      required: true,
      default: 993,
    },
    imapUser: {
      type: String,
      required: true,
    },
    imapPassword: {
      type: String,
      required: true,
      // Encrypted in database
    },
    imapTls: {
      type: Boolean,
      default: true,
    },

    // Automation Settings
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    autoProcessResumes: {
      type: Boolean,
      default: true,
    },
    defaultApplicationStatus: {
      type: String,
      default: "pending",
    },
    lastChecked: {
      type: Date,
    },

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
  }
);

// Indexes
// Note: email already has unique index from unique: true
EmailAccountSchema.index({ isActive: 1, autoProcessResumes: 1 });
EmailAccountSchema.index({ lastChecked: 1 });

// Methods
EmailAccountSchema.methods.getDecryptedPassword = function (): string {
  return decrypt(this.imapPassword);
};

EmailAccountSchema.methods.setEncryptedPassword = function (
  password: string
): void {
  this.imapPassword = encrypt(password);
};

// Pre-save hook to encrypt password
EmailAccountSchema.pre("save", function (next) {
  // Only encrypt if password is modified and not already encrypted
  if (this.isModified("imapPassword")) {
    // Check if it's already encrypted (encrypted strings are hex)
    const isEncrypted = /^[0-9a-f]+$/i.test(this.imapPassword);
    if (!isEncrypted) {
      this.imapPassword = encrypt(this.imapPassword);
    }
  }
  next();
});

// Ensure password is never returned in JSON
EmailAccountSchema.methods.toJSON = function () {
  const account = this.toObject();
  return {
    id: account._id,
    name: account.name,
    email: account.email,
    provider: account.provider,
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    imapUser: account.imapUser,
    imapPassword: "********", // Masked
    imapTls: account.imapTls,
    isActive: account.isActive,
    autoProcessResumes: account.autoProcessResumes,
    defaultApplicationStatus: account.defaultApplicationStatus,
    lastChecked: account.lastChecked,
    createdBy: account.createdBy,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
};

export const EmailAccount = mongoose.model<IEmailAccount>(
  "EmailAccount",
  EmailAccountSchema
);
