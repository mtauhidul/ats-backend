// services/emailService.js

const Imap = require("imap");
const { simpleParser } = require("mailparser");
const {
  addApplicationFromEmail,
  uploadFileToStorage,
} = require("./firebaseService");
const logger = require("../utils/logger");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const { processAttachment } = require("../utils/resumeProcessor");
const { Resend } = require("resend");
const fsSync = require("fs");

/**
 * Setup connection to IMAP server
 * @param {Object} connectionConfig - Email provider configuration
 * @returns {Imap} The configured IMAP connection
 */
const setupImapConnection = ({
  provider,
  server,
  port,
  username,
  password,
}) => {
  // Default server configurations for common providers
  const serverConfigs = {
    gmail: { host: "imap.gmail.com", port: 993 },
    outlook: { host: "outlook.office365.com", port: 993 },
    other: { host: server, port: port ? parseInt(port, 10) : 993 },
  };

  const config = serverConfigs[provider];

  return new Imap({
    user: username,
    password: password,
    host: config.host,
    port: config.port,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  });
};

/**
 * Parse email to extract application information (updated for applications workflow)
 * @param {Object} email - Parsed email object from mailparser
 * @returns {Object} Application data extracted from the email
 */
const parseCandidateFromEmail = (email) => {
  // Extract application data from email
  const applicationData = {
    name: email.from?.value[0]?.name || "Unknown Candidate",
    email: email.from?.value[0]?.address,
    source: "email_import",
    importDate: new Date().toISOString(),
    notes: `Imported from email with subject: ${email.subject}`,
    // Application workflow specific fields
    status: "pending_review",
    reviewStatus: "unreviewed",
    appliedPosition: "", // Can be extracted from subject if needed
    // Set as unassigned initially
    stageId: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [
      {
        date: new Date().toISOString(),
        note: `Imported from email with subject: "${email.subject}"`,
      },
    ],
  };

  // Process attachments if any
  if (email.attachments && email.attachments.length > 0) {
    applicationData.hasResume = true;
    applicationData.resumeFileName = email.attachments[0].filename;

    // Check if we have a resume attachment to try to extract more data
    const resumeAttachments = email.attachments.filter((attachment) => {
      const filename = attachment.filename.toLowerCase();
      return (
        filename.endsWith(".pdf") ||
        filename.endsWith(".doc") ||
        filename.endsWith(".docx") ||
        filename.endsWith(".txt")
      );
    });

    if (resumeAttachments.length > 0) {
      applicationData.hasResumeAttachment = true;
    }
  }

  return applicationData;
};

/**
 * Checks if an email is job-related based on its subject
 * @param {string} subject - Email subject
 * @returns {boolean} Whether the email appears to be job-related
 */
const isJobRelatedEmail = (subject) => {
  if (!subject) return false;

  const lowerSubject = subject.toLowerCase();

  // Check for job codes like "job [ABC123]" or similar patterns
  const hasJobCode = /job\s*\[\w+\]/i.test(lowerSubject);

  // Expanded keywords for more inclusive filtering
  const hasJobKeyword =
    lowerSubject.includes("job") ||
    lowerSubject.includes("candidate") ||
    lowerSubject.includes("resume") ||
    lowerSubject.includes("cv") ||
    lowerSubject.includes("application") ||
    lowerSubject.includes("apply") ||
    lowerSubject.includes("position") ||
    lowerSubject.includes("role") ||
    lowerSubject.includes("hire") ||
    lowerSubject.includes("opportunity") ||
    lowerSubject.includes("employment") ||
    lowerSubject.includes("career") ||
    lowerSubject.includes("vacancy") ||
    lowerSubject.includes("opening") ||
    lowerSubject.includes("work") ||
    lowerSubject.includes("interested") ||
    lowerSubject.includes("applicant");

  // NEW: Check for specific job titles and roles (this catches the missed emails!)
  const hasJobTitle =
    lowerSubject.includes("virtual assistant") ||
    lowerSubject.includes("virtual graphics designer") ||
    lowerSubject.includes("virtual graphic designer") ||
    lowerSubject.includes("graphics designer") ||
    lowerSubject.includes("graphic designer") ||
    lowerSubject.includes("medical virtual") ||
    lowerSubject.includes("virtual receptionist") ||
    lowerSubject.includes("medical receptionist") ||
    lowerSubject.includes("virtual coordinator") ||
    lowerSubject.includes("administrative assistant") ||
    lowerSubject.includes("admin assistant") ||
    lowerSubject.includes("data entry") ||
    lowerSubject.includes("customer service") ||
    lowerSubject.includes("social media") ||
    lowerSubject.includes("content writer") ||
    lowerSubject.includes("web developer") ||
    lowerSubject.includes("developer") ||
    lowerSubject.includes("programmer") ||
    lowerSubject.includes("designer") ||
    lowerSubject.includes("marketer") ||
    lowerSubject.includes("healthcare") ||
    lowerSubject.includes("medical") ||
    lowerSubject.includes("nurse") ||
    lowerSubject.includes("secretary") ||
    lowerSubject.includes("receptionist") ||
    lowerSubject.includes("coordinator") ||
    lowerSubject.includes("specialist") ||
    lowerSubject.includes("manager") ||
    lowerSubject.includes("analyst") ||
    lowerSubject.includes("consultant") ||
    lowerSubject.includes("freelancer") ||
    lowerSubject.includes("remote work") ||
    lowerSubject.includes("telecommute") ||
    lowerSubject.includes("part time") ||
    lowerSubject.includes("full time");

  // NEW: Check for patterns like "John Doe - Virtual Assistant" or "Resume: Virtual Designer"
  const hasNameWithTitle =
    /\w+\s*[-–]\s*(virtual|medical|graphic|admin|data|customer|social|content|web|healthcare)/i.test(
      subject
    ) ||
    /resume\s*[:]\s*(virtual|medical|graphic|admin|data|customer|social|content|web|healthcare)/i.test(
      subject
    );

  return hasJobCode || hasJobKeyword || hasJobTitle || hasNameWithTitle;
};

/**
 * Create a temp directory for attachment processing
 * @returns {Promise<string>} Path to temp directory
 */
const createTempDir = async () => {
  const tempDir = path.join(__dirname, "../temp", `email-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
};

/**
 * List emails from IMAP inbox
 * @param {Object} connectionConfig - Email provider configuration
 * @param {Object} filters - Filter criteria for emails
 * @returns {Promise<Object>} Object containing fetched emails
 */
const listEmails = async (connectionConfig, filters = {}) => {
  return new Promise((resolve, reject) => {
    const imap = setupImapConnection(connectionConfig);
    const emails = [];

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err, box) => {
        // Changed to readonly mode
        if (err) {
          imap.end();
          return reject(err);
        }

        // Build search criteria
        let searchCriteria = ["ALL"];

        // For date filtering
        if (filters.dateFilter === "today") {
          const today = new Date();
          searchCriteria = [["SINCE", today.toISOString().split("T")[0]]];
        } else if (filters.dateFilter === "week") {
          const lastWeek = new Date();
          lastWeek.setDate(lastWeek.getDate() - 7);
          searchCriteria = [["SINCE", lastWeek.toISOString().split("T")[0]]];
        } else if (filters.dateFilter === "month") {
          const lastMonth = new Date();
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          searchCriteria = [["SINCE", lastMonth.toISOString().split("T")[0]]];
        }

        // Use UID search instead of sequence numbers
        imap.search(searchCriteria, (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (!results || !results.length) {
            imap.end();
            return resolve({ emails: [] });
          }

          logger.info("Search results:", {
            count: results.length,
            first: results[0],
            last: results[results.length - 1],
          });

          // Create a fetch for retrieving email headers and structure for attachments
          const fetch = imap.fetch(results, {
            bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)"],
            struct: true,
            envelope: true,
          });

          fetch.on("message", (msg, seqno) => {
            const email = {
              id: seqno.toString(),
              seqno: seqno,
              hasAttachments: false,
            };

            msg.on("body", (stream, info) => {
              let buffer = "";
              stream.on("data", (chunk) => {
                buffer += chunk.toString("utf8");
              });

              stream.on("end", () => {
                const header = Imap.parseHeader(buffer);

                if (!header.from || !header.from.length) {
                  return;
                }

                const fromHeader = header.from[0];
                let fromName = fromHeader;
                let fromEmail = fromHeader;

                const emailMatch = fromHeader.match(/<(.+)>/);
                if (emailMatch) {
                  fromEmail = emailMatch[1];
                  fromName = fromHeader.split("<")[0].trim();
                }

                email.from = {
                  name: fromName,
                  email: fromEmail,
                };

                email.subject = header.subject
                  ? header.subject[0]
                  : "(No subject)";
                email.receivedAt = header.date
                  ? header.date[0]
                  : new Date().toISOString();
              });
            });

            msg.once("attributes", (attrs) => {
              // Store UID for later use
              email.uid = attrs.uid;
              email.messageId = attrs.uid; // Add this for better tracking

              // Check if email has attachments
              const attachments = [];
              if (attrs.struct) {
                let attachmentIndex = 0;

                const traverse = (parts, parentPartId = "") => {
                  for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    const currentPartId = parentPartId
                      ? `${parentPartId}.${i + 1}`
                      : `${i + 1}`;

                    if (Array.isArray(part)) {
                      traverse(part, currentPartId);
                    } else if (
                      part.disposition &&
                      ["attachment", "inline"].includes(
                        part.disposition.type.toLowerCase()
                      )
                    ) {
                      attachmentIndex++;
                      const filename =
                        part.params?.name || `unknown-${attachmentIndex}`;

                      const isResume = /\.(pdf|doc|docx|rtf|txt|odt)$/i.test(
                        filename
                      );

                      attachments.push({
                        id: `att-${email.uid || seqno}-${attachmentIndex}`, // Use UID if available
                        partId: currentPartId,
                        name: filename,
                        contentType:
                          part.type?.toLowerCase() +
                            "/" +
                            part.subtype?.toLowerCase() ||
                          "application/octet-stream",
                        size: part.size || 0,
                        isResume,
                        encoding: part.encoding,
                      });
                    }
                  }
                };

                if (attrs.struct.length > 0) {
                  traverse(attrs.struct);
                }
              }

              email.hasAttachments = attachments.length > 0;
              email.attachments = attachments;
            });

            msg.once("end", () => {
              let addEmail = true;

              if (filters.jobRelated && !isJobRelatedEmail(email.subject)) {
                addEmail = false;
              }

              if (filters.withAttachments && !email.hasAttachments) {
                addEmail = false;
              }

              if (addEmail) {
                emails.push(email);
              }
            });
          });

          fetch.once("error", (err) => {
            imap.end();
            reject(err);
          });

          fetch.once("end", () => {
            imap.end();
            logger.info(
              "Listed emails with UIDs:",
              emails.map((e) => ({ id: e.id, uid: e.uid, subject: e.subject }))
            );
            resolve({ emails });
          });
        });
      });
    });

    imap.once("error", (err) => {
      reject(err);
    });

    imap.once("end", () => {
      logger.info("IMAP connection ended");
    });

    imap.connect();
  });
};

/**
 * Download an attachment from an email
 * @param {Imap} imap - IMAP connection
 * @param {number} msgId - Message ID
 * @param {Object} part - Message part containing the attachment
 * @param {string} tempDir - Directory to save the attachment
 * @returns {Promise<Object>} Attachment info including file path
 */
const downloadAttachment = (imap, msgId, part, tempDir) => {
  return new Promise((resolve, reject) => {
    const filename = part.params.name;
    const filePath = path.join(tempDir, filename);

    const msg = imap.fetch(msgId, { bodies: [part.partID] });

    msg.on("message", (msg) => {
      msg.on("body", async (stream, info) => {
        try {
          // Save attachment to temp file
          const writeStream = fs.createWriteStream(filePath);
          stream.pipe(writeStream);

          writeStream.on("finish", () => {
            resolve({
              name: filename,
              path: filePath,
              contentType: `${part.type}/${part.subtype}`,
              size: part.size,
            });
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    msg.once("error", reject);
  });
};

/**
 * Process selected emails and import candidates
 * @param {Object} connectionConfig - Email provider configuration
 * @param {Array<string>} emailIds - IDs of emails to process
 * @returns {Promise<Object>} Result of the email processing
 */
const processEmails = async (connectionConfig, emailIds) => {
  return new Promise((resolve, reject) => {
    const imap = setupImapConnection(connectionConfig);
    const processedEmails = [];
    const candidates = [];

    imap.once("ready", () => {
      imap.openBox("INBOX", false, async (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        if (!emailIds || emailIds.length === 0) {
          imap.end();
          return resolve({ processed: 0, candidates: [] });
        }

        const tempDir = await createTempDir().catch((err) => {
          logger.error("Error creating temp directory:", err);
          return null;
        });

        if (!tempDir) {
          imap.end();
          return reject(new Error("Failed to create temporary directory"));
        }

        const numericIds = emailIds.map((id) => parseInt(id, 10));
        const fetch = imap.fetch(numericIds, { bodies: "", struct: true });

        fetch.on("message", (msg, seqno) => {
          msg.on("body", async (stream, info) => {
            try {
              const email = await simpleParser(stream);
              processedEmails.push(seqno);

              // Extract application information (updated for applications workflow)
              const applicationData = parseCandidateFromEmail(email);

              // Process resume attachments if present
              if (email.attachments && email.attachments.length > 0) {
                for (const attachment of email.attachments) {
                  const filename = attachment.filename.toLowerCase();

                  if (
                    filename.endsWith(".pdf") ||
                    filename.endsWith(".doc") ||
                    filename.endsWith(".docx") ||
                    filename.endsWith(".txt")
                  ) {
                    try {
                      const enhancedData = await processAttachment(
                        {
                          name: attachment.filename,
                          contentType: attachment.contentType,
                          size: attachment.size,
                          isResume: true,
                        },
                        attachment.content
                      );

                      // FIXED: Ensure proper data formatting
                      applicationData.name =
                        enhancedData.name || applicationData.name;
                      applicationData.email =
                        enhancedData.email || email.from?.value[0]?.address;
                      applicationData.phone = enhancedData.phone || "";
                      applicationData.skills = Array.isArray(
                        enhancedData.skills
                      )
                        ? enhancedData.skills
                        : [];
                      applicationData.experience =
                        enhancedData.experience || "";
                      applicationData.languages = Array.isArray(
                        enhancedData.languages
                      )
                        ? enhancedData.languages
                        : [];
                      applicationData.jobTitle = enhancedData.jobTitle || "";
                      applicationData.linkedIn = enhancedData.linkedIn || "";
                      applicationData.location = enhancedData.location || "";
                      applicationData.resumeText =
                        enhancedData.resumeText || "";
                      applicationData.originalFilename =
                        enhancedData.originalFilename || attachment.filename;
                      applicationData.fileType =
                        enhancedData.fileType || attachment.contentType;
                      applicationData.fileSize =
                        enhancedData.fileSize || attachment.size;

                      // NEW: Upload resume file to Firebase Storage
                      try {
                        logger.info(
                          `Uploading resume file to Firebase Storage: ${attachment.filename}`
                        );

                        const resumeFileURL = await uploadFileToStorage(
                          attachment.content,
                          attachment.filename,
                          attachment.contentType,
                          "resumes"
                        );

                        applicationData.resumeFileURL = resumeFileURL;
                        logger.info(
                          `Resume file uploaded successfully: ${resumeFileURL}`
                        );
                      } catch (uploadError) {
                        logger.error(
                          `Failed to upload resume file to Firebase Storage: ${uploadError.message}`
                        );
                        // Continue processing even if upload fails
                        applicationData.resumeFileURL = null;
                      }

                      // FIXED: Format education properly
                      if (enhancedData.education) {
                        if (typeof enhancedData.education === "string") {
                          applicationData.education = enhancedData.education;
                        } else if (Array.isArray(enhancedData.education)) {
                          applicationData.education = enhancedData.education
                            .map((edu) => {
                              if (typeof edu === "object" && edu !== null) {
                                const degree =
                                  edu.degree || edu.qualification || "";
                                const school =
                                  edu.institution ||
                                  edu.school ||
                                  edu.university ||
                                  "";
                                const year =
                                  edu.year ||
                                  edu.graduationYear ||
                                  edu.endYear ||
                                  "";
                                const field =
                                  edu.field ||
                                  edu.major ||
                                  edu.fieldOfStudy ||
                                  "";

                                let eduString = "";
                                if (degree) {
                                  eduString += degree;
                                  if (field) eduString += ` in ${field}`;
                                } else if (field) {
                                  eduString += field;
                                }

                                if (school) {
                                  eduString += eduString
                                    ? ` - ${school}`
                                    : school;
                                }

                                if (year) {
                                  eduString += ` (${year})`;
                                }

                                return eduString || JSON.stringify(edu);
                              }
                              return String(edu);
                            })
                            .filter(Boolean)
                            .join("\n");
                        } else if (typeof enhancedData.education === "object") {
                          const edu = enhancedData.education;
                          const degree = edu.degree || edu.qualification || "";
                          const school =
                            edu.institution ||
                            edu.school ||
                            edu.university ||
                            "";
                          const year =
                            edu.year || edu.graduationYear || edu.endYear || "";
                          const field =
                            edu.field || edu.major || edu.fieldOfStudy || "";

                          let eduString = "";
                          if (degree) {
                            eduString += degree;
                            if (field) eduString += ` in ${field}`;
                          } else if (field) {
                            eduString += field;
                          }

                          if (school) {
                            eduString += eduString ? ` - ${school}` : school;
                          }

                          if (year) {
                            eduString += ` (${year})`;
                          }

                          applicationData.education =
                            eduString || JSON.stringify(edu);
                        } else {
                          applicationData.education = String(
                            enhancedData.education
                          );
                        }
                      } else {
                        applicationData.education = "";
                      }

                      // UPDATED: Change source from "email_automation" to "email_import"
                      applicationData.source = "email_import";
                      applicationData.importMethod = "automated_parser";

                      break;
                    } catch (attError) {
                      logger.error(
                        `Error processing attachment ${attachment.filename}:`,
                        attError
                      );
                    }
                  }
                }
              }

              // FIXED: Ensure proper date formatting before saving
              applicationData.createdAt = new Date().toISOString();
              applicationData.updatedAt = new Date().toISOString();

              // Add email received date if available
              if (email.date) {
                try {
                  const emailDate = new Date(email.date);
                  if (!isNaN(emailDate.getTime())) {
                    applicationData.emailReceivedAt = emailDate.toISOString();
                  }
                } catch (dateError) {
                  console.warn("Invalid email date:", email.date);
                }
              }

              // UPDATED: Add to applications database instead of candidates
              try {
                const result = await addApplicationFromEmail(applicationData);

                if (result.created || result.id) {
                  candidates.push({ ...applicationData, id: result.id });
                  logger.info(
                    `Successfully added application to database: ${applicationData.name}`
                  );
                } else if (result.skipped) {
                  logger.info(
                    `Application skipped (${result.reason}): ${applicationData.email}`
                  );
                }
              } catch (dbError) {
                logger.error(
                  `Error adding application from email ${seqno} to database:`,
                  dbError
                );
              }
            } catch (error) {
              logger.error(`Error processing email ${seqno}:`, error);
            }
          });
        });

        fetch.once("error", (err) => {
          logger.error("IMAP fetch error:", err);
          imap.end();
          reject(err);
        });

        fetch.once("end", () => {
          // Clean up temp directory
          fs.rmdir(tempDir, { recursive: true }).catch((err) => {
            logger.warn(`Failed to remove temp directory ${tempDir}:`, err);
          });

          imap.end();
          resolve({
            processed: processedEmails.length,
            candidates,
          });
        });
      });
    });

    imap.once("error", (err) => {
      logger.error("IMAP connection error:", err);
      reject(err);
    });

    imap.connect();
  });
};

/**
 * Validate email connection
 * @param {Object} connectionConfig - Email provider configuration
 * @returns {Promise<Object>} Connection validation result
 */
const validateConnection = async (connectionConfig) => {
  return new Promise((resolve, reject) => {
    const imap = setupImapConnection(connectionConfig);

    imap.once("ready", () => {
      imap.end();
      resolve({ success: true, message: "Connection successful" });
    });

    imap.once("error", (err) => {
      reject(new Error(`Connection failed: ${err.message}`));
    });

    imap.connect();
  });
};

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Get email template
const getTemplate = (templateName) => {
  try {
    const templatePath = path.join(
      __dirname,
      "../templates",
      `${templateName}.html`
    );
    return fsSync.readFileSync(templatePath, "utf8");
  } catch (error) {
    logger.error(`Error loading template ${templateName}:`, error);
    throw new Error(
      `Email template ${templateName} not found or could not be loaded`
    );
  }
};

// Replace template variables
const processTemplate = (template, variables) => {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value || "");
  }
  return result;
};

// Send email using Resend
const sendEmail = async ({
  to,
  subject,
  templateName,
  templateData,
  from = {
    email: process.env.DEFAULT_FROM_EMAIL,
    name: process.env.DEFAULT_FROM_NAME,
  },
  attachments = [],
}) => {
  try {
    // Get and process the template
    const template = getTemplate(templateName);
    const htmlContent = processTemplate(template, templateData);

    // Prepare email data for Resend
    const emailData = {
      from: `${from.name} <${from.email}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: htmlContent,
      // Attachments if any
      attachments: attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
      })),
    };

    // Send the email
    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }

    logger.info(`Email sent successfully to ${to}, Resend ID: ${data.id}`);
    return {
      success: true,
      message: "Email sent successfully",
      id: data.id,
    };
  } catch (error) {
    logger.error("Email sending error:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Send assignment notification
const sendAssignmentNotification = async ({
  candidateId,
  teamMemberId,
  candidateName,
  assignerName,
  teamMemberEmail,
}) => {
  return sendEmail({
    to: teamMemberEmail,
    subject: `Candidate Assigned: ${candidateName}`,
    templateName: "assignmentNotification",
    templateData: {
      candidateName,
      assignerName,
      candidateId,
      teamMemberId,
      appUrl: process.env.APP_URL || "https://your-ats-app.com",
    },
  });
};

// Send team member invitation
const sendTeamMemberInvitation = async ({
  teamMemberId,
  name,
  email,
  role,
  inviterName,
}) => {
  return sendEmail({
    to: email,
    subject: "You've been invited to join the ATS platform",
    templateName: "teamInvitation",
    templateData: {
      name,
      role,
      inviterName,
      loginUrl: `${
        process.env.APP_URL || "https://your-ats-app.com"
      }/auth/login`,
      appUrl: process.env.APP_URL || "https://your-ats-app.com",
    },
  });
};

// Send team member update notification
const sendTeamMemberUpdate = async ({
  teamMemberId,
  name,
  email,
  role,
  previousRole,
  updaterName,
}) => {
  return sendEmail({
    to: email,
    subject: "Your ATS account has been updated",
    templateName: "teamUpdate",
    templateData: {
      name,
      role,
      previousRole,
      updaterName,
      loginUrl: `${
        process.env.APP_URL || "https://your-ats-app.com"
      }/auth/login`,
      appUrl: process.env.APP_URL || "https://your-ats-app.com",
    },
  });
};

// Send email to candidate
const sendCandidateEmail = async ({
  messageId,
  candidateId,
  candidateName,
  candidateEmail,
  subject,
  body,
  senderName,
}) => {
  return sendEmail({
    to: candidateEmail,
    subject,
    templateName: "candidateEmail",
    templateData: {
      candidateName,
      messageBody: body,
      senderName,
      messageId,
      appUrl: process.env.APP_URL || "https://your-ats-app.com",
    },
  });
};

// Send interview invitation with Zoom meeting link
const sendInterviewInvitation = async ({
  candidateEmail,
  candidateName,
  jobTitle,
  interviewDate,
  interviewTime,
  duration = 60,
  interviewerName,
  recruiterName,
  recruiterEmail,
  recruiterPhone,
  recruiterTitle = "Recruiter",
  companyName = "YTFCS",
  zoomMeeting,
}) => {
  try {
    // Validate required parameters
    if (!candidateEmail || !candidateName || !zoomMeeting) {
      throw new Error('Missing required parameters: candidateEmail, candidateName, and zoomMeeting are required');
    }

    // Extract Zoom meeting details
    const {
      join_url: zoomJoinUrl,
      id: zoomMeetingId,
      password: zoomPasscode,
      settings = {}
    } = zoomMeeting;

    // Format the interview date and time
    const formattedDate = new Date(interviewDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Default dial-in number (you can customize this based on your Zoom account)
    const zoomDialIn = "+1 301 715 8592"; // Default US number, can be made configurable

    // Prepare template data
    const templateData = {
      candidateName: candidateName || "Candidate",
      jobTitle: jobTitle || "Position",
      interviewDate: formattedDate,
      interviewTime: interviewTime || "TBD",
      duration: duration,
      interviewerName: interviewerName || recruiterName || "Hiring Team",
      recruiterName: recruiterName || "Hiring Team",
      recruiterEmail: recruiterEmail || process.env.DEFAULT_FROM_EMAIL,
      recruiterPhone: recruiterPhone || "N/A",
      recruiterTitle: recruiterTitle,
      companyName: companyName,
      zoomJoinUrl: zoomJoinUrl,
      zoomMeetingId: zoomMeetingId,
      zoomPasscode: zoomPasscode || "N/A",
      zoomDialIn: zoomDialIn,
      currentYear: new Date().getFullYear()
    };

    logger.info('Sending interview invitation:', {
      to: candidateEmail,
      candidateName,
      jobTitle,
      meetingId: zoomMeetingId
    });

    // Send the email using the interview invitation template
    const result = await sendEmail({
      to: candidateEmail,
      subject: `Interview Invitation - ${jobTitle} Position at ${companyName}`,
      templateName: "interviewInvitation",
      templateData,
      from: {
        email: recruiterEmail || process.env.DEFAULT_FROM_EMAIL,
        name: `${recruiterName} - ${companyName}` || process.env.DEFAULT_FROM_NAME
      }
    });

    logger.info('Interview invitation sent successfully:', {
      to: candidateEmail,
      meetingId: zoomMeetingId,
      resendId: result.id
    });

    return {
      success: true,
      message: 'Interview invitation sent successfully',
      emailId: result.id,
      zoomMeetingId: zoomMeetingId,
      zoomJoinUrl: zoomJoinUrl
    };

  } catch (error) {
    logger.error('Error sending interview invitation:', error);
    throw new Error(`Failed to send interview invitation: ${error.message}`);
  }
};

// services/emailService.js (updated downloadEmailAttachment with better logging)

// services/emailService.js (enhanced attachment extraction)

/**
 * Download an email attachment
 * @param {Object} connectionConfig - Email provider configuration
 * @param {string} emailId - Email ID (sequence number)
 * @param {string} attachmentId - Attachment ID
 * @returns {Promise<Object>} Attachment data with content
 */
const downloadEmailAttachment = async (
  connectionConfig,
  emailId,
  attachmentId
) => {
  return new Promise((resolve, reject) => {
    logger.info("Starting attachment download:", { emailId, attachmentId });

    const imap = setupImapConnection(connectionConfig);
    let attachmentData = null;
    let attachmentFound = false;
    let targetPart = null;
    let targetPartId = null;

    imap.once("ready", () => {
      logger.info("IMAP connection ready for attachment download");

      imap.openBox("INBOX", true, (err, box) => {
        if (err) {
          logger.error("Error opening inbox:", err);
          imap.end();
          return reject(err);
        }

        logger.info("Inbox opened, total messages:", box.messages.total);

        try {
          // Parse the attachment ID to get the UID and target index
          const attachmentMatch = attachmentId.match(/att-(\d+)-(\d+)/);
          let targetAttachmentIndex = 1;
          let targetUid = null;

          if (attachmentMatch) {
            targetUid = parseInt(attachmentMatch[1], 10);
            targetAttachmentIndex = parseInt(attachmentMatch[2], 10);
          }

          logger.info("Looking for attachment:", {
            emailId,
            targetUid,
            attachmentId,
            targetAttachmentIndex,
          });

          if (targetUid) {
            // First get the message structure
            const structFetch = imap.fetch(targetUid, {
              struct: true,
              uid: true,
            });

            structFetch.on("message", (msg, msgSeqno) => {
              logger.info("Getting message structure:", {
                targetUid,
                msgSeqno,
              });

              msg.once("attributes", (attrs) => {
                if (attrs.struct) {
                  let attachmentIndex = 0;

                  const findAttachment = (parts, parentPartId = "") => {
                    for (let i = 0; i < parts.length; i++) {
                      const part = parts[i];

                      if (Array.isArray(part)) {
                        findAttachment(
                          part,
                          parentPartId ? `${parentPartId}.${i + 1}` : `${i + 1}`
                        );
                      } else if (
                        part.disposition &&
                        ["attachment", "inline"].includes(
                          part.disposition.type.toLowerCase()
                        )
                      ) {
                        attachmentIndex++;
                        const currentPartId = parentPartId
                          ? `${parentPartId}.${i + 1}`
                          : `${i + 1}`;

                        if (attachmentIndex === targetAttachmentIndex) {
                          logger.info("Target attachment found!", {
                            partId: currentPartId,
                            filename: part.params?.name,
                            encoding: part.encoding,
                            size: part.size,
                            type: part.type,
                            subtype: part.subtype,
                          });
                          attachmentFound = true;
                          targetPartId = currentPartId;
                          targetPart = part;
                        }
                      }
                    }
                  };

                  findAttachment(attrs.struct);

                  if (!attachmentFound) {
                    logger.error("Attachment not found");
                    imap.end();
                    reject(new Error(`Attachment ${attachmentId} not found`));
                  }
                }
              });
            });

            structFetch.once("end", () => {
              if (attachmentFound && targetPart) {
                logger.info(
                  "Structure fetch completed, now fetching full message"
                );

                // Fetch the full message
                const fullFetch = imap.fetch(targetUid, {
                  bodies: "",
                  uid: true,
                });

                fullFetch.on("message", (fullMsg) => {
                  logger.info("Processing full message");
                  let messageBuffer = Buffer.alloc(0);

                  fullMsg.on("body", (stream) => {
                    stream.on("data", (chunk) => {
                      messageBuffer = Buffer.concat([messageBuffer, chunk]);
                    });

                    stream.on("end", () => {
                      logger.info(
                        "Full message received, size:",
                        messageBuffer.length
                      );

                      try {
                        const messageText = messageBuffer.toString();

                        // Log the first part of the message for debugging
                        logger.debug(
                          "Message preview (first 500 chars):",
                          messageText.substring(0, 500)
                        );

                        let attachmentContent = null;

                        // Method 1: Find attachment by boundary
                        const boundaryMatch = messageText.match(
                          /boundary="?([^"\s]+)"?/
                        );
                        if (boundaryMatch) {
                          const boundary = boundaryMatch[1];
                          logger.info("Found boundary:", boundary);

                          // Split message into parts
                          const parts = messageText.split(`--${boundary}`);
                          logger.info(
                            "Message split into parts:",
                            parts.length
                          );

                          // Look for the attachment part
                          for (let i = 0; i < parts.length; i++) {
                            const part = parts[i];

                            // Debug log for each part
                            if (part.includes("Content-Type")) {
                              logger.debug(
                                `Part ${i} headers:`,
                                part.substring(0, 300)
                              );
                            }

                            // Check various ways the attachment might be identified
                            const isAttachmentPart =
                              (targetPart.params?.name &&
                                (part.includes(
                                  `filename="${targetPart.params.name}"`
                                ) ||
                                  part.includes(
                                    `filename=${targetPart.params.name}`
                                  ) ||
                                  part.includes(
                                    `name="${targetPart.params.name}"`
                                  ) ||
                                  part.includes(
                                    `name=${targetPart.params.name}`
                                  ))) ||
                              (part.includes("Content-Type: application/pdf") &&
                                targetPart.type?.toLowerCase() ===
                                  "application" &&
                                targetPart.subtype?.toLowerCase() === "pdf") ||
                              (part.includes(
                                "Content-Disposition: attachment"
                              ) &&
                                part.includes(".pdf"));

                            if (isAttachmentPart) {
                              logger.info(
                                `Found attachment part at index ${i}`
                              );

                              // Find the content start (after headers)
                              const headerEndIndex = part.indexOf("\r\n\r\n");
                              const altHeaderEndIndex = part.indexOf("\n\n");
                              const contentStartIndex =
                                headerEndIndex !== -1
                                  ? headerEndIndex + 4
                                  : altHeaderEndIndex !== -1
                                  ? altHeaderEndIndex + 2
                                  : -1;

                              if (contentStartIndex !== -1) {
                                let content = part.substring(contentStartIndex);

                                // Remove trailing boundary if present
                                const endBoundaryIndex = content.indexOf(
                                  `\r\n--${boundary}`
                                );
                                if (endBoundaryIndex !== -1) {
                                  content = content.substring(
                                    0,
                                    endBoundaryIndex
                                  );
                                }

                                // Clean up the content
                                content = content.trim();

                                // Check encoding from headers
                                const encodingMatch = part.match(
                                  /Content-Transfer-Encoding:\s*(\S+)/i
                                );
                                const encoding = encodingMatch
                                  ? encodingMatch[1].toLowerCase()
                                  : "base64";

                                logger.info("Attachment encoding:", encoding);
                                logger.info(
                                  "Content length before processing:",
                                  content.length
                                );

                                if (encoding === "base64") {
                                  // Clean base64 content
                                  attachmentContent = content.replace(
                                    /[\r\n\s]/g,
                                    ""
                                  );
                                } else if (
                                  encoding === "7bit" ||
                                  encoding === "8bit"
                                ) {
                                  // Convert to base64
                                  attachmentContent = Buffer.from(
                                    content,
                                    "binary"
                                  ).toString("base64");
                                } else {
                                  // Default to base64 encoding
                                  attachmentContent =
                                    Buffer.from(content).toString("base64");
                                }

                                logger.info(
                                  "Processed content length:",
                                  attachmentContent.length
                                );
                                break;
                              } else {
                                logger.warn(
                                  "Could not find content start in part"
                                );
                              }
                            }
                          }
                        } else {
                          logger.warn("No boundary found in message");
                        }

                        // Method 2: Direct regex extraction
                        if (!attachmentContent && targetPart.params?.name) {
                          logger.info("Trying direct regex extraction");

                          // Try to find the attachment section directly
                          const escapedFilename =
                            targetPart.params.name.replace(
                              /[.*+?^${}()|[\]\\]/g,
                              "\\$&"
                            );
                          const attachmentRegex = new RegExp(
                            `Content-Type:[^\\r\\n]*\\r?\\n[^\\r\\n]*filename[="]${escapedFilename}[^\\r\\n]*\\r?\\n` +
                              `(?:[^\\r\\n]+\\r?\\n)*?` +
                              `Content-Transfer-Encoding:\\s*(\\w+)\\r?\\n` +
                              `(?:[^\\r\\n]+\\r?\\n)*?\\r?\\n` +
                              `([\\s\\S]+?)(?:\\r?\\n--|\$)`,
                            "i"
                          );

                          const match = messageText.match(attachmentRegex);
                          if (match) {
                            const encoding = match[1].toLowerCase();
                            let content = match[2];

                            logger.info(
                              "Found attachment with regex, encoding:",
                              encoding
                            );

                            if (encoding === "base64") {
                              attachmentContent = content.replace(
                                /[\r\n\s]/g,
                                ""
                              );
                            } else {
                              attachmentContent = Buffer.from(
                                content,
                                "binary"
                              ).toString("base64");
                            }
                          }
                        }

                        if (attachmentContent) {
                          attachmentData = {
                            filename:
                              targetPart.params?.name ||
                              `attachment-${targetAttachmentIndex}`,
                            contentType:
                              `${targetPart.type}/${targetPart.subtype}`.toLowerCase(),
                            content: attachmentContent,
                            encoding: "base64",
                            size:
                              targetPart.size ||
                              Buffer.from(attachmentContent, "base64").length,
                          };

                          logger.info(
                            "Attachment data prepared successfully:",
                            {
                              filename: attachmentData.filename,
                              contentType: attachmentData.contentType,
                              contentLength: attachmentData.content.length,
                              expectedSize: targetPart.size,
                            }
                          );
                        } else {
                          logger.error(
                            "Failed to extract attachment content from message"
                          );

                          // Log more details for debugging
                          logger.debug("Target part details:", {
                            filename: targetPart.params?.name,
                            type: targetPart.type,
                            subtype: targetPart.subtype,
                            encoding: targetPart.encoding,
                          });
                        }
                      } catch (parseError) {
                        logger.error("Error parsing full message:", parseError);
                      }
                    });
                  });
                });

                fullFetch.once("error", (err) => {
                  logger.error("Error in full fetch:", err);
                  imap.end();
                  reject(err);
                });

                fullFetch.once("end", () => {
                  logger.info("Full fetch completed");
                  setTimeout(() => {
                    imap.end();
                    if (attachmentData) {
                      logger.info("Attachment download successful");
                      resolve(attachmentData);
                    } else {
                      logger.error("Failed to extract attachment content");
                      reject(new Error("Failed to extract attachment content"));
                    }
                  }, 500);
                });
              }
            });

            structFetch.once("error", (err) => {
              logger.error("Error during structure fetch:", err);
              imap.end();
              reject(err);
            });
          } else {
            logger.warn("No UID found in attachment ID");
            imap.end();
            reject(new Error("Invalid attachment ID format"));
          }
        } catch (error) {
          logger.error("Error in download attachment:", error);
          imap.end();
          reject(error);
        }
      });
    });

    imap.once("error", (err) => {
      logger.error("IMAP connection error:", err);
      reject(err);
    });

    imap.connect();
  });
};

/**
 * Parse an email attachment to extract candidate data
 * @param {Object} connectionConfig - Email provider configuration
 * @param {string} emailId - Email ID
 * @param {string} attachmentId - Attachment ID
 * @returns {Promise<Object>} Parsed candidate data
 */
const parseEmailAttachment = async (
  connectionConfig,
  emailId,
  attachmentId
) => {
  try {
    // First, download the attachment
    const attachmentData = await downloadEmailAttachment(
      connectionConfig,
      emailId,
      attachmentId
    );

    if (!attachmentData || !attachmentData.content) {
      throw new Error("Failed to download attachment");
    }

    // Convert base64 content to buffer
    const buffer = Buffer.from(
      attachmentData.content,
      attachmentData.encoding || "base64"
    );

    // Process the attachment using the resume processor
    const attachmentMeta = {
      name: attachmentData.filename,
      contentType: attachmentData.contentType,
      size: attachmentData.size,
      isResume: /\.(pdf|doc|docx|txt)$/i.test(attachmentData.filename),
    };

    // Process attachment to extract candidate data
    const candidateData = await processAttachment(attachmentMeta, buffer);

    return candidateData;
  } catch (error) {
    logger.error("Error parsing email attachment:", error);
    throw error;
  }
};

module.exports = {
  // IMAP email retrieval functions
  listEmails,
  processEmails,
  validateConnection,
  parseCandidateFromEmail,
  isJobRelatedEmail,

  downloadEmailAttachment,
  parseEmailAttachment,

  // Email sending functions
  sendEmail,
  sendAssignmentNotification,
  sendTeamMemberInvitation,
  sendTeamMemberUpdate,
  sendCandidateEmail,
  sendInterviewInvitation,
};
