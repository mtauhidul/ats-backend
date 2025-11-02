import { FirestoreBaseService } from "./base.service";

export interface IClient {
  id?: string;
  
  // Basic Information
  companyName: string;
  email: string;
  phone: string;
  website?: string;
  logo?: string;

  // Classification
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

  // Location
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };

  // Description
  description?: string;

  // Contacts
  contacts?: Array<{
    id?: string;
    name: string;
    email: string;
    phone?: string;
    position?: string;
    isPrimary: boolean;
  }>;

  // Statistics
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
  jobIds?: string[];

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
    action: string;
    description: string;
    performedBy: string;
    performedByName: string;
    timestamp: Date;
  }>;

  // Metadata
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

class ClientService extends FirestoreBaseService<IClient> {
  constructor() {
    super("clients");
  }

  /**
   * Find client by email
   */
  async findByEmail(email: string): Promise<IClient | null> {
    const clients = await this.find([
      { field: "email", operator: "==", value: email.toLowerCase() },
    ]);
    return clients.length > 0 ? clients[0] : null;
  }

  /**
   * Find client by company name
   */
  async findByCompanyName(companyName: string): Promise<IClient[]> {
    return this.find([
      { field: "companyName", operator: "==", value: companyName },
    ]);
  }

  /**
   * Find clients by status
   */
  async findByStatus(status: IClient["status"]): Promise<IClient[]> {
    return this.find([{ field: "status", operator: "==", value: status }]);
  }

  /**
   * Find active clients
   */
  async findActive(): Promise<IClient[]> {
    return this.findByStatus("active");
  }

  /**
   * Find clients by industry
   */
  async findByIndustry(industry: IClient["industry"]): Promise<IClient[]> {
    return this.find([{ field: "industry", operator: "==", value: industry }]);
  }

  /**
   * Find clients by company size
   */
  async findByCompanySize(size: IClient["companySize"]): Promise<IClient[]> {
    return this.find([{ field: "companySize", operator: "==", value: size }]);
  }

  /**
   * Update client status
   */
  async updateStatus(
    id: string,
    status: IClient["status"],
    updatedBy?: string
  ): Promise<void> {
    await this.update(id, {
      status,
      updatedAt: new Date(),
      updatedBy,
    });
  }

  /**
   * Add communication note
   */
  async addCommunicationNote(
    id: string,
    note: {
      clientId: string;
      type: "email" | "phone" | "meeting" | "video_call" | "general";
      subject: string;
      content: string;
      createdBy: string;
      createdByName: string;
      createdAt: Date;
      updatedAt: Date;
    }
  ): Promise<void> {
    const client = await this.findById(id);
    if (!client) {
      throw new Error("Client not found");
    }

    const notes = client.communicationNotes || [];
    const newNote = {
      ...note,
      id: `note_${Date.now()}`,
    };

    notes.push(newNote);

    await this.update(id, {
      communicationNotes: notes,
      updatedAt: new Date(),
    });
  }

  /**
   * Add activity to history
   */
  async addActivity(
    id: string,
    activity: {
      action: string;
      description: string;
      performedBy: string;
      performedByName: string;
      timestamp: Date;
    }
  ): Promise<void> {
    const client = await this.findById(id);
    if (!client) {
      throw new Error("Client not found");
    }

    const history = client.activityHistory || [];
    const newActivity = {
      ...activity,
      id: `activity_${Date.now()}`,
    };

    history.push(newActivity);

    await this.update(id, {
      activityHistory: history,
      updatedAt: new Date(),
    });
  }

  /**
   * Update client statistics
   */
  async updateStatistics(
    id: string,
    statistics: Partial<IClient["statistics"]>
  ): Promise<void> {
    const client = await this.findById(id);
    if (!client) {
      throw new Error("Client not found");
    }

    const updatedStats = {
      ...(client.statistics || {}),
      ...statistics,
    };

    await this.update(id, {
      statistics: updatedStats as IClient["statistics"],
      updatedAt: new Date(),
    });
  }

  /**
   * Add contact to client
   */
  async addContact(
    id: string,
    contact: {
      name: string;
      email: string;
      phone?: string;
      position?: string;
      isPrimary: boolean;
    }
  ): Promise<void> {
    const client = await this.findById(id);
    if (!client) {
      throw new Error("Client not found");
    }

    const contacts = client.contacts || [];
    const newContact = {
      ...contact,
      id: `contact_${Date.now()}`,
    };

    contacts.push(newContact);

    await this.update(id, {
      contacts,
      updatedAt: new Date(),
    });
  }

  /**
   * Remove contact from client
   */
  async removeContact(id: string, contactId: string): Promise<void> {
    const client = await this.findById(id);
    if (!client) {
      throw new Error("Client not found");
    }

    const contacts = (client.contacts || []).filter((c) => c.id !== contactId);

    await this.update(id, {
      contacts,
      updatedAt: new Date(),
    });
  }

  /**
   * Update primary contact
   */
  async updatePrimaryContact(id: string, contactId: string): Promise<void> {
    const client = await this.findById(id);
    if (!client) {
      throw new Error("Client not found");
    }

    const contacts = (client.contacts || []).map((c) => ({
      ...c,
      isPrimary: c.id === contactId,
    }));

    await this.update(id, {
      contacts,
      updatedAt: new Date(),
    });
  }

  /**
   * Search clients by name (partial match)
   */
  async searchByName(searchTerm: string): Promise<IClient[]> {
    // Note: Firestore doesn't support full-text search natively
    // This is a simple implementation - for better search, use Algolia or similar
    const allClients = await this.findAll();
    return allClients.filter((client) =>
      client.companyName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  /**
   * Subscribe to active clients
   */
  subscribeToActiveClients(
    callback: (clients: IClient[]) => void,
    options?: { limit?: number }
  ): () => void {
    return this.subscribeToCollection(
      [{ field: "status", operator: "==", value: "active" }],
      callback,
      options
    );
  }
}

export const clientService = new ClientService();
