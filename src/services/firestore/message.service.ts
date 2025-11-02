import { FirestoreBaseService } from "./base.service";

export interface IMessage {
  id?: string;
  
  // Internal messaging
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  senderRole?: string;
  senderAvatar?: string;
  recipientId?: string;
  recipientName?: string;
  recipientRole?: string;
  recipientAvatar?: string;
  message?: string;
  read?: boolean;
  sentAt?: Date;

  // Email tracking (for candidate communications)
  candidateId?: string;
  subject?: string;
  body?: string;
  from?: string;
  to?: string;
  direction?: "inbound" | "outbound";
  status?: "received" | "sent" | "unmatched";
  receivedAt?: Date;
  emailId?: string; // Resend email ID

  createdAt: Date;
  updatedAt: Date;
}

class MessageService extends FirestoreBaseService<IMessage> {
  constructor() {
    super("messages");
  }

  async findByConversationId(conversationId: string): Promise<IMessage[]> {
    return this.find(
      [{ field: "conversationId", operator: "==", value: conversationId }],
      { orderBy: [{ field: "createdAt", direction: "asc" }] }
    );
  }

  async findBySenderId(senderId: string): Promise<IMessage[]> {
    return this.find(
      [{ field: "senderId", operator: "==", value: senderId }],
      { orderBy: [{ field: "createdAt", direction: "desc" }] }
    );
  }

  async findByRecipientId(recipientId: string): Promise<IMessage[]> {
    return this.find(
      [{ field: "recipientId", operator: "==", value: recipientId }],
      { orderBy: [{ field: "createdAt", direction: "desc" }] }
    );
  }

  async findUnreadByRecipientId(recipientId: string): Promise<IMessage[]> {
    return this.find([
      { field: "recipientId", operator: "==", value: recipientId },
      { field: "read", operator: "==", value: false },
    ]);
  }

  async findByCandidateId(candidateId: string): Promise<IMessage[]> {
    return this.find(
      [{ field: "candidateId", operator: "==", value: candidateId }],
      { orderBy: [{ field: "createdAt", direction: "desc" }] }
    );
  }

  async findByEmailId(emailId: string): Promise<IMessage | null> {
    const messages = await this.find([
      { field: "emailId", operator: "==", value: emailId },
    ]);
    return messages.length > 0 ? messages[0] : null;
  }

  async markAsRead(id: string): Promise<void> {
    await this.update(id, {
      read: true,
      updatedAt: new Date(),
    });
  }

  async markConversationAsRead(conversationId: string): Promise<void> {
    const messages = await this.findByConversationId(conversationId);
    const updates = messages
      .filter((msg) => !msg.read)
      .map((msg) => this.markAsRead(msg.id!));

    await Promise.all(updates);
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    return this.count([
      { field: "recipientId", operator: "==", value: recipientId },
      { field: "read", operator: "==", value: false },
    ]);
  }

  async findConversationsBetweenUsers(
    userId1: string,
    userId2: string
  ): Promise<IMessage[]> {
    // This requires OR query which Firestore doesn't support directly
    // We need to do two queries and merge
    const sentMessages = await this.find([
      { field: "senderId", operator: "==", value: userId1 },
      { field: "recipientId", operator: "==", value: userId2 },
    ]);

    const receivedMessages = await this.find([
      { field: "senderId", operator: "==", value: userId2 },
      { field: "recipientId", operator: "==", value: userId1 },
    ]);

    // Merge and sort by createdAt
    const allMessages = [...sentMessages, ...receivedMessages];
    allMessages.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    return allMessages;
  }

  subscribeToConversation(
    conversationId: string,
    callback: (messages: IMessage[]) => void
  ): () => void {
    return this.subscribeToCollection(
      [{ field: "conversationId", operator: "==", value: conversationId }],
      callback,
      { orderBy: [{ field: "createdAt", direction: "asc" }] }
    );
  }

  subscribeToUnreadMessages(
    recipientId: string,
    callback: (messages: IMessage[]) => void
  ): () => void {
    return this.subscribeToCollection(
      [
        { field: "recipientId", operator: "==", value: recipientId },
        { field: "read", operator: "==", value: false },
      ],
      callback
    );
  }
}

export const messageService = new MessageService();
