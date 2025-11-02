import { FirestoreBaseService } from "./base.service";

export interface IUser {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  avatar?: string;
  phone?: string;
  title?: string;
  department?: string;
  role:
    | "admin"
    | "recruiter"
    | "hiring_manager"
    | "interviewer"
    | "coordinator";
  isActive: boolean;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  magicLinkToken?: string;
  magicLinkExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  refreshToken?: string;
  lastLogin?: Date;
  permissions?: {
    canManageClients?: boolean;
    canManageJobs?: boolean;
    canReviewApplications?: boolean;
    canManageCandidates?: boolean;
    canSendEmails?: boolean;
    canManageTeam?: boolean;
    canAccessAnalytics?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

class UserService extends FirestoreBaseService<IUser> {
  constructor() {
    super("users");
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<IUser | null> {
    const users = await this.find([
      { field: "email", operator: "==", value: email.toLowerCase() },
    ]);
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Find active users
   */
  async findActive(): Promise<IUser[]> {
    return this.find([{ field: "isActive", operator: "==", value: true }]);
  }

  /**
   * Find users by role
   */
  async findByRole(role: IUser["role"]): Promise<IUser[]> {
    return this.find([{ field: "role", operator: "==", value: role }]);
  }

  /**
   * Find user by magic link token
   */
  async findByMagicLinkToken(token: string): Promise<IUser | null> {
    const users = await this.find([
      { field: "magicLinkToken", operator: "==", value: token },
    ]);
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Find user by password reset token
   */
  async findByPasswordResetToken(token: string): Promise<IUser | null> {
    const users = await this.find([
      { field: "passwordResetToken", operator: "==", value: token },
    ]);
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Find user by email verification token
   */
  async findByEmailVerificationToken(token: string): Promise<IUser | null> {
    const users = await this.find([
      { field: "emailVerificationToken", operator: "==", value: token },
    ]);
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.update(id, {
      lastLogin: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Verify email
   */
  async verifyEmail(id: string): Promise<void> {
    await this.update(id, {
      emailVerified: true,
      emailVerificationToken: undefined,
      emailVerificationExpires: undefined,
      updatedAt: new Date(),
    });
  }

  /**
   * Update password
   */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.update(id, {
      passwordHash,
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
      updatedAt: new Date(),
    });
  }

  /**
   * Set magic link token
   */
  async setMagicLinkToken(
    id: string,
    token: string,
    expiresAt: Date
  ): Promise<void> {
    await this.update(id, {
      magicLinkToken: token,
      magicLinkExpires: expiresAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Set password reset token
   */
  async setPasswordResetToken(
    id: string,
    token: string,
    expiresAt: Date
  ): Promise<void> {
    await this.update(id, {
      passwordResetToken: token,
      passwordResetExpires: expiresAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Set email verification token
   */
  async setEmailVerificationToken(
    id: string,
    token: string,
    expiresAt: Date
  ): Promise<void> {
    await this.update(id, {
      emailVerificationToken: token,
      emailVerificationExpires: expiresAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Update refresh token
   */
  async updateRefreshToken(
    id: string,
    refreshToken: string | null
  ): Promise<void> {
    await this.update(id, {
      refreshToken: refreshToken || undefined,
      updatedAt: new Date(),
    });
  }

  /**
   * Deactivate user
   */
  async deactivate(id: string): Promise<void> {
    await this.update(id, {
      isActive: false,
      updatedAt: new Date(),
    });
  }

  /**
   * Activate user
   */
  async activate(id: string): Promise<void> {
    await this.update(id, {
      isActive: true,
      updatedAt: new Date(),
    });
  }

  /**
   * Update user permissions
   */
  async updatePermissions(
    id: string,
    permissions: IUser["permissions"]
  ): Promise<void> {
    await this.update(id, {
      permissions,
      updatedAt: new Date(),
    });
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return user !== null;
  }
}

export const userService = new UserService();
