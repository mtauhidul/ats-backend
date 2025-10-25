import { Resend } from 'resend';
import { config } from '../config';
import logger from '../utils/logger';
import { Email } from '../models';
import { InternalServerError } from '../utils/errors';
import mongoose from 'mongoose';

const resend = new Resend(config.resend.apiKey);

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  
  // For tracking in database
  candidateId?: string;
  applicationId?: string;
  jobId?: string;
  clientId?: string;
  interviewId?: string;
  sentBy?: string;
}

class ResendService {
  /**
   * Send email via Resend
   */
  async sendEmail(options: SendEmailOptions): Promise<{ id: string; emailId: string }> {
    try {
      const {
        to,
        subject,
        body,
        bodyHtml,
        cc,
        bcc,
        attachments,
        candidateId,
        applicationId,
        jobId,
        clientId,
        interviewId,
        sentBy,
      } = options;

      // Send via Resend
      const result = await resend.emails.send({
        from: `${config.resend.fromName} <${config.resend.fromEmail}>`,
        to: Array.isArray(to) ? to : [to],
        subject,
        text: body,
        html: bodyHtml || this.textToHtml(body),
        cc,
        bcc,
        attachments: attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
        })),
      });

      if (!result.data?.id) {
        throw new Error('Failed to send email via Resend');
      }

      // Save to database
      const email = await Email.create({
        direction: 'outbound',
        from: config.resend.fromEmail,
        to: Array.isArray(to) ? to : [to],
        cc,
        bcc,
        subject,
        body,
        bodyHtml: bodyHtml || this.textToHtml(body),
        status: 'sent',
        sentAt: new Date(),
        candidateId: candidateId ? new mongoose.Types.ObjectId(candidateId) : undefined,
        applicationId: applicationId ? new mongoose.Types.ObjectId(applicationId) : undefined,
        jobId: jobId ? new mongoose.Types.ObjectId(jobId) : undefined,
        clientId: clientId ? new mongoose.Types.ObjectId(clientId) : undefined,
        interviewId: interviewId ? new mongoose.Types.ObjectId(interviewId) : undefined,
        sentBy: sentBy ? new mongoose.Types.ObjectId(sentBy) : undefined,
        messageId: result.data.id,
      });

      logger.info(`Email sent successfully: ${result.data.id}`);

      return {
        id: result.data.id,
        emailId: (email._id as any).toString(),
      };
    } catch (error: any) {
      logger.error('Resend service error:', error);

      // Save failed email to database
      try {
        await Email.create({
          direction: 'outbound',
          from: config.resend.fromEmail,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          body: options.body,
          status: 'failed',
          error: error.message,
          candidateId: options.candidateId ? new mongoose.Types.ObjectId(options.candidateId) : undefined,
          applicationId: options.applicationId ? new mongoose.Types.ObjectId(options.applicationId) : undefined,
          jobId: options.jobId ? new mongoose.Types.ObjectId(options.jobId) : undefined,
          clientId: options.clientId ? new mongoose.Types.ObjectId(options.clientId) : undefined,
          sentBy: options.sentBy ? new mongoose.Types.ObjectId(options.sentBy) : undefined,
        });
      } catch (dbError) {
        logger.error('Failed to save failed email to database:', dbError);
      }

      throw new InternalServerError(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send application confirmation email
   */
  async sendApplicationConfirmation(
    candidateEmail: string,
    candidateName: string,
    jobTitle: string,
    options: { applicationId?: string; jobId?: string }
  ): Promise<{ id: string; emailId: string }> {
    const subject = `Application Received: ${jobTitle}`;
    const body = `
Dear ${candidateName},

Thank you for applying for the ${jobTitle} position. We have received your application and our team will review it shortly.

We will contact you if your qualifications match our requirements.

Best regards,
${config.resend.fromName}
    `.trim();

    return this.sendEmail({
      to: candidateEmail,
      subject,
      body,
      applicationId: options.applicationId,
      jobId: options.jobId,
    });
  }

  /**
   * Send interview invitation email
   */
  async sendInterviewInvitation(
    candidateEmail: string,
    candidateName: string,
    jobTitle: string,
    interviewDetails: {
      date: Date;
      duration: number;
      type: string;
      meetingLink?: string;
      location?: string;
    },
    options: { interviewId?: string; candidateId?: string; jobId?: string }
  ): Promise<{ id: string; emailId: string }> {
    const subject = `Interview Invitation: ${jobTitle}`;
    
    const locationInfo = interviewDetails.type === 'video' && interviewDetails.meetingLink
      ? `Meeting Link: ${interviewDetails.meetingLink}`
      : interviewDetails.location
      ? `Location: ${interviewDetails.location}`
      : '';

    const body = `
Dear ${candidateName},

We are pleased to invite you for an interview for the ${jobTitle} position.

Interview Details:
- Type: ${interviewDetails.type}
- Date & Time: ${interviewDetails.date.toLocaleString()}
- Duration: ${interviewDetails.duration} minutes
${locationInfo}

Please confirm your availability at your earliest convenience.

Best regards,
${config.resend.fromName}
    `.trim();

    return this.sendEmail({
      to: candidateEmail,
      subject,
      body,
      interviewId: options.interviewId,
      candidateId: options.candidateId,
      jobId: options.jobId,
    });
  }

  /**
   * Convert plain text to HTML
   */
  private textToHtml(text: string): string {
    return text
      .split('\n\n')
      .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('\n');
  }
}

export default new ResendService();
