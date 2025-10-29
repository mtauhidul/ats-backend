import { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../utils/helpers';
import { BadRequestError } from '../utils/errors';
import { Email, Candidate, Message } from '../models';
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
    await Email.findOneAndUpdate(
      { resendId: emailId },
      { 
        status: 'sent',
        sentAt: new Date(),
      }
    );
  }
};

/**
 * Handle email.delivered event
 */
const handleEmailDelivered = async (data: any) => {
  const emailId = data.email_id;
  
  if (emailId) {
    await Email.findOneAndUpdate(
      { resendId: emailId },
      { 
        status: 'delivered',
        deliveredAt: new Date(),
      }
    );
  }
};

/**
 * Handle email.delivery_delayed event
 */
const handleEmailDelayed = async (data: any) => {
  const emailId = data.email_id;
  
  if (emailId) {
    await Email.findOneAndUpdate(
      { resendId: emailId },
      { 
        status: 'delayed',
      }
    );
  }
};

/**
 * Handle email.complained event (spam report)
 */
const handleEmailComplained = async (data: any) => {
  const emailId = data.email_id;
  
  if (emailId) {
    await Email.findOneAndUpdate(
      { resendId: emailId },
      { 
        status: 'complained',
      }
    );
    logger.warn(`Email marked as spam: ${emailId}`);
  }
};

/**
 * Handle email.bounced event
 */
const handleEmailBounced = async (data: any) => {
  const emailId = data.email_id;
  
  if (emailId) {
    await Email.findOneAndUpdate(
      { resendId: emailId },
      { 
        status: 'bounced',
        bouncedAt: new Date(),
      }
    );
    logger.warn(`Email bounced: ${emailId}`);
  }
};

/**
 * Handle email.opened event
 */
const handleEmailOpened = async (data: any) => {
  const emailId = data.email_id;
  
  if (emailId) {
    await Email.findOneAndUpdate(
      { resendId: emailId },
      { 
        openedAt: new Date(),
        $inc: { openCount: 1 },
      }
    );
  }
};

/**
 * Handle email.clicked event
 */
const handleEmailClicked = async (data: any) => {
  const emailId = data.email_id;
  
  if (emailId) {
    await Email.findOneAndUpdate(
      { resendId: emailId },
      { 
        clickedAt: new Date(),
        $inc: { clickCount: 1 },
      }
    );
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
    const fromEmail = data.from || data.from_email;
    const toEmail = data.to || data.to_email;
    const subject = data.subject || 'No Subject';
    const textBody = data.text || data.body || '';
    const htmlBody = data.html || '';

    logger.info(`Received email from ${fromEmail} to ${toEmail}`);

    // Try to find the candidate by email
    const candidate = await Candidate.findOne({ 
      email: { $regex: new RegExp(fromEmail, 'i') } 
    });

    if (candidate) {
      // Create a message record for the candidate reply
      await Message.create({
        candidateId: candidate._id,
        subject,
        body: textBody || htmlBody,
        from: fromEmail,
        to: Array.isArray(toEmail) ? toEmail[0] : toEmail,
        direction: 'inbound',
        status: 'received',
        receivedAt: new Date(),
        emailId: emailId,
      });

      logger.info(`Created message for candidate ${candidate.email}`);
      
      // TODO: Notify assigned team member about the reply
      // This could send a real-time notification or email
    } else {
      logger.warn(`Received email from unknown sender: ${fromEmail}`);
      
      // Store as unmatched message for manual review
      await Message.create({
        subject,
        body: textBody || htmlBody,
        from: fromEmail,
        to: Array.isArray(toEmail) ? toEmail[0] : toEmail,
        direction: 'inbound',
        status: 'unmatched',
        receivedAt: new Date(),
        emailId: emailId,
      });
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
