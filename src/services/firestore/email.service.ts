import { FirestoreBaseService } from "./base.service";

export interface IEmail {
  id?: string;
  direction: "inbound" | "outbound";
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
  status:
    | "sent"
    | "delivered"
    | "delayed"
    | "bounced"
    | "complained"
    | "failed"
    | "received"
    | "draft";
  sentAt?: Date;
  receivedAt?: Date;
  deliveredAt?: Date;
  bouncedAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  openCount?: number;
  clickCount?: number;

  // Resend integration
  resendId?: string;

  // Relationships
  candidateId?: string;
  applicationId?: string;
  jobId?: string;
  clientId?: string;
  interviewId?: string;
  emailAccountId?: string;

  // Metadata
  messageId?: string;
  inReplyTo?: string;
  threadId?: string;

  // Error tracking
  error?: string;
  retryCount?: number;

  // Sender/Creator
  sentBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

class EmailService extends FirestoreBaseService<IEmail> {
  constructor() {
    super("emails");
  }

  async findByDirection(direction: IEmail["direction"]): Promise<IEmail[]> {
    return this.find(
      [{ field: "direction", operator: "==", value: direction }],
      { orderBy: [{ field: "createdAt", direction: "desc" }] }
    );
  }

  async findByStatus(status: IEmail["status"]): Promise<IEmail[]> {
    return this.find(
      [{ field: "status", operator: "==", value: status }],
      { orderBy: [{ field: "createdAt", direction: "desc" }] }
    );
  }

  async findByCandidateId(candidateId: string): Promise<IEmail[]> {
    return this.find(
      [{ field: "candidateId", operator: "==", value: candidateId }],
      { orderBy: [{ field: "createdAt", direction: "desc" }] }
    );
  }

  async findByApplicationId(applicationId: string): Promise<IEmail[]> {
    return this.find(
      [{ field: "applicationId", operator: "==", value: applicationId }],
      { orderBy: [{ field: "createdAt", direction: "desc" }] }
    );
  }

  async findByJobId(jobId: string): Promise<IEmail[]> {
    return this.find(
      [{ field: "jobId", operator: "==", value: jobId }],
      { orderBy: [{ field: "createdAt", direction: "desc" }] }
    );
  }

  async findByThreadId(threadId: string): Promise<IEmail[]> {
    return this.find(
      [{ field: "threadId", operator: "==", value: threadId }],
      { orderBy: [{ field: "createdAt", direction: "asc" }] }
    );
  }

  async findByMessageId(messageId: string): Promise<IEmail | null> {
    const emails = await this.find([
      { field: "messageId", operator: "==", value: messageId },
    ]);
    return emails.length > 0 ? emails[0] : null;
  }

  async updateStatus(
    id: string,
    status: IEmail["status"],
    metadata?: { error?: string }
  ): Promise<void> {
    const updates: Partial<IEmail> = {
      status,
      updatedAt: new Date(),
    };

    if (metadata?.error) {
      updates.error = metadata.error;
    }

    // Update timestamps based on status
    if (status === "sent") {
      updates.sentAt = new Date();
    } else if (status === "delivered") {
      updates.deliveredAt = new Date();
    } else if (status === "bounced") {
      updates.bouncedAt = new Date();
    } else if (status === "received") {
      updates.receivedAt = new Date();
    }

    await this.update(id, updates);
  }

  async trackOpen(id: string): Promise<void> {
    const email = await this.findById(id);
    if (!email) {
      throw new Error("Email not found");
    }

    await this.update(id, {
      openedAt: email.openedAt || new Date(),
      openCount: (email.openCount || 0) + 1,
      updatedAt: new Date(),
    });
  }

  async trackClick(id: string): Promise<void> {
    const email = await this.findById(id);
    if (!email) {
      throw new Error("Email not found");
    }

    await this.update(id, {
      clickedAt: email.clickedAt || new Date(),
      clickCount: (email.clickCount || 0) + 1,
      updatedAt: new Date(),
    });
  }

  async incrementRetryCount(id: string): Promise<void> {
    const email = await this.findById(id);
    if (!email) {
      throw new Error("Email not found");
    }

    await this.update(id, {
      retryCount: (email.retryCount || 0) + 1,
      updatedAt: new Date(),
    });
  }

  async findFailedEmails(limit: number = 10): Promise<IEmail[]> {
    return this.find(
      [{ field: "status", operator: "==", value: "failed" }],
      {
        orderBy: [{ field: "createdAt", direction: "desc" }],
        limit,
      }
    );
  }

  async findRecentByEmailAccountId(
    emailAccountId: string,
    limit: number = 50
  ): Promise<IEmail[]> {
    return this.find(
      [{ field: "emailAccountId", operator: "==", value: emailAccountId }],
      {
        orderBy: [{ field: "createdAt", direction: "desc" }],
        limit,
      }
    );
  }
}

export const emailService = new EmailService();
