import { createClerkClient } from "@clerk/clerk-sdk-node";
import { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { IUser, User } from "../models";
import { AuthenticationError, AuthorizationError } from "../utils/errors";
import logger from "../utils/logger";

// Initialize Clerk client with explicit secret key
const clerkClient = createClerkClient({
  secretKey: config.clerk.secretKey,
});

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
      clerkId?: string;
    }
  }
}

/**
 * Verify Clerk JWT token and attach user to request
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AuthenticationError("No token provided");
    }

    const token = authHeader.substring(7);

    // Verify JWT token with Clerk (automatically fetches public key from JWKS)
    const payload = await clerkClient.verifyToken(token);

    if (!payload || !payload.sub) {
      throw new AuthenticationError("Invalid token");
    }

    const clerkId = payload.sub;

    // Find or create user in our database
    let user = await User.findOne({ clerkId });

    if (!user) {
      // Get user details from Clerk
      const clerkUser = await clerkClient.users.getUser(clerkId);

      // Create user in our database
      user = await User.create({
        clerkId,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        firstName: clerkUser.firstName || "",
        lastName: clerkUser.lastName || "",
        avatar: clerkUser.imageUrl,
        role: "recruiter", // Default role
        isActive: true,
        lastLogin: new Date(),
      });

      logger.info(`New user created from Clerk: ${user.email}`);
    } else {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
    }

    // Attach user to request
    req.user = user;
    req.userId = (user._id as any).toString();
    req.clerkId = clerkId;

    next();
  } catch (error: any) {
    logger.error("Authentication error:", error);
    next(new AuthenticationError(error.message || "Authentication failed"));
  }
};

/**
 * Require specific role(s)
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError("User not authenticated"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AuthorizationError(
          `This action requires one of the following roles: ${allowedRoles.join(
            ", "
          )}`
        )
      );
    }

    next();
  };
};

/**
 * Require admin or super_admin role
 */
export const requireAdmin = requireRole("admin", "super_admin");

/**
 * Require super_admin role only
 */
export const requireSuperAdmin = requireRole("super_admin");

/**
 * Check if user has permission
 */
export const hasPermission = (requiredPermission: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError("User not authenticated"));
    }

    // Super admins have all permissions
    if (req.user.role === "super_admin") {
      return next();
    }

    // Define role-based permissions
    const rolePermissions: Record<string, string[]> = {
      admin: [
        "view_all",
        "create_all",
        "edit_all",
        "delete_all",
        "manage_users",
        "manage_clients",
        "manage_jobs",
        "manage_applications",
        "manage_candidates",
        "manage_interviews",
        "manage_settings",
      ],
      recruiter: [
        "view_all",
        "create_applications",
        "edit_applications",
        "create_candidates",
        "edit_candidates",
        "create_interviews",
        "edit_interviews",
        "view_jobs",
        "view_clients",
      ],
      hiring_manager: [
        "view_all",
        "edit_applications",
        "edit_candidates",
        "create_interviews",
        "edit_interviews",
        "provide_feedback",
      ],
      interviewer: [
        "view_assigned",
        "view_candidates",
        "view_interviews",
        "provide_feedback",
      ],
    };

    const userPermissions = rolePermissions[req.user.role] || [];

    if (!userPermissions.includes(requiredPermission)) {
      return next(
        new AuthorizationError(
          `You do not have the required permission: ${requiredPermission}`
        )
      );
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const session = await clerkClient.sessions.verifySession(
        token,
        config.clerk.jwtKey
      );

      if (session) {
        const clerkId = session.userId;
        const user = await User.findOne({ clerkId });

        if (user) {
          req.user = user;
          req.userId = (user._id as any).toString();
          req.clerkId = clerkId;
        }
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};
