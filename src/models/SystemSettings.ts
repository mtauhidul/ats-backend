import mongoose, { Document, Model, Schema } from "mongoose";
import { decrypt, encrypt } from "../utils/crypto";

/**
 * System Settings Model
 *
 * Stores global system configuration and settings
 * This is a singleton collection with only one document
 */

export interface ISystemSettings extends Document {
  // Email Automation Settings
  emailAutomationEnabled: boolean;
  emailAutomationLastToggled?: Date;
  emailAutomationToggledBy?: mongoose.Types.ObjectId;

  // SMTP Settings for Inbound Email
  smtp?: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password: string; // Encrypted
    secure: boolean; // Use TLS/SSL
    lastChecked?: Date;
    lastSync?: Date;
  };

  // Future settings can be added here
  // e.g., maintenanceMode, featureFlags, etc.

  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  getDecryptedSmtpPassword(): string | null;
  setEncryptedSmtpPassword(password: string): void;
}

// Define interface for static methods
interface ISystemSettingsModel extends Model<ISystemSettings> {
  getSettings(): Promise<ISystemSettings>;
  setEmailAutomation(
    enabled: boolean,
    userId?: mongoose.Types.ObjectId
  ): Promise<ISystemSettings>;
  updateSmtpSettings(
    smtpConfig: {
      enabled: boolean;
      host: string;
      port: number;
      username: string;
      password: string;
      secure: boolean;
    },
    userId?: mongoose.Types.ObjectId
  ): Promise<ISystemSettings>;
}

const SystemSettingsSchema = new Schema<ISystemSettings>(
  {
    emailAutomationEnabled: {
      type: Boolean,
      default: false, // Disabled by default, admin must explicitly enable
      required: true,
    },
    emailAutomationLastToggled: {
      type: Date,
    },
    emailAutomationToggledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    smtp: {
      enabled: {
        type: Boolean,
        default: false,
      },
      host: {
        type: String,
      },
      port: {
        type: Number,
      },
      username: {
        type: String,
      },
      password: {
        type: String, // Encrypted
      },
      secure: {
        type: Boolean,
        default: true,
      },
      lastChecked: {
        type: Date,
      },
      lastSync: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
    collection: "systemsettings",
  }
);

// Ensure only one settings document exists
SystemSettingsSchema.index({ _id: 1 }, { unique: true });

/**
 * Get or create the system settings
 * This ensures only one settings document exists
 */
SystemSettingsSchema.statics.getSettings =
  async function (): Promise<ISystemSettings> {
    let settings = await this.findOne({});

    if (!settings) {
      // Create default settings if none exist
      settings = await this.create({
        emailAutomationEnabled: false,
      });
    }

    return settings;
  };

/**
 * Update email automation status
 */
SystemSettingsSchema.statics.setEmailAutomation = async function (
  enabled: boolean,
  userId?: mongoose.Types.ObjectId
): Promise<ISystemSettings> {
  // Use SystemSettings directly to avoid 'this' context issues
  const SystemSettingsModel = mongoose.model<
    ISystemSettings,
    ISystemSettingsModel
  >("SystemSettings");
  const settings = await SystemSettingsModel.getSettings();

  settings.emailAutomationEnabled = enabled;
  settings.emailAutomationLastToggled = new Date();

  if (userId) {
    settings.emailAutomationToggledBy = userId;
  }

  await settings.save();
  return settings;
};

/**
 * Update SMTP settings for inbound email
 */
SystemSettingsSchema.statics.updateSmtpSettings = async function (
  smtpConfig: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password: string;
    secure: boolean;
  },
  _userId?: mongoose.Types.ObjectId
): Promise<ISystemSettings> {
  const SystemSettingsModel = mongoose.model<
    ISystemSettings,
    ISystemSettingsModel
  >("SystemSettings");
  const settings = await SystemSettingsModel.getSettings();

  if (!settings.smtp) {
    settings.smtp = {
      enabled: false,
      host: "",
      port: 993,
      username: "",
      password: "",
      secure: true,
    };
  }

  settings.smtp.enabled = smtpConfig.enabled;
  settings.smtp.host = smtpConfig.host;
  settings.smtp.port = smtpConfig.port;
  settings.smtp.username = smtpConfig.username;
  settings.smtp.secure = smtpConfig.secure;

  // Encrypt the password before saving
  if (smtpConfig.password) {
    settings.setEncryptedSmtpPassword(smtpConfig.password);
  }

  await settings.save();
  return settings;
};

/**
 * Get decrypted SMTP password
 */
SystemSettingsSchema.methods.getDecryptedSmtpPassword = function (): string | null {
  if (!this.smtp?.password) return null;
  
  try {
    return decrypt(this.smtp.password);
  } catch (error) {
    console.error("Error decrypting SMTP password:", error);
    return null;
  }
};

/**
 * Set encrypted SMTP password
 */
SystemSettingsSchema.methods.setEncryptedSmtpPassword = function (password: string): void {
  if (!this.smtp) {
    this.smtp = {
      enabled: false,
      host: "",
      port: 993,
      username: "",
      password: "",
      secure: true,
    };
  }
  
  this.smtp.password = encrypt(password);
};

// Prevent accidental deletion or multiple documents
SystemSettingsSchema.pre("deleteOne", function (next) {
  next(new Error("System settings cannot be deleted"));
});

SystemSettingsSchema.pre("deleteMany", function (next) {
  next(new Error("System settings cannot be deleted"));
});

export const SystemSettings = mongoose.model<
  ISystemSettings,
  ISystemSettingsModel
>("SystemSettings", SystemSettingsSchema);
