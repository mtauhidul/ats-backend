import { Resend } from 'resend';
import logger from '../utils/logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Initialize Resend client
const resend = new Resend(RESEND_API_KEY);

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Send email using Resend
 */
export const sendEmail = async (options: EmailOptions): Promise<string | null> => {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    if (error) {
      logger.error('Failed to send email:', error);
      return null;
    }

    logger.info(`Email sent successfully: ${data?.id}`);
    return data?.id || null;
  } catch (error) {
    logger.error('Error sending email:', error);
    return null;
  }
};

/**
 * Send team member invitation email
 */
export const sendInvitationEmail = async (
  email: string,
  firstName: string,
  token: string
): Promise<string | null> => {
  const verificationLink = `${FRONTEND_URL}/verify-email/${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #2563eb; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to the Team!</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>You've been invited to join our Applicant Tracking System. Click the button below to activate your account and set your password.</p>
            <div style="text-align: center;">
              <a href="${verificationLink}" class="button">Activate Account</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6b7280;">${verificationLink}</p>
            <p><strong>This link will expire in 48 hours.</strong></p>
            <p>If you didn't request this invitation, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ATS. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Welcome to the Team!
    
    Hi ${firstName},
    
    You've been invited to join our Applicant Tracking System. 
    
    Activate your account by visiting: ${verificationLink}
    
    This link will expire in 48 hours.
    
    If you didn't request this invitation, please ignore this email.
  `;

  return sendEmail({
    to: email,
    subject: 'You\'ve been invited to join the ATS Team',
    html,
    text,
  });
};

/**
 * Send magic link email
 */
export const sendMagicLinkEmail = async (
  email: string,
  firstName: string,
  token: string
): Promise<string | null> => {
  const magicLink = `${FRONTEND_URL}/magic-link/${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #2563eb; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Login Link</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Click the button below to log in to your ATS account:</p>
            <div style="text-align: center;">
              <a href="${magicLink}" class="button">Log In</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6b7280;">${magicLink}</p>
            <div class="warning">
              <p><strong>⚠️ Security Notice:</strong></p>
              <p>This link expires in 15 minutes and can only be used once.</p>
            </div>
            <p>If you didn't request this login link, please ignore this email or contact your administrator if you're concerned about your account security.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ATS. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Your Login Link
    
    Hi ${firstName},
    
    Click the link below to log in to your ATS account:
    ${magicLink}
    
    This link expires in 15 minutes and can only be used once.
    
    If you didn't request this login link, please ignore this email.
  `;

  return sendEmail({
    to: email,
    subject: 'Your login link for ATS',
    html,
    text,
  });
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  email: string,
  firstName: string,
  token: string
): Promise<string | null> => {
  const resetLink = `${FRONTEND_URL}/reset-password/${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #dc2626; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6b7280;">${resetLink}</p>
            <div class="warning">
              <p><strong>⚠️ Security Notice:</strong></p>
              <p>This link expires in 1 hour and can only be used once.</p>
            </div>
            <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ATS. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Reset Your Password
    
    Hi ${firstName},
    
    We received a request to reset your password. 
    
    Reset your password by visiting: ${resetLink}
    
    This link expires in 1 hour and can only be used once.
    
    If you didn't request a password reset, please ignore this email.
  `;

  return sendEmail({
    to: email,
    subject: 'Reset your ATS password',
    html,
    text,
  });
};

/**
 * Send team member update notification email
 */
export const sendTeamMemberUpdateEmail = async (
  email: string,
  firstName: string,
  changes: string[],
  updatedBy: string
): Promise<string | null> => {
  const changesList = changes.map(change => `<li>${change}</li>`).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .changes { background: white; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Account Has Been Updated</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Your account has been updated by ${updatedBy}. Here's what changed:</p>
            <div class="changes">
              <ul>${changesList}</ul>
            </div>
            <p>If you have any questions about these changes, please contact your administrator.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ATS. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Your Account Has Been Updated
    
    Hi ${firstName},
    
    Your account has been updated by ${updatedBy}. Here's what changed:
    ${changes.map(change => `- ${change}`).join('\n')}
    
    If you have any questions about these changes, please contact your administrator.
  `;

  return sendEmail({
    to: email,
    subject: 'Your ATS account has been updated',
    html,
    text,
  });
};

/**
 * Send assignment notification email
 */
export const sendAssignmentEmail = async (
  email: string,
  firstName: string,
  entityType: string,
  entityName: string,
  assignedBy: string
): Promise<string | null> => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .entity-card { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981; }
          .button { display: inline-block; background: #10b981; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Assignment</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>You've been assigned to a new ${entityType} by ${assignedBy}:</p>
            <div class="entity-card">
              <h3>${entityName}</h3>
              <p><strong>Type:</strong> ${entityType}</p>
            </div>
            <div style="text-align: center;">
              <a href="${FRONTEND_URL}/dashboard" class="button">View in Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ATS. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    New Assignment
    
    Hi ${firstName},
    
    You've been assigned to a new ${entityType} by ${assignedBy}:
    
    ${entityName}
    Type: ${entityType}
    
    View in your dashboard: ${FRONTEND_URL}/dashboard
  `;

  return sendEmail({
    to: email,
    subject: `You've been assigned to ${entityName}`,
    html,
    text,
  });
};

export default {
  sendEmail,
  sendInvitationEmail,
  sendMagicLinkEmail,
  sendPasswordResetEmail,
  sendTeamMemberUpdateEmail,
  sendAssignmentEmail,
};
