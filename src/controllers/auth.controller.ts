import { Request, Response } from 'express';
import { User } from '../models';
import { asyncHandler, successResponse } from '../utils/helpers';
import { BadRequestError, AuthenticationError, NotFoundError } from '../utils/errors';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateToken,
  generateRandomPassword,
  validatePasswordStrength,
  validateEmail,
  TokenPayload,
} from '../utils/auth';
import { sendInvitationEmail, sendMagicLinkEmail, sendPasswordResetEmail } from '../services/email.service';
import { logActivity } from '../services/activity.service';
import logger from '../utils/logger';

/**
 * Register new user (Admin only - creates user and sends invitation)
 */
export const register = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email, firstName, lastName, role, department, title, phone, permissions } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName) {
      throw new BadRequestError('Email, first name, and last name are required');
    }

    // Validate email format
    if (!validateEmail(email)) {
      throw new BadRequestError('Invalid email format');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new BadRequestError('User with this email already exists');
    }

    // Generate random password and email verification token
    const randomPassword = generateRandomPassword();
    const passwordHash = await hashPassword(randomPassword);
    const emailVerificationToken = generateToken();
    const emailVerificationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Set default permissions based on role
    const userRole = role || 'recruiter';
    const defaultPermissions = userRole === 'admin' ? {
      canManageClients: true,
      canManageJobs: true,
      canReviewApplications: true,
      canManageCandidates: true,
      canSendEmails: true,
      canManageTeam: true,
      canAccessAnalytics: true,
    } : {
      canManageClients: false,
      canManageJobs: false,
      canReviewApplications: true,
      canManageCandidates: userRole === 'recruiter',
      canSendEmails: true,
      canManageTeam: false,
      canAccessAnalytics: false,
    };

    // Use custom permissions if provided, otherwise use defaults
    const userPermissions = permissions ? { ...defaultPermissions, ...permissions } : defaultPermissions;

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      firstName,
      lastName,
      passwordHash,
      role: userRole,
      department,
      title,
      phone,
      emailVerified: false,
      emailVerificationToken,
      emailVerificationExpires,
      isActive: true,
      permissions: userPermissions,
    });

    logger.info(`New user registered: ${user.email} by ${req.user?.email}`);

    // Send invitation email with email verification link
    const emailSent = await sendInvitationEmail(user.email, user.firstName, emailVerificationToken);
    
    if (!emailSent) {
      logger.warn(`Failed to send invitation email to ${user.email}`);
    }

    successResponse(
      res,
      {
        user: user.toJSON(),
        message: emailSent ? 'Invitation email sent to user' : 'User created but email failed to send',
      },
      'User registered successfully',
      201
    );
  }
);

/**
 * Register first admin user (public - only works if no users exist)
 */
export const registerFirstAdmin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email, firstName, lastName, password } = req.body;

    // Check if any users exist
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      throw new BadRequestError('Admin user already exists. Please contact your administrator.');
    }

    // Validate required fields
    if (!email || !firstName || !lastName || !password) {
      throw new BadRequestError('Email, first name, last name, and password are required');
    }

    // Validate email format
    if (!validateEmail(email)) {
      throw new BadRequestError('Invalid email format');
    }

    // Validate password strength (min 8 chars)
    if (password.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters long');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Admin gets all permissions by default
    const adminPermissions = {
      canManageClients: true,
      canManageJobs: true,
      canReviewApplications: true,
      canManageCandidates: true,
      canSendEmails: true,
      canManageTeam: true,
      canAccessAnalytics: true,
    };

    // Create first admin user (auto-verified)
    const admin = await User.create({
      email: email.toLowerCase(),
      firstName,
      lastName,
      passwordHash,
      role: 'admin',
      isActive: true,
      emailVerified: true, // Auto-verify first admin
      permissions: adminPermissions,
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: (admin._id as any).toString(),
      email: admin.email,
      role: admin.role,
    });

    const refreshToken = generateRefreshToken({
      userId: (admin._id as any).toString(),
      email: admin.email,
      role: admin.role,
    });

    // Save refresh token
    admin.refreshToken = refreshToken;
    (admin as any).refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await admin.save();

    logger.info('First admin user created', { userId: admin._id, email: admin.email });

    successResponse(
      res,
      {
        user: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          isActive: admin.isActive,
          emailVerified: admin.emailVerified,
        },
        accessToken,
        refreshToken,
      },
      'First admin user created successfully',
      201
    );
  }
);

/**
 * Login with email and password
 */
export const login = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    // Find user with password hash (explicitly select it)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AuthenticationError('Your account has been deactivated. Please contact an administrator.');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new AuthenticationError('Please verify your email before logging in');
    }

    // Generate tokens
    const payload: TokenPayload = {
      userId: String(user._id),
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Save refresh token to user
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    // Log activity
    await logActivity({
      userId: String(user._id),
      action: 'login',
      metadata: { method: 'password' }
    });

    logger.info(`User logged in: ${user.email}`);

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    successResponse(res, {
      user: user.toJSON(),
      accessToken,
    }, 'Login successful');
  }
);

/**
 * Request magic link (passwordless login)
 */
export const requestMagicLink = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    // Validate email
    if (!email || !validateEmail(email)) {
      throw new BadRequestError('Valid email is required');
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Don't reveal if user exists or not for security
      successResponse(res, {}, 'If an account exists, a magic link has been sent to your email');
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AuthenticationError('Your account has been deactivated');
    }

    // Generate magic link token
    const magicLinkToken = generateToken();
    const magicLinkExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.magicLinkToken = magicLinkToken;
    user.magicLinkExpires = magicLinkExpires;
    await user.save();

    logger.info(`Magic link requested for: ${user.email}`);

    // Send magic link email
    const emailSent = await sendMagicLinkEmail(user.email, user.firstName, magicLinkToken);
    
    if (!emailSent) {
      logger.warn(`Failed to send magic link email to ${user.email}`);
    }

    successResponse(res, {}, 'If an account exists, a magic link has been sent to your email');
  }
);

/**
 * Verify magic link and login
 */
export const verifyMagicLink = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;

    if (!token) {
      throw new BadRequestError('Token is required');
    }

    // Find user with valid magic link token
    const user = await User.findOne({
      magicLinkToken: token,
      magicLinkExpires: { $gt: new Date() },
    }).select('+magicLinkToken +magicLinkExpires');

    if (!user) {
      throw new AuthenticationError('Invalid or expired magic link');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AuthenticationError('Your account has been deactivated');
    }

    // Clear magic link token
    user.magicLinkToken = undefined;
    user.magicLinkExpires = undefined;
    user.emailVerified = true; // Auto-verify email if using magic link
    user.lastLogin = new Date();

    // Generate tokens
    const payload: TokenPayload = {
      userId: String(user._id),
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    user.refreshToken = refreshToken;
    await user.save();

    logger.info(`User logged in via magic link: ${user.email}`);

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    successResponse(res, {
      user: user.toJSON(),
      accessToken,
    }, 'Login successful');
  }
);

/**
 * Verify email with token
 */
export const verifyEmail = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;

    if (!token) {
      throw new BadRequestError('Token is required');
    }

    // Find user with valid email verification token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires +passwordHash');

    if (!user) {
      throw new BadRequestError('Invalid or expired verification token');
    }

    // Mark email as verified but DON'T clear the token yet
    // Token will be cleared when user sets their password
    user.emailVerified = true;
    await user.save();

    logger.info(`Email verified for: ${user.email}`);

    // Generate tokens for auto-login
    const payload: TokenPayload = {
      userId: String(user._id),
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    successResponse(res, {
      user: user.toJSON(),
      accessToken,
    }, 'Email verified successfully');
  }
);

/**
 * Set password after email verification (for new users)
 */
export const setPassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { token, password } = req.body;

    if (!token || !password) {
      throw new BadRequestError('Token and password are required');
    }

    // Validate password strength
    if (!validatePasswordStrength(password)) {
      throw new BadRequestError(
        'Password must be at least 8 characters with uppercase, lowercase, and number'
      );
    }

    // Find user with valid email verification token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires +passwordHash');

    if (!user) {
      throw new BadRequestError('Invalid or expired verification token');
    }

    // Hash and set new password
    user.passwordHash = await hashPassword(password);
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    logger.info(`Password set for: ${user.email}`);

    successResponse(res, {}, 'Password set successfully. You can now login.');
  }
);

/**
 * Request password reset
 */
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
      throw new BadRequestError('Valid email is required');
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Don't reveal if user exists or not for security
      successResponse(res, {}, 'If an account exists, a password reset link has been sent to your email');
      return;
    }

    // Generate password reset token
    const passwordResetToken = generateToken();
    const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = passwordResetToken;
    user.passwordResetExpires = passwordResetExpires;
    await user.save();

    logger.info(`Password reset requested for: ${user.email}`);

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(user.email, user.firstName, passwordResetToken);
    
    if (!emailSent) {
      logger.warn(`Failed to send password reset email to ${user.email}`);
    }

    successResponse(res, {}, 'If an account exists, a password reset link has been sent to your email');
  }
);

/**
 * Reset password with token
 */
export const resetPassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { token, password } = req.body;

    if (!token || !password) {
      throw new BadRequestError('Token and password are required');
    }

    // Validate password strength
    if (!validatePasswordStrength(password)) {
      throw new BadRequestError(
        'Password must be at least 8 characters with uppercase, lowercase, and number'
      );
    }

    // Find user with valid password reset token
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +passwordHash');

    if (!user) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    // Hash and set new password
    user.passwordHash = await hashPassword(password);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.info(`Password reset for: ${user.email}`);

    successResponse(res, {}, 'Password reset successfully. You can now login.');
  }
);

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      throw new AuthenticationError('Refresh token is required');
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    // Find user and verify refresh token matches
    const user = await User.findById(payload.userId).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AuthenticationError('Your account has been deactivated');
    }

    // Generate new tokens
    const newPayload: TokenPayload = {
      userId: String(user._id),
      email: user.email,
      role: user.role,
    };

    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    // Update refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    // Set new refresh token cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    successResponse(res, {
      accessToken: newAccessToken,
    }, 'Token refreshed successfully');
  }
);

/**
 * Logout user (clear refresh token)
 */
export const logout = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (userId) {
      // Clear refresh token from database
      await User.findByIdAndUpdate(userId, { refreshToken: undefined });
      logger.info(`User logged out: ${req.user?.email}`);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    successResponse(res, {}, 'Logout successful');
  }
);

/**
 * Get current user
 */
export const getMe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthenticationError('Not authenticated');
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    successResponse(res, user.toJSON(), 'User retrieved successfully');
  }
);

/**
 * Update current user profile
 */
export const updateProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthenticationError('Not authenticated');
    }

    const { firstName, lastName, phone, title, department, avatar } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (title !== undefined) user.title = title;
    if (department !== undefined) user.department = department;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    logger.info('User profile updated', { userId });

    successResponse(res, user.toJSON(), 'Profile updated successfully');
  }
);

/**
 * Update current user password
 */
export const updatePassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new AuthenticationError('Not authenticated');
    }

    if (!currentPassword || !newPassword) {
      throw new BadRequestError('Current password and new password are required');
    }

    // Validate new password strength
    if (!validatePasswordStrength(newPassword)) {
      throw new BadRequestError(
        'Password must be at least 8 characters with uppercase, lowercase, and number'
      );
    }

    // Find user with password hash
    const user = await User.findById(userId).select('+passwordHash');
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Hash and set new password
    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    logger.info(`Password updated for: ${user.email}`);

    successResponse(res, {}, 'Password updated successfully');
  }
);
