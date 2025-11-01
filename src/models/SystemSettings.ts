import mongoose, { Schema, Document, Model } from 'mongoose';

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

  // Future settings can be added here
  // e.g., maintenanceMode, featureFlags, etc.

  createdAt: Date;
  updatedAt: Date;
}

// Define interface for static methods
interface ISystemSettingsModel extends Model<ISystemSettings> {
  getSettings(): Promise<ISystemSettings>;
  setEmailAutomation(enabled: boolean, userId?: mongoose.Types.ObjectId): Promise<ISystemSettings>;
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
      ref: 'User',
    },
  },
  {
    timestamps: true,
    collection: 'systemsettings',
  }
);

// Ensure only one settings document exists
SystemSettingsSchema.index({ _id: 1 }, { unique: true });

/**
 * Get or create the system settings
 * This ensures only one settings document exists
 */
SystemSettingsSchema.statics.getSettings = async function (): Promise<ISystemSettings> {
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
  const SystemSettingsModel = mongoose.model<ISystemSettings, ISystemSettingsModel>('SystemSettings');
  const settings = await SystemSettingsModel.getSettings();
  
  settings.emailAutomationEnabled = enabled;
  settings.emailAutomationLastToggled = new Date();
  
  if (userId) {
    settings.emailAutomationToggledBy = userId;
  }
  
  await settings.save();
  return settings;
};

// Prevent accidental deletion or multiple documents
SystemSettingsSchema.pre('deleteOne', function (next) {
  next(new Error('System settings cannot be deleted'));
});

SystemSettingsSchema.pre('deleteMany', function (next) {
  next(new Error('System settings cannot be deleted'));
});

export const SystemSettings = mongoose.model<ISystemSettings, ISystemSettingsModel>('SystemSettings', SystemSettingsSchema);
