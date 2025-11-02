import { FirestoreBaseService } from "./base.service";

export interface ISystemSettings {
  id?: string;
  
  // Email Automation Settings
  emailAutomationEnabled: boolean;
  emailAutomationLastToggled?: Date;
  emailAutomationToggledBy?: string;

  // SMTP Settings for Inbound Email
  smtp?: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password: string; // Should be encrypted
    secure: boolean;
    lastChecked?: Date;
    lastSync?: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

class SystemSettingsService extends FirestoreBaseService<ISystemSettings> {
  private readonly SETTINGS_DOC_ID = "system_settings_singleton";

  constructor() {
    super("systemSettings");
  }

  /**
   * Get system settings (singleton)
   */
  async getSettings(): Promise<ISystemSettings> {
    const settings = await this.findById(this.SETTINGS_DOC_ID);
    
    if (!settings) {
      // Create default settings if not exists
      const defaultSettings: Omit<ISystemSettings, "id"> = {
        emailAutomationEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await this.createSettingsWithId(this.SETTINGS_DOC_ID, defaultSettings);
      return { id: this.SETTINGS_DOC_ID, ...defaultSettings };
    }

    return settings;
  }

  /**
   * Update settings
   */
  async updateSettings(
    updates: Partial<Omit<ISystemSettings, "id" | "createdAt">>
  ): Promise<void> {
    await this.update(this.SETTINGS_DOC_ID, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  /**
   * Toggle email automation
   */
  async toggleEmailAutomation(
    enabled: boolean,
    userId?: string
  ): Promise<void> {
    await this.updateSettings({
      emailAutomationEnabled: enabled,
      emailAutomationLastToggled: new Date(),
      emailAutomationToggledBy: userId,
    });
  }

  /**
   * Update SMTP settings
   */
  async updateSmtpSettings(
    smtp: ISystemSettings["smtp"]
  ): Promise<void> {
    await this.updateSettings({ smtp });
  }

  /**
   * Create settings with specific ID (for singleton pattern)
   */
  protected async createSettingsWithId(
    id: string,
    data: Omit<ISystemSettings, "id">
  ): Promise<void> {
    const docRef = this.getDocRef(id);
    await docRef.set(this.convertDatesToTimestamps(data));
  }

  /**
   * Subscribe to settings changes
   */
  subscribeToSettings(
    callback: (settings: ISystemSettings | null) => void
  ): () => void {
    return this.subscribeToDocument(this.SETTINGS_DOC_ID, callback);
  }
}

export const systemSettingsService = new SystemSettingsService();
