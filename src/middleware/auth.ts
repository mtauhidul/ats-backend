import { NextFunction, Request, Response } from "express";
import { IUser, User } from "../models";
import { AuthenticationError, AuthorizationError } from "../utils/errors";
import { verifyAccessToken, TokenPayload } from "../utils/auth";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
      tokenPayload?: TokenPayload;
    }
  }
}

/**
 * Verify JWT token and attach user to request
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

    // Verify JWT token
    const payload = verifyAccessToken(token);

    if (!payload) {
      throw new AuthenticationError("Invalid or expired token");
    }

    // Find user in database
    const user = await User.findById(payload.userId);

    if (!user) {
      throw new AuthenticationError("User not found");
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AuthenticationError("Your account has been deactivated");
    }

    // Attach user to request
    req.user = user;
    req.userId = String(user._id);
    req.tokenPayload = payload;

    next();
  } catch (error: unknown) {
    const errorMessage = (error as Error).message || "Authentication failed";
    next(new AuthenticationError(errorMessage));
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
 * Require admin role
 */
export const requireAdmin = requireRole("admin");

/**
 * Check if user has permission
 */
export const hasPermission = (requiredPermission: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError("User not authenticated"));
    }

    // Admins have all permissions
    if (req.user.role === "admin") {
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
      const payload = verifyAccessToken(token);

      if (payload) {
        const user = await User.findById(payload.userId);

        if (user && user.isActive) {
          req.user = user;
          req.userId = String(user._id);
          req.tokenPayload = payload;
        }
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};
