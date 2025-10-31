// Enhanced email communications routes for frontend integration
// routes/enhanced-email-communications.js
const express = require("express");
const router = express.Router();
const { validateApiKey } = require("../middleware/auth");
const { db } = require("../services/firebaseService");
const logger = require("../utils/logger");
const { Resend } = require("resend");

// Apply auth middleware to all routes
router.use(validateApiKey);

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Generate a thread ID based on subject and participants
 */
function generateThreadId(subject, participants) {
  // Remove "Re:", "Fwd:" etc. from subject for consistent threading
  const cleanSubject = subject.replace(/^(Re:|Fwd:|RE:|FWD:)\s*/i, '').trim();
  const sortedParticipants = participants.sort();
  return `thread_${Buffer.from(cleanSubject + sortedParticipants.join('')).toString('base64').slice(0, 16)}`;
}

/**
 * Create or update email thread in Firestore
 */
async function createOrUpdateThread(threadId, subject, participants, messageTimestamp) {
  try {
    const threadRef = db.collection("email_threads").doc(threadId);
    const threadDoc = await threadRef.get();
    
    const cleanSubject = subject.replace(/^(Re:|Fwd:|RE:|FWD:)\s*/i, '').trim();
    
    if (!threadDoc.exists) {
      // Create new thread
      await threadRef.set({
        subject: cleanSubject,
        participants: participants,
        last_message_at: messageTimestamp,
        created_at: new Date()
      });
      logger.info(`Created new email thread: ${threadId}`);
    } else {
      // Update existing thread
      await threadRef.update({
        last_message_at: messageTimestamp,
        participants: participants // Update in case new participants were added
      });
      logger.info(`Updated email thread: ${threadId}`);
    }
    
    return threadId;
  } catch (error) {
    logger.error("Error creating/updating email thread:", error);
    throw error;
  }
}

/**
 * Store email message in Firestore
 */
async function storeEmailMessage(threadId, messageData) {
  try {
    const messageRef = db.collection("email_messages").doc();
    await messageRef.set({
      thread_id: threadId,
      from_email: messageData.from,
      to_emails: messageData.to,
      cc_emails: messageData.cc || [],
      bcc_emails: messageData.bcc || [],
      subject: messageData.subject,
      body: messageData.body,
      html_body: messageData.htmlBody,
      direction: messageData.direction,
      is_read: messageData.direction === 'outbound', // Mark outbound as read by default
      timestamp: messageData.timestamp,
      resend_message_id: messageData.resendMessageId,
      created_at: new Date()
    });
    
    logger.info(`Stored email message in thread ${threadId}, message ID: ${messageRef.id}`);
    return messageRef.id;
  } catch (error) {
    logger.error("Error storing email message:", error);
    throw error;
  }
}

/**
 * Send email with frontend format
 * POST /api/email/communications/send
 * Expected body: { to, subject, message, cc?, bcc?, attachments? }
 */
router.post("/send", async (req, res, next) => {
  try {
    const { to, subject, message, cc, bcc, attachments } = req.body;

    // Validate required fields
    if (!to || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: to, subject, message are required",
      });
    }

    // Validate email format (basic check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format for 'to' field",
      });
    }

    // Prepare email data for Resend
    const emailData = {
      from: `${process.env.DEFAULT_FROM_NAME || "ATS System"} <${process.env.DEFAULT_FROM_EMAIL || "onboarding@resend.dev"}>`,
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            ${message.replace(/\n/g, '<br>')}
          </div>
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 12px; color: #6c757d;">
            <p>This email was sent from the ATS system.</p>
          </div>
        </div>
      `,
    };

    // Add CC recipients if provided
    if (cc && Array.isArray(cc) && cc.length > 0) {
      emailData.cc = cc.filter(email => emailRegex.test(email));
    }

    // Add BCC recipients if provided
    if (bcc && Array.isArray(bcc) && bcc.length > 0) {
      emailData.bcc = bcc.filter(email => emailRegex.test(email));
    }

    // Add attachments if provided
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      emailData.attachments = attachments.map(attachment => ({
        filename: attachment.name || 'attachment',
        path: attachment.url, // Resend can handle URLs directly
      }));
    }

    logger.info("Sending email with data:", {
      to: emailData.to,
      subject: emailData.subject,
      cc: emailData.cc,
      bcc: emailData.bcc,
      attachmentCount: emailData.attachments?.length || 0
    });

    // Send the email via Resend
    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      logger.error("Resend API error:", error);
      return res.status(500).json({
        success: false,
        message: `Failed to send email: ${error.message}`,
      });
    }

    logger.info(`Email sent successfully to ${to}, Resend ID: ${data.id}`);

    // Store the email in database for inbox tracking
    try {
      // Determine participants for threading
      const participants = [
        to,
        ...(cc || []),
        ...(bcc || []),
        process.env.DEFAULT_FROM_EMAIL || "onboarding@resend.dev"
      ].filter((email, index, arr) => arr.indexOf(email) === index); // Remove duplicates

      // Create thread ID and ensure thread exists
      const threadId = generateThreadId(subject, participants);
      const timestamp = new Date();
      
      await createOrUpdateThread(threadId, subject, participants, timestamp);

      // Store the outbound message
      const messageData = {
        from: process.env.DEFAULT_FROM_EMAIL || "onboarding@resend.dev",
        to: [to],
        cc: cc || [],
        bcc: bcc || [],
        subject: subject,
        body: message,
        htmlBody: emailData.html,
        direction: 'outbound',
        timestamp: timestamp,
        resendMessageId: data.id
      };

      await storeEmailMessage(threadId, messageData);
      
      logger.info(`Email stored in database - Thread: ${threadId}, Resend ID: ${data.id}`);
      
    } catch (dbError) {
      logger.error("Error storing email in database:", dbError);
      // Don't fail the API call if database storage fails
      logger.warn("Email sent successfully but not stored in database");
    }

    // Return the expected format
    res.status(200).json({
      success: true,
      messageId: data.id,
      message: "Email sent successfully",
    });

  } catch (error) {
    logger.error("Enhanced email communication error:", error);
    next(error);
  }
});

module.exports = router;