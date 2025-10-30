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

/**
 * Send interview notification email to candidate
 */
export const sendInterviewNotificationEmail = async (options: {
  candidateEmail: string;
  candidateName: string;
  jobTitle: string;
  interviewTitle: string;
  interviewType: string;
  scheduledAt: Date;
  duration: number;
  meetingLink?: string;
  meetingPassword?: string;
  interviewerNames?: string[];
  isInstant?: boolean;
}): Promise<string | null> => {
  const {
    candidateEmail,
    candidateName,
    jobTitle,
    interviewTitle,
    interviewType,
    scheduledAt,
    duration,
    meetingLink,
    meetingPassword,
    interviewerNames,
    isInstant,
  } = options;

  const scheduledDate = new Date(scheduledAt);
  const formattedDate = scheduledDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const interviewTypeDisplay = interviewType === 'video' 
    ? 'Video Interview' 
    : interviewType === 'phone' 
    ? 'Phone Interview' 
    : interviewType === 'in-person'
    ? 'In-Person Interview'
    : 'Interview';

  const interviewerList = interviewerNames && interviewerNames.length > 0
    ? `<p><strong>Interviewer(s):</strong> ${interviewerNames.join(', ')}</p>`
    : '';

  const meetingDetails = meetingLink
    ? `
      <div style="background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1e40af;">🎥 Video Meeting Details</h3>
        <p><strong>Meeting Link:</strong><br/>
        <a href="${meetingLink}" style="color: #2563eb; word-break: break-all;">${meetingLink}</a></p>
        ${meetingPassword ? `<p><strong>Password:</strong> ${meetingPassword}</p>` : ''}
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">💡 Tip: Click the link above to join the meeting. Make sure you have Zoom installed or join via browser.</p>
      </div>
    `
    : '';

  const instantBadge = isInstant
    ? '<span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">INSTANT MEETING</span>'
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; }
          .button { display: inline-block; background: #2563eb; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Interview Scheduled ${instantBadge}</h1>
          </div>
          <div class="content">
            <p>Hi ${candidateName},</p>
            ${isInstant 
              ? '<p><strong>Great news!</strong> An instant interview meeting has been created for you. The meeting is starting soon!</p>'
              : '<p><strong>Great news!</strong> Your interview has been scheduled for the <strong>${jobTitle}</strong> position.</p>'
            }
            
            <div class="info-box">
              <h3 style="margin-top: 0;">Interview Details</h3>
              <p><strong>Position:</strong> ${jobTitle}</p>
              <p><strong>Interview:</strong> ${interviewTitle}</p>
              <p><strong>Type:</strong> ${interviewTypeDisplay}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedTime}</p>
              <p><strong>Duration:</strong> ${duration} minutes</p>
              ${interviewerList}
            </div>

            ${meetingDetails}

            ${!isInstant ? `
              <p><strong>What to prepare:</strong></p>
              <ul>
                <li>Review the job description and your application</li>
                <li>Prepare questions about the role and company</li>
                <li>Test your video/audio if it's a video interview</li>
                <li>Have a copy of your resume handy</li>
              </ul>
            ` : ''}

            <p>We're looking forward to speaking with you!</p>
            <p>If you need to reschedule or have any questions, please contact us as soon as possible.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ATS. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Interview Scheduled ${isInstant ? '(INSTANT MEETING)' : ''}
    
    Hi ${candidateName},
    
    ${isInstant 
      ? 'Great news! An instant interview meeting has been created for you. The meeting is starting soon!'
      : `Great news! Your interview has been scheduled for the ${jobTitle} position.`
    }
    
    Interview Details:
    - Position: ${jobTitle}
    - Interview: ${interviewTitle}
    - Type: ${interviewTypeDisplay}
    - Date: ${formattedDate}
    - Time: ${formattedTime}
    - Duration: ${duration} minutes
    ${interviewerNames && interviewerNames.length > 0 ? `- Interviewer(s): ${interviewerNames.join(', ')}` : ''}
    
    ${meetingLink ? `
    Video Meeting Details:
    Meeting Link: ${meetingLink}
    ${meetingPassword ? `Password: ${meetingPassword}` : ''}
    ` : ''}
    
    ${!isInstant ? `
    What to prepare:
    - Review the job description and your application
    - Prepare questions about the role and company
    - Test your video/audio if it's a video interview
    - Have a copy of your resume handy
    ` : ''}
    
    We're looking forward to speaking with you!
    
    If you need to reschedule or have any questions, please contact us as soon as possible.
  `;

  return sendEmail({
    to: candidateEmail,
    subject: isInstant 
      ? `🚀 Instant Interview Meeting - ${jobTitle}` 
      : `Interview Scheduled - ${jobTitle}`,
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
  sendInterviewNotificationEmail,
};
