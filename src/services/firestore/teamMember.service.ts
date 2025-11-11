import { FirestoreBaseService } from "./base.service";

/**
 * Unified permissions schema matching frontend and User collection
 */
export interface TeamMemberPermissions {
  canManageClients: boolean;
  canManageJobs: boolean;
  canReviewApplications: boolean;
  canManageCandidates: boolean;
  canSendEmails: boolean;
  canManageTeam: boolean;
  canAccessAnalytics: boolean;
}

/**
 * TeamMember interface - represents job-specific team assignments
 * Note: For general user permissions, use User.permissions
 * TeamMember permissions are job-specific overrides
 */
export interface ITeamMember {
  id?: string;
  userId: string;
  jobId?: string;
  role: "admin" | "recruiter" | "hiring_manager" | "interviewer" | "coordinator" | "viewer";
  permissions: TeamMemberPermissions;
  isActive: boolean;
  addedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

class TeamMemberService extends FirestoreBaseService<ITeamMember> {
  constructor() {
    super("teamMembers");
  }

  async findByUserId(userId: string): Promise<ITeamMember[]> {
    return this.find([{ field: "userId", operator: "==", value: userId }]);
  }

  async findByJobId(jobId: string): Promise<ITeamMember[]> {
    return this.find([{ field: "jobId", operator: "==", value: jobId }]);
  }

  async findActiveByJobId(jobId: string): Promise<ITeamMember[]> {
    return this.find([
      { field: "jobId", operator: "==", value: jobId },
      { field: "isActive", operator: "==", value: true },
    ]);
  }

  async findByRole(role: ITeamMember["role"]): Promise<ITeamMember[]> {
    return this.find([{ field: "role", operator: "==", value: role }]);
  }

  async findByUserAndJob(
    userId: string,
    jobId: string
  ): Promise<ITeamMember | null> {
    const members = await this.find([
      { field: "userId", operator: "==", value: userId },
      { field: "jobId", operator: "==", value: jobId },
    ]);
    return members.length > 0 ? members[0] : null;
  }

  async updatePermissions(
    id: string,
    permissions: Partial<TeamMemberPermissions>
  ): Promise<void> {
    const member = await this.findById(id);
    if (!member) {
      throw new Error("Team member not found");
    }

    await this.update(id, {
      permissions: { ...member.permissions, ...permissions },
      updatedAt: new Date(),
    });
  }

  async activate(id: string): Promise<void> {
    await this.update(id, {
      isActive: true,
      updatedAt: new Date(),
    });
  }

  async deactivate(id: string): Promise<void> {
    await this.update(id, {
      isActive: false,
      updatedAt: new Date(),
    });
  }
}

export const teamMemberService = new TeamMemberService();
