import { FirestoreBaseService } from "./base.service";

export interface IEmailAccount {
  id?: string;
  name: string;
  email: string;
  provider: "gmail" | "outlook" | "custom";

  // IMAP Settings
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPassword: string; // Should be encrypted
  imapTls: boolean;

  // Automation Settings
  isActive: boolean;
  autoProcessResumes: boolean;
  defaultApplicationStatus: string;
  lastChecked?: Date;

  // Metadata
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

class EmailAccountService extends FirestoreBaseService<IEmailAccount> {
  constructor() {
    super("emailAccounts");
  }

  async findByEmail(email: string): Promise<IEmailAccount | null> {
    const accounts = await this.find([
      { field: "email", operator: "==", value: email.toLowerCase() },
    ]);
    return accounts.length > 0 ? accounts[0] : null;
  }

  async findActive(): Promise<IEmailAccount[]> {
    return this.find([{ field: "isActive", operator: "==", value: true }]);
  }

  async findByProvider(provider: IEmailAccount["provider"]): Promise<IEmailAccount[]> {
    return this.find([{ field: "provider", operator: "==", value: provider }]);
  }

  async updateLastChecked(id: string): Promise<void> {
    await this.update(id, {
      lastChecked: new Date(),
      updatedAt: new Date(),
    });
  }

  async activate(id: string, updatedBy?: string): Promise<void> {
    await this.update(id, {
      isActive: true,
      updatedAt: new Date(),
      updatedBy,
    });
  }

  async deactivate(id: string, updatedBy?: string): Promise<void> {
    await this.update(id, {
      isActive: false,
      updatedAt: new Date(),
      updatedBy,
    });
  }
}

export const emailAccountService = new EmailAccountService();
