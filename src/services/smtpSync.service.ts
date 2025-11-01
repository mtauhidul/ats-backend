import Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import { SystemSettings } from "../models/SystemSettings";
import { Email } from "../models/Email";
import { Candidate } from "../models/Candidate";
import { Application } from "../models/Application";

interface EmailSyncResult {
  success: boolean;
  emailsProcessed: number;
  emailsSaved: number;
  errors: string[];
}

/**
 * Sync inbound emails from IMAP server
 */
export const syncInboundEmails = async (): Promise<EmailSyncResult> => {
  const result: EmailSyncResult = {
    success: true,
    emailsProcessed: 0,
    emailsSaved: 0,
    errors: [],
  };

  try {
    // Get SMTP settings
    const settings = await SystemSettings.getSettings();

    if (!settings.smtp?.enabled) {
      throw new Error("SMTP is not enabled");
    }

    const { host, port, username, secure } = settings.smtp;
    const password = settings.getDecryptedSmtpPassword();

    if (!password) {
      throw new Error("SMTP password not configured");
    }

    // Create IMAP connection
    const imap = new Imap({
      user: username,
      password: password,
      host: host,
      port: port,
      tls: secure,
      tlsOptions: { rejectUnauthorized: false },
    });

    // Process emails
    await new Promise<void>((resolve, reject) => {
      imap.once("ready", () => {
        imap.openBox("INBOX", false, (err, _box) => {
          if (err) {
            reject(err);
            return;
          }

          // Search for unseen emails (new emails only)
          imap.search(["UNSEEN"], async (err, results) => {
            if (err) {
              reject(err);
              return;
            }

            if (!results || results.length === 0) {
              console.log("No new emails to process");
              imap.end();
              resolve();
              return;
            }

            console.log(`Found ${results.length} new emails`);

            const fetch = imap.fetch(results, {
              bodies: "",
              markSeen: true,
            });

            fetch.on("message", (msg, seqno) => {
              result.emailsProcessed++;

              msg.on("body", (stream) => {
                simpleParser(stream as any)
                  .then(async (parsed) => {
                    try {
                      await saveInboundEmail(parsed);
                      result.emailsSaved++;
                    } catch (error: any) {
                      console.error(
                        `Error processing email ${seqno}:`,
                        error
                      );
                      result.errors.push(
                        `Email ${seqno}: ${error.message}`
                      );
                    }
                  })
                  .catch((error: any) => {
                    console.error(
                      `Error parsing email ${seqno}:`,
                      error
                    );
                    result.errors.push(
                      `Email ${seqno}: ${error.message}`
                    );
                  });
              });
            });

            fetch.once("error", (err) => {
              console.error("Fetch error:", err);
              result.errors.push(err.message);
            });

            fetch.once("end", () => {
              console.log("Finished fetching emails");
              imap.end();
            });
          });
        });
      });

      imap.once("error", (err: any) => {
        console.error("IMAP connection error:", err);
        reject(err);
      });

      imap.once("end", () => {
        console.log("IMAP connection ended");
        resolve();
      });

      imap.connect();
    });

    // Update last sync time
    settings.smtp.lastSync = new Date();
    await settings.save();

    if (result.errors.length > 0) {
      result.success = false;
    }

    return result;
  } catch (error: any) {
    console.error("Error syncing inbound emails:", error);
    result.success = false;
    result.errors.push(error.message);
    return result;
  }
};

/**
 * Save parsed email to database
 */
async function saveInboundEmail(parsed: ParsedMail): Promise<void> {
  try {
    // Extract email details
    const from = parsed.from?.value[0]?.address || "";
    
    // Helper function to extract email addresses
    const extractEmails = (addressObj: any) => {
      if (!addressObj) return [];
      if (Array.isArray(addressObj)) {
        return addressObj.flatMap((obj: any) => 
          obj.value ? obj.value.map((addr: any) => addr.address || "") : []
        );
      }
      return addressObj.value ? addressObj.value.map((addr: any) => addr.address || "") : [];
    };

    const to = extractEmails(parsed.to);
    const cc = extractEmails(parsed.cc);
    const subject = parsed.subject || "(No Subject)";
    const bodyText = parsed.text || "";
    const bodyHtml = parsed.html || undefined;
    const messageId = parsed.messageId || undefined;
    const inReplyTo = parsed.inReplyTo || undefined;

    // Process attachments
    const attachments = parsed.attachments?.map((att) => ({
      filename: att.filename || "unknown",
      url: "", // Will be populated if we store attachments
      contentType: att.contentType,
      size: att.size,
    })) || [];

    // Try to find related candidate by email
    let candidateId;
    let applicationId;
    let jobId;
    
    if (from) {
      const candidate = await Candidate.findOne({
        email: { $regex: new RegExp(`^${from}$`, "i") },
      });
      
      if (candidate) {
        candidateId = candidate._id;
        
        // Try to find the most recent application for this candidate
        const latestApplication = await Application.findOne({
          candidateId: candidate._id,
        })
          .sort({ createdAt: -1 })
          .populate("jobId");
        
        if (latestApplication) {
          applicationId = latestApplication._id;
          jobId = latestApplication.jobId?._id || latestApplication.jobId;
        }
      }
    }

    // Check if email already exists (by messageId)
    if (messageId) {
      const existingEmail = await Email.findOne({ messageId });
      if (existingEmail) {
        console.log(`Email with messageId ${messageId} already exists, skipping`);
        return;
      }
    }

    // Create email record
    const email = new Email({
      direction: "inbound",
      from,
      to,
      cc,
      subject,
      body: bodyText,
      bodyHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
      status: "received",
      receivedAt: new Date(),
      messageId,
      inReplyTo,
      candidateId,
      applicationId,
      jobId,
    });

    await email.save();
    console.log(`Saved inbound email from ${from}: ${subject}${candidateId ? ` (linked to candidate)` : ''}${jobId ? ` (linked to job)` : ''}`);
  } catch (error: any) {
    console.error("Error saving inbound email:", error);
    throw error;
  }
}

/**
 * Schedule periodic email sync
 * Call this function on server start or from a cron job
 */
export const startEmailSyncScheduler = (intervalMinutes: number = 5) => {
  console.log(`Starting email sync scheduler (every ${intervalMinutes} minutes)`);

  const syncInterval = setInterval(async () => {
    try {
      const settings = await SystemSettings.getSettings();
      
      if (settings.smtp?.enabled) {
        console.log("Running scheduled email sync...");
        const result = await syncInboundEmails();
        console.log("Sync completed:", result);
      }
    } catch (error) {
      console.error("Error in scheduled email sync:", error);
    }
  }, intervalMinutes * 60 * 1000);

  return syncInterval;
};
