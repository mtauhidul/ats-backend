import { FirestoreBaseService } from "./base.service";

export interface IInterviewFeedback {
  interviewerId: string;
  rating: number; // 1-5
  strengths: string[];
  weaknesses: string[];
  comments: string;
  recommendation: "strong_yes" | "yes" | "maybe" | "no" | "strong_no";
  submittedAt: Date;
}

export interface IInterview {
  id?: string;
  candidateId: string;
  jobId: string;
  clientId: string;
  applicationId?: string;

  // Interview Details
  type: "phone" | "video" | "in-person" | "technical" | "hr" | "final";
  round: number;
  title: string;
  description?: string;

  // Scheduling
  scheduledAt: Date;
  duration: number; // minutes
  timezone: string;
  location?: string; // For in-person

  // Video Meeting (Zoom)
  meetingLink?: string;
  meetingId?: string;
  meetingPassword?: string;
  zoomMeetingDetails?: any; // Full Zoom response

  // Participants
  interviewerIds: string[];
  organizerId: string;

  // Status
  status:
    | "scheduled"
    | "confirmed"
    | "in-progress"
    | "completed"
    | "cancelled"
    | "no-show";

  // Feedback
  feedback?: IInterviewFeedback[];

  // Notes
  notes?: string;
  internalNotes?: string;

  // Reminders
  reminderSent?: boolean;
  reminderSentAt?: Date;

  // Metadata
  createdBy: string;
  updatedBy?: string;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

class InterviewService extends FirestoreBaseService<IInterview> {
  constructor() {
    super("interviews");
  }

  /**
   * Find interviews by candidate ID
   */
  async findByCandidateId(candidateId: string): Promise<IInterview[]> {
    return this.find(
      [{ field: "candidateId", operator: "==", value: candidateId }],
      { orderBy: [{ field: "scheduledAt", direction: "desc" }] }
    );
  }

  /**
   * Find interviews by job ID
   */
  async findByJobId(jobId: string): Promise<IInterview[]> {
    return this.find(
      [{ field: "jobId", operator: "==", value: jobId }],
      { orderBy: [{ field: "scheduledAt", direction: "desc" }] }
    );
  }

  /**
   * Find interviews by status
   */
  async findByStatus(status: IInterview["status"]): Promise<IInterview[]> {
    return this.find(
      [{ field: "status", operator: "==", value: status }],
      { orderBy: [{ field: "scheduledAt", direction: "asc" }] }
    );
  }

  /**
   * Find interviews by interviewer ID
   */
  async findByInterviewerId(interviewerId: string): Promise<IInterview[]> {
    return this.find(
      [{ field: "interviewerIds", operator: "array-contains", value: interviewerId }],
      { orderBy: [{ field: "scheduledAt", direction: "desc" }] }
    );
  }

  /**
   * Find interviews by organizer ID
   */
  async findByOrganizerId(organizerId: string): Promise<IInterview[]> {
    return this.find(
      [{ field: "organizerId", operator: "==", value: organizerId }],
      { orderBy: [{ field: "scheduledAt", direction: "desc" }] }
    );
  }

  /**
   * Find upcoming interviews
   */
  async findUpcoming(limit: number = 10): Promise<IInterview[]> {
    const now = new Date();
    return this.find(
      [
        { field: "scheduledAt", operator: ">=", value: now },
        { field: "status", operator: "in", value: ["scheduled", "confirmed"] },
      ],
      { orderBy: [{ field: "scheduledAt", direction: "asc" }], limit }
    );
  }

  /**
   * Find interviews scheduled for a date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<IInterview[]> {
    return this.find(
      [
        { field: "scheduledAt", operator: ">=", value: startDate },
        { field: "scheduledAt", operator: "<=", value: endDate },
      ],
      { orderBy: [{ field: "scheduledAt", direction: "asc" }] }
    );
  }

  /**
   * Update interview status
   */
  async updateStatus(
    id: string,
    status: IInterview["status"],
    updatedBy?: string
  ): Promise<void> {
    const updates: Partial<IInterview> = {
      status,
      updatedAt: new Date(),
      updatedBy,
    };

    if (status === "completed") {
      updates.completedAt = new Date();
    } else if (status === "cancelled") {
      updates.cancelledAt = new Date();
    }

    await this.update(id, updates);
  }

  /**
   * Cancel interview
   */
  async cancel(
    id: string,
    reason: string,
    updatedBy?: string
  ): Promise<void> {
    await this.update(id, {
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: reason,
      updatedAt: new Date(),
      updatedBy,
    });
  }

  /**
   * Add feedback to interview
   */
  async addFeedback(
    id: string,
    feedback: IInterviewFeedback
  ): Promise<void> {
    const interview = await this.findById(id);
    if (!interview) {
      throw new Error("Interview not found");
    }

    const existingFeedback = interview.feedback || [];
    
    // Check if interviewer already submitted feedback
    const existingIndex = existingFeedback.findIndex(
      (f) => f.interviewerId === feedback.interviewerId
    );

    if (existingIndex >= 0) {
      // Update existing feedback
      existingFeedback[existingIndex] = feedback;
    } else {
      // Add new feedback
      existingFeedback.push(feedback);
    }

    await this.update(id, {
      feedback: existingFeedback,
      updatedAt: new Date(),
    });
  }

  /**
   * Update Zoom meeting details
   */
  async updateZoomDetails(
    id: string,
    zoomDetails: {
      meetingLink: string;
      meetingId: string;
      meetingPassword?: string;
      zoomMeetingDetails?: any;
    }
  ): Promise<void> {
    await this.update(id, {
      ...zoomDetails,
      updatedAt: new Date(),
    });
  }

  /**
   * Mark reminder as sent
   */
  async markReminderSent(id: string): Promise<void> {
    await this.update(id, {
      reminderSent: true,
      reminderSentAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Get interviews needing reminders (24 hours before, not yet sent)
   */
  async findNeedingReminders(): Promise<IInterview[]> {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfterTomorrow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    return this.find([
      { field: "scheduledAt", operator: ">=", value: tomorrow },
      { field: "scheduledAt", operator: "<=", value: dayAfterTomorrow },
      { field: "reminderSent", operator: "==", value: false },
      { field: "status", operator: "in", value: ["scheduled", "confirmed"] },
    ]);
  }

  /**
   * Get interview statistics for a candidate
   */
  async getCandidateInterviewStats(candidateId: string): Promise<{
    total: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    averageRating?: number;
  }> {
    const interviews = await this.findByCandidateId(candidateId);

    const stats = {
      total: interviews.length,
      scheduled: interviews.filter((i) =>
        ["scheduled", "confirmed"].includes(i.status)
      ).length,
      completed: interviews.filter((i) => i.status === "completed").length,
      cancelled: interviews.filter((i) => i.status === "cancelled").length,
    };

    // Calculate average rating from completed interviews with feedback
    const completedWithFeedback = interviews.filter(
      (i) => i.status === "completed" && i.feedback && i.feedback.length > 0
    );

    if (completedWithFeedback.length > 0) {
      const totalRatings = completedWithFeedback.reduce((sum, interview) => {
        const avgInterviewRating =
          interview.feedback!.reduce((s, f) => s + f.rating, 0) /
          interview.feedback!.length;
        return sum + avgInterviewRating;
      }, 0);

      return {
        ...stats,
        averageRating: totalRatings / completedWithFeedback.length,
      };
    }

    return stats;
  }

  /**
   * Subscribe to upcoming interviews
   */
  subscribeToUpcomingInterviews(
    callback: (interviews: IInterview[]) => void,
    options?: { limit?: number }
  ): () => void {
    const now = new Date();
    return this.subscribeToCollection(
      [
        { field: "scheduledAt", operator: ">=", value: now },
        { field: "status", operator: "in", value: ["scheduled", "confirmed"] },
      ],
      callback,
      options
    );
  }

  /**
   * Subscribe to interviews by candidate
   */
  subscribeToCandidateInterviews(
    candidateId: string,
    callback: (interviews: IInterview[]) => void,
    options?: { limit?: number }
  ): () => void {
    return this.subscribeToCollection(
      [{ field: "candidateId", operator: "==", value: candidateId }],
      callback,
      options
    );
  }
}

export const interviewService = new InterviewService();
