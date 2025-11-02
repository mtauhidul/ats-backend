import { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../utils/helpers';
import { BadRequestError } from '../utils/errors';
import { emailService, candidateService, messageService } from '../services/firestore';
import logger from '../utils/logger';

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || '';

/**
 * Handle Resend webhook events
 * Supports: email.sent, email.delivered, email.bounced, email.opened, email.clicked
 */
export const handleResendWebhook = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers['resend-signature'] as string;
    
    // Verify webhook signature (if secret is configured)
    if (RESEND_WEBHOOK_SECRET && signature) {
      // TODO: Implement signature verification
      // For now, we'll proceed without verification in development
    }

    const event = req.body;
    
    if (!event || !event.type) {
      throw new BadRequestError('Invalid webhook payload');
    }

    logger.info(`Received Resend webhook: ${event.type}`, { eventId: event.data?.email_id });

    switch (event.type) {
      case 'email.sent':
        await handleEmailSent(event.data);
        break;
      case 'email.delivered':
        await handleEmailDelivered(event.data);
        break;
      case 'email.delivery_delayed':
        await handleEmailDelayed(event.data);
        break;
      case 'email.complained':
        await handleEmailComplained(event.data);
        break;
      case 'email.bounced':
        await handleEmailBounced(event.data);
        break;
      case 'email.opened':
        await handleEmailOpened(event.data);
        break;
      case 'email.clicked':
        await handleEmailClicked(event.data);
        break;
      case 'email.received':
        await handleEmailReceived(event.data);
        break;
      default:
        logger.warn(`Unhandled webhook event type: ${event.type}`);
    }

    successResponse(res, { received: true }, 'Webhook processed');
  }
);

/**
 * Handle email.sent event
 */
const handleEmailSent = async (data: any) => {
  const emailId = data.email_id;
  
  if (emailId) {
    const allEmails = await emailService.find([]);
    const email = allEmails.find((e: any) => e.resendId === emailId);
    if (email) {
      await emailService.update(email.id, { 
        status: 'sent',
        sentAt: new Date(),
      } as any);
    }
  }
};

/**
 * Handle email.delivered event
 */
const handleEmailDelivered = async (data: any) => {
  const emailId = data.email_id;
  
  if (emailId) {
    const allEmails = await emailService.find([]);
    const email = allEmails.find((e: any) => e.resendId === emailId);
    if (email) {
      await emailService.update(email.id, { 
        status: 'delivered',
        deliveredAt: new Date(),
      } as any);
    }
  }
};

/**
 * Handle email.delivery_delayed event
 */
const handleEmailDelayed = async (data: any) => {
  const emailId = data.email_id;
  
  if (emailId) {
    const allEmails = await emailService.find([]);
    const email = allEmails.find((e: any) => e.resendId === emailId);
    if (email) {
      await emailService.update(email.id, { 
        status: 'delayed',
      } as any);
    }
  }
};

/**
 * Handle email.complained event (spam report)
 */
const handleEmailComplained = async (data: any) => {
  const emailId = data.email_id;
  
  if (emailId) {
    const allEmails = await emailService.find([]);
    const email = allEmails.find((e: any) => e.resendId === emailId);
    if (email) {
      await emailService.update(email.id, { 
        status: 'complained',
      } as any);
      logger.warn(`Email marked as spam: ${emailId}`);
    }
  }
};

/**
 * Handle email.bounced event
 */
const handleEmailBounced = async (data: any) => {
  const emailId = data.email_id;
  
  if (emailId) {
    const allEmails = await emailService.find([]);
    const email = allEmails.find((e: any) => e.resendId === emailId);
    if (email) {
      await emailService.update(email.id, { 
        status: 'bounced',
        bouncedAt: new Date(),
      } as any);
      logger.warn(`Email bounced: ${emailId}`);
    }
  }
};

/**
 * Handle email.opened event
 */
const handleEmailOpened = async (data: any) => {
  const emailId = data.email_id;
  
  if (emailId) {
    const allEmails = await emailService.find([]);
    const email = allEmails.find((e: any) => e.resendId === emailId);
    if (email) {
      await emailService.update(email.id, { 
        openedAt: new Date(),
        openCount: (email.openCount || 0) + 1,
      } as any);
    }
  }
};

/**
 * Handle email.clicked event
 */
const handleEmailClicked = async (data: any) => {
  const emailId = data.email_id;
  
  if (emailId) {
    const allEmails = await emailService.find([]);
    const email = allEmails.find((e: any) => e.resendId === emailId);
    if (email) {
      await emailService.update(email.id, { 
        clickedAt: new Date(),
        clickCount: (email.clickCount || 0) + 1,
      } as any);
    }
  }
};

/**
 * Handle email.received event (inbound emails)
 * This handles candidate replies
 */
const handleEmailReceived = async (data: any) => {
  try {
    const emailId = data.email_id;

    if (!emailId) {
      logger.error('No email_id in received event');
      return;
    }

    // Extract email data from the webhook payload
    // Resend inbound webhook payload structure
    const fromEmail = data.from || data.from_email;
    const toEmail = data.to || data.to_email;
    const subject = data.subject || 'No Subject';
    const textBody = data.text || data.body || '';
    const htmlBody = data.html || '';

    // Extract metadata
    const messageId = data.message_id || data.messageId;
    const inReplyTo = data.in_reply_to || data.inReplyTo;

    // Extract attachments if present
    const attachments = data.attachments || [];
    const processedAttachments = attachments.map((att: any) => ({
      filename: att.filename || att.name,
      url: att.url || att.downloadUrl,
      contentType: att.contentType || att.content_type || 'application/octet-stream',
      size: att.size || 0,
    }));

    logger.info(`Received email from ${fromEmail} to ${toEmail}`, {
      subject,
      hasAttachments: attachments.length > 0,
      attachmentCount: attachments.length,
      messageId,
      inReplyTo,
    });

    // Try to find the candidate by email
    const allCandidates = await candidateService.find([]);
    const candidate = allCandidates.find((c: any) => 
      c.email?.toLowerCase() === fromEmail.toLowerCase()
    );

    // Determine thread ID based on inReplyTo or messageId
    let threadId = inReplyTo || messageId;

    // Try to find the original email this is replying to
    let originalEmail = null;
    if (inReplyTo) {
      const allEmails = await emailService.find([]);
      originalEmail = allEmails.find((e: any) => e.messageId === inReplyTo);
      if (originalEmail && originalEmail.threadId) {
        threadId = originalEmail.threadId;
      }
    }

    if (candidate) {
      // Create an Email record for the inbound email
      const inboundEmailId = await emailService.create({
        direction: 'inbound',
        from: fromEmail,
        to: Array.isArray(toEmail) ? toEmail : [toEmail],
        subject,
        body: textBody,
        bodyHtml: htmlBody,
        status: 'received',
        receivedAt: new Date(),
        resendId: emailId,
        candidateId: candidate.id,
        applicationId: originalEmail?.applicationId,
        jobId: originalEmail?.jobId,
        interviewId: originalEmail?.interviewId,
        messageId,
        inReplyTo,
        threadId,
        attachments: processedAttachments,
      } as any);

      // Also create a message record for easy tracking
      await messageService.create({
        candidateId: candidate.id,
        subject,
        body: textBody || htmlBody,
        from: fromEmail,
        to: Array.isArray(toEmail) ? toEmail[0] : toEmail,
        direction: 'inbound',
        status: 'received',
        receivedAt: new Date(),
        emailId: emailId,
      } as any);

      logger.info(`Created inbound email and message for candidate ${candidate.email}`, {
        emailId: inboundEmailId,
        candidateId: candidate.id,
        threadId,
      });

      // TODO: Notify assigned team member about the reply
      // This could send a real-time notification or email
      // You can use websockets or push notifications here
    } else {
      logger.warn(`Received email from unknown sender: ${fromEmail}`);

      // Store as unmatched email for manual review
      await emailService.create({
        direction: 'inbound',
        from: fromEmail,
        to: Array.isArray(toEmail) ? toEmail : [toEmail],
        subject,
        body: textBody,
        bodyHtml: htmlBody,
        status: 'received',
        receivedAt: new Date(),
        resendId: emailId,
        messageId,
        inReplyTo,
        threadId,
        attachments: processedAttachments,
      } as any);

      // Store as unmatched message for manual review
      await messageService.create({
        subject,
        body: textBody || htmlBody,
        from: fromEmail,
        to: Array.isArray(toEmail) ? toEmail[0] : toEmail,
        direction: 'inbound',
        status: 'unmatched',
        receivedAt: new Date(),
        emailId: emailId,
      } as any);

      logger.info('Stored unmatched inbound email for manual review');
    }
  } catch (error) {
    logger.error('Error processing received email:', error);
  }
};

/**
 * Test endpoint to manually trigger webhook processing
 * Only available in development
 */
export const testWebhook = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestError('Test endpoint not available in production');
    }

    const { type, emailId } = req.body;

    if (!type) {
      throw new BadRequestError('Event type is required');
    }

    const testEvent = {
      type,
      data: {
        email_id: emailId || 'test-email-id',
        from: 'test@example.com',
        to: ['recipient@example.com'],
        subject: 'Test Email',
        text: 'This is a test email body',
      },
    };

    // Process the test event by manually calling the handler
    const originalBody = req.body;
    req.body = testEvent;
    
    try {
      const event = req.body;
      
      if (!event || !event.type) {
        throw new BadRequestError('Invalid webhook payload');
      }

      logger.info(`Test webhook: ${event.type}`, { eventId: event.data?.email_id });

      switch (event.type) {
        case 'email.sent':
          await handleEmailSent(event.data);
          break;
        case 'email.delivered':
          await handleEmailDelivered(event.data);
          break;
        case 'email.delivery_delayed':
          await handleEmailDelayed(event.data);
          break;
        case 'email.complained':
          await handleEmailComplained(event.data);
          break;
        case 'email.bounced':
          await handleEmailBounced(event.data);
          break;
        case 'email.opened':
          await handleEmailOpened(event.data);
          break;
        case 'email.clicked':
          await handleEmailClicked(event.data);
          break;
        case 'email.received':
          await handleEmailReceived(event.data);
          break;
        default:
          logger.warn(`Unhandled webhook event type: ${event.type}`);
      }

      successResponse(res, { received: true, test: true }, 'Test webhook processed');
    } finally {
      req.body = originalBody;
    }
  }
);
