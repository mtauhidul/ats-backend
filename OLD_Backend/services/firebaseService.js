// services/firebaseService.js

const admin = require("firebase-admin");
const logger = require("../utils/logger");
const { encrypt, decrypt } = require("./cryptoService");

// Initialize Firebase with credentials from environment variables
let serviceAccount;

try {
  // Check for Base64 encoded credentials first
  if (process.env.FIREBASE_CREDENTIALS_BASE64) {
    const base64Credentials = process.env.FIREBASE_CREDENTIALS_BASE64;
    const jsonString = Buffer.from(base64Credentials, "base64").toString(
      "utf8"
    );
    serviceAccount = JSON.parse(jsonString);
    logger.info("Firebase credentials loaded from base64 environment variable");
  }
  // Fall back to JSON string if Base64 not available
  else if (process.env.FIREBASE_CREDENTIALS) {
    serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    logger.info("Firebase credentials loaded from JSON environment variable");
  }
  // Fall back to file path as last resort
  else if (process.env.FIREBASE_CREDENTIAL_JSON) {
    serviceAccount = require(process.env.FIREBASE_CREDENTIAL_JSON);
    logger.info("Firebase credentials loaded from file path");
  }
  // Try individual environment variables
  else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
    logger.info(
      "Firebase credentials loaded from individual environment variables"
    );
  } else {
    throw new Error(
      "No Firebase credentials found in environment variables or file path"
    );
  }
} catch (error) {
  logger.error("Error initializing Firebase credentials:", error);
  throw new Error(`Failed to initialize Firebase: ${error.message}`);
}

// Initialize Firebase app if not already initialized
if (!admin.apps.length) {
  const firebaseConfig = {
    credential: admin.credential.cert(serviceAccount),
  };

  // Add storage bucket if provided
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    firebaseConfig.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  }

  admin.initializeApp(firebaseConfig);
}

const db = admin.firestore();
const storage = admin.storage();

/**
 * Upload file to Firebase Storage
 * @param {Buffer|string} fileBuffer - File buffer or file path
 * @param {string} fileName - Name of the file
 * @param {string} contentType - MIME type of the file
 * @param {string} folder - Storage folder (default: 'resumes')
 * @returns {Promise<string>} Download URL of the uploaded file
 */
const uploadFileToStorage = async (
  fileBuffer,
  fileName,
  contentType,
  folder = "resumes"
) => {
  try {
    if (!process.env.FIREBASE_STORAGE_BUCKET) {
      throw new Error("Firebase Storage bucket not configured");
    }

    const bucket = storage.bucket();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const timestamp = Date.now();
    const filePath = `${folder}/${timestamp}_${sanitizedFileName}`;

    const file = bucket.file(filePath);

    logger.info(`Uploading file to Firebase Storage: ${filePath}`);

    const stream = file.createWriteStream({
      metadata: {
        contentType: contentType,
        metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
        },
      },
      resumable: false,
    });

    return new Promise((resolve, reject) => {
      stream.on("error", (error) => {
        logger.error(
          `Error uploading file to Firebase Storage: ${error.message}`
        );
        reject(error);
      });

      stream.on("finish", async () => {
        try {
          // Make the file publicly accessible
          await file.makePublic();

          // Get the download URL
          const downloadURL = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${filePath}`;

          logger.info(`File uploaded successfully: ${downloadURL}`);
          resolve(downloadURL);
        } catch (error) {
          logger.error(`Error making file public: ${error.message}`);
          reject(error);
        }
      });

      stream.end(fileBuffer);
    });
  } catch (error) {
    logger.error(`Error in uploadFileToStorage: ${error.message}`);
    throw error;
  }
};

/**
 * Delete file from Firebase Storage
 * @param {string} fileUrl - URL of the file to delete
 * @returns {Promise<boolean>} Success status
 */
const deleteFileFromStorage = async (fileUrl) => {
  try {
    if (!fileUrl || !process.env.FIREBASE_STORAGE_BUCKET) {
      return false;
    }

    const bucket = storage.bucket();
    const baseUrl = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/`;

    if (fileUrl.startsWith(baseUrl)) {
      const filePath = fileUrl.replace(baseUrl, "");
      const file = bucket.file(filePath);

      await file.delete();
      logger.info(`File deleted from Firebase Storage: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error(`Error deleting file from Firebase Storage: ${error.message}`);
    return false;
  }
};

/**
 * Get candidate by ID
 * @param {string} candidateId - Candidate ID
 * @returns {Promise<Object>} Candidate data
 */
const getCandidate = async (candidateId) => {
  try {
    const docRef = db.collection("candidates").doc(candidateId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`Candidate with ID ${candidateId} not found`);
    }

    return { id: doc.id, ...doc.data() };
  } catch (error) {
    logger.error(`Error fetching candidate with ID ${candidateId}:`, error);
    throw new Error(`Failed to retrieve candidate: ${error.message}`);
  }
};

/**
 * Check if candidate with given email already exists
 * @param {string} email - Candidate email
 * @returns {Promise<boolean>} True if candidate exists
 */
const checkCandidateExists = async (email) => {
  try {
    if (!email) return false;

    const normalizedEmail = email.toLowerCase().trim();
    const querySnapshot = await db
      .collection("candidates")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    return !querySnapshot.empty;
  } catch (error) {
    logger.error(
      `Error checking if candidate exists with email ${email}:`,
      error
    );
    // Return false if we can't check - better to potentially create duplicate than miss candidate
    return false;
  }
};

/**
 * Get existing candidate by email
 * @param {string} email - Candidate email
 * @returns {Promise<Object|null>} Existing candidate or null
 */
const getCandidateByEmail = async (email) => {
  try {
    if (!email) return null;

    const normalizedEmail = email.toLowerCase().trim();
    const querySnapshot = await db
      .collection("candidates")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    logger.error(`Error getting candidate by email ${email}:`, error);
    return null;
  }
};

/**
 * Check if a filename is a video file
 * @param {string} filename - The filename to check
 * @returns {boolean} True if it's a video file
 */
function isVideoFile(filename) {
  if (!filename) return false;
  const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp', '.ogv'];
  return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

/**
 * Categorize video file as introduction or resume based on filename
 * @param {string} filename - The video filename
 * @returns {string} 'introduction' or 'resume'
 */
function categorizeVideoFile(filename) {
  if (!filename) return 'resume';
  
  const name = filename.toLowerCase();
  
  // Check for video introduction keywords
  if (name.includes('intro') || name.includes('introduction') || name.includes('hello') || name.includes('greet')) {
    return 'introduction';
  }
  
  // Check for recording platform keywords (usually introductions)
  if (name.includes('loom') || name.includes('zoom') || name.includes('recording')) {
    return 'introduction';
  }
  
  // Default to resume if unclear
  return 'resume';
}

/**
 * Get MIME type for video file based on extension
 * @param {string} filename - The video filename
 * @returns {string} MIME type
 */
function getVideoMimeType(filename) {
  if (!filename) return '';
  
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.m4v': 'video/x-m4v',
    '.3gp': 'video/3gpp',
    '.ogv': 'video/ogg'
  };
  
  return mimeTypes[ext] || 'video/mp4';
}

/**
 * Create normalized application from email data (UPDATED for video support)
 * @param {Object} emailData - Raw email data
 * @returns {Object} Normalized application with all 116 fields (108 + 8 video)
 */
function createNormalizedApplicationFromEmail(emailData) {
  // Complete normalized schema with all 108 fields
  const NORMALIZED_SCHEMA = {
    // Core Identifiers & Assignment - Always Present (43 fields)
    assignedBy: "",
    assignedTo: "",
    assignmentDate: null,
    categories: [],
    communicationScore: 0,
    communications: [],
    companyName: "",
    createdAt: "",
    culturalScore: 0,
    currentOffer: null,
    education: [],
    email: "",
    emailVerified: false,
    experience: [],
    feedback: "",
    internalNotes: "",
    interviewHistory: [],
    interviewScore: 0,
    interviews: [],
    isArchived: false,
    isFlagged: false,
    jobId: "",
    jobTitle: "",
    lastCommunication: null,
    location: {
      state: "",
      city: "",
      address: null,
      country: ""
    },
    notes: "",
    offers: [],
    overallScore: 0,
    phone: "",
    phoneVerified: false,
    rating: 0,
    resumeFileName: "",
    scores: {},
    skills: [],
    source: "email",
    stage: "new",
    stageId: "",
    status: "pending",
    tags: [],
    technicalScore: 0,
    updatedAt: null,
    workflowHistory: [],
    workflowStage: "",

    // Frequently Present Fields (32 + 8 video fields = 40 fields)
  aiInsights: {
    aiVersion: null,
    reprocessReason: null,
    aiScore: null,
    aiProcessedAt: null
  },
  aiScore: 0,
  appliedPosition: "",
  assignedAt: null,
  candidateName: "",
  category: "General",
  certifications: [],
  emailReceivedAt: "",
  fileSize: 0,
  fileType: "",
  hasResume: false,
  hasResumeAttachment: false,
  
  // NEW: Video Resume Support (8 new fields)
  hasVideoResume: false,
  hasVideoIntroduction: false,
  videoResume: {
    fileName: "",
    fileURL: "",
    fileSize: 0,
    fileType: "",
    duration: 0,
    thumbnailURL: "",
    uploadedAt: null,
    processedAt: null
  },
  videoIntroduction: {
    fileName: "",
    fileURL: "",
    fileSize: 0,
    fileType: "",
    duration: 0,
    thumbnailURL: "",
    uploadedAt: null,
    processedAt: null
  },
  videoResumeFileName: "",
  videoResumeURL: "",
  videoResumeFileSize: 0,
  videoResumeFileType: "",
    history: [],
    id: "",
    importDate: "",
    importMethod: "",
    languages: [],
    lastReprocessed: null,
    linkedIn: null,
    name: "",
    originalFilename: "",
    parsedResume: {
      experience: "",
      phone: "",
      skills: [],
      email: "",
      languages: [],
      summary: "",
      education: [],
      location: "",
      certifications: [],
      name: ""
    },
    portfolioURL: null,
    reprocessedWith: "",
    resetInfo: {
      reason: "",
      resetVersion: "",
      resetAt: null
    },
    resume: {
      fileType: "",
      aiFeedback: null,
      textExtract: "",
      fileName: "",
      fileSize: 0,
      fileURL: "",
      score: {
        feedback: "",
        skillMatch: [],
        finalScore: 0
      }
    },
    resumeFileURL: "",
    resumeScore: {
      skillMatch: [],
      finalScore: 0,
      feedback: ""
    },
    resumeText: "",
    reviewNotes: null,
    reviewStatus: "",
    reviewedAt: null,
    reviewedBy: null,
    stageColor: "",
    stageName: "",

    // Rarely Present Fields (30 fields)
    aiReprocessReason: "",
    applicationSource: "",
    availableStartDate: "",
    candidateId: "",
    convertedAt: "",
    customFields: {},
    dateOfBirth: "",
    expectedSalary: "",
    firstName: "",
    gender: "",
    isActive: true,
    lastAIReprocess: null,
    lastName: "",
    lastNameFix: "",
    lastQuickFix: null,
    marketingConsent: false,
    migrationInfo: {
      migratedFrom: "",
      originalId: "",
      migrationVersion: "",
      migratedAt: null
    },
    nameFixReason: "",
    nameFixedBy: "",
    nationality: "",
    parsedResumeData: {},
    privacyConsent: false,
    quickFixReason: "",
    referredBy: "",
    rejectionReason: "",
    reprocessedReason: "",
    resumeUrl: "",
    reviewedById: "",
    sourceDetails: "",
    submittedAt: ""
  };

  // Start with the complete normalized schema
  const normalizedApp = JSON.parse(JSON.stringify(NORMALIZED_SCHEMA));

  // Map email-specific data to normalized fields
  if (emailData.name) {
    normalizedApp.name = emailData.name;
    normalizedApp.candidateName = emailData.name;
  }
  
  if (emailData.email) {
    normalizedApp.email = emailData.email.toLowerCase().trim();
    normalizedApp.parsedResume.email = emailData.email.toLowerCase().trim();
  }
  
  if (emailData.phone) {
    normalizedApp.phone = emailData.phone;
    normalizedApp.parsedResume.phone = emailData.phone;
  }
  
  if (emailData.skills) {
    normalizedApp.skills = Array.isArray(emailData.skills) ? emailData.skills : [];
    normalizedApp.parsedResume.skills = Array.isArray(emailData.skills) ? emailData.skills : [];
  }
  
  if (emailData.experience) {
    normalizedApp.experience = Array.isArray(emailData.experience) ? emailData.experience : [emailData.experience];
    normalizedApp.parsedResume.experience = Array.isArray(emailData.experience) ? emailData.experience.join('; ') : emailData.experience;
  }
  
  if (emailData.education) {
    normalizedApp.education = Array.isArray(emailData.education) ? emailData.education : [emailData.education];
    normalizedApp.parsedResume.education = Array.isArray(emailData.education) ? emailData.education : [emailData.education];
  }

  if (emailData.resumeText) {
    normalizedApp.resumeText = emailData.resumeText;
    normalizedApp.parsedResume.summary = emailData.resumeText.substring(0, 500);
    normalizedApp.resume.textExtract = emailData.resumeText;
  }

  if (emailData.languages) {
    normalizedApp.languages = Array.isArray(emailData.languages) ? emailData.languages : [];
    normalizedApp.parsedResume.languages = Array.isArray(emailData.languages) ? emailData.languages : [];
  }

  if (emailData.certifications) {
    normalizedApp.certifications = Array.isArray(emailData.certifications) ? emailData.certifications : [];
    normalizedApp.parsedResume.certifications = Array.isArray(emailData.certifications) ? emailData.certifications : [];
  }

  // Set email import specific fields
  normalizedApp.source = "email";
  normalizedApp.importMethod = emailData.importMethod || "automated_parser";
  normalizedApp.status = "pending";
  normalizedApp.reviewStatus = "unreviewed";
  normalizedApp.stage = "new";
  normalizedApp.category = "General";

  // File information
  if (emailData.originalFilename) {
    normalizedApp.originalFilename = emailData.originalFilename;
    normalizedApp.resumeFileName = emailData.originalFilename;
    normalizedApp.resume.fileName = emailData.originalFilename;
  }

  if (emailData.fileSize) {
    normalizedApp.fileSize = emailData.fileSize;
    normalizedApp.resume.fileSize = emailData.fileSize;
  }

  if (emailData.fileType) {
    normalizedApp.fileType = emailData.fileType;
    normalizedApp.resume.fileType = emailData.fileType;
  }

  if (emailData.hasResume) {
    normalizedApp.hasResume = emailData.hasResume;
  }

  if (emailData.hasResumeAttachment) {
    normalizedApp.hasResumeAttachment = emailData.hasResumeAttachment;
  }

  if (emailData.appliedPosition) {
    normalizedApp.appliedPosition = emailData.appliedPosition;
  }

  // Set timestamps
  const now = new Date().toISOString();
  normalizedApp.createdAt = emailData.createdAt || now;
  normalizedApp.updatedAt = now;
  normalizedApp.importDate = now;
  normalizedApp.emailReceivedAt = emailData.emailReceivedAt || now;

  // Set history
  normalizedApp.history = emailData.history || [{
    date: now,
    note: emailData.notes || "Imported automatically from email"
  }];

  // Set notes
  if (emailData.notes) {
    normalizedApp.notes = emailData.notes;
  }

  // NEW: Video file handling
  if (emailData.originalFilename && isVideoFile(emailData.originalFilename)) {
    const videoType = categorizeVideoFile(emailData.originalFilename);
    
    if (videoType === 'introduction') {
      normalizedApp.hasVideoIntroduction = true;
      normalizedApp.videoIntroduction = {
        fileName: emailData.originalFilename,
        fileURL: emailData.resumeFileURL || "",
        fileSize: emailData.fileSize || 0,
        fileType: getVideoMimeType(emailData.originalFilename),
        duration: 0,
        thumbnailURL: "",
        uploadedAt: now,
        processedAt: null
      };
      normalizedApp.hasResume = false; // Not a document resume
      normalizedApp.resumeFileName = ""; // Clear document resume field
    } else {
      normalizedApp.hasVideoResume = true;
      normalizedApp.videoResume = {
        fileName: emailData.originalFilename,
        fileURL: emailData.resumeFileURL || "",
        fileSize: emailData.fileSize || 0,
        fileType: getVideoMimeType(emailData.originalFilename),
        duration: 0,
        thumbnailURL: "",
        uploadedAt: now,
        processedAt: null
      };
      
      // Backward compatibility fields
      normalizedApp.videoResumeFileName = emailData.originalFilename;
      normalizedApp.videoResumeURL = emailData.resumeFileURL || "";
      normalizedApp.videoResumeFileSize = emailData.fileSize || 0;
      normalizedApp.videoResumeFileType = getVideoMimeType(emailData.originalFilename);
      normalizedApp.hasResume = false; // Not a document resume
      normalizedApp.resumeFileName = ""; // Clear document resume field
    }
    
    normalizedApp.hasResumeAttachment = true;
  }

  return normalizedApp;
}

/**
 * Add application from email import to applications collection (UPDATED for normalized structure)
 * @param {Object} applicationData - Application information
 * @returns {Promise<Object>} Result of the operation
 */
const addApplicationFromEmail = async (applicationData) => {
  try {
    // Check if application with this email already exists in applications collection
    if (applicationData.email) {
      const exists = await checkApplicationExists(applicationData.email);
      if (exists) {
        logger.info(
          `Application with email ${applicationData.email} already exists, skipping`
        );
        return { id: null, skipped: true, reason: "duplicate_email" };
      }
    }

    // Check if application data is valid
    if (!applicationData.name) {
      throw new Error("Application name is required");
    }

    // Create normalized application structure
    const normalizedApplication = createNormalizedApplicationFromEmail(applicationData);

    // Add new application to Firestore
    const applicationRef = db.collection("applications").doc();
    normalizedApplication.id = applicationRef.id;

    await applicationRef.set(normalizedApplication);

    logger.info(
      `Added normalized application from email: ${applicationData.name} (${applicationData.email})`
    );
    return { id: applicationRef.id, created: true };
  } catch (error) {
    logger.error("Error adding application from email import:", error);
    throw new Error(`Failed to add application: ${error.message}`);
  }
};

/**
 * Check if application with given email already exists in applications collection
 * @param {string} email - Application email
 * @returns {Promise<boolean>} True if application exists
 */
const checkApplicationExists = async (email) => {
  try {
    if (!email) return false;

    const normalizedEmail = email.toLowerCase().trim();
    const querySnapshot = await db
      .collection("applications")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    return !querySnapshot.empty;
  } catch (error) {
    logger.error(
      `Error checking if application exists with email ${email}:`,
      error
    );
    // Return false if we can't check - better to potentially create duplicate than miss application
    return false;
  }
};

/**
 * Add candidate from email import with deduplication (LEGACY - for backwards compatibility)
 * @param {Object} candidateData - Candidate information
 * @returns {Promise<Object>} Result of the operation
 */
const addCandidateFromEmail = async (candidateData) => {
  try {
    // Check if candidate with this email already exists
    if (candidateData.email) {
      const exists = await checkCandidateExists(candidateData.email);
      if (exists) {
        logger.info(
          `Candidate with email ${candidateData.email} already exists, skipping`
        );
        return { id: null, skipped: true, reason: "duplicate_email" };
      }
    }

    // Check if candidate data is valid
    if (!candidateData.name) {
      throw new Error("Candidate name is required");
    }

    // Add new candidate to Firestore
    const candidateRef = db.collection("candidates").doc();

    // FIXED: Ensure all dates are properly formatted
    const now = new Date();
    const timestamp = now.toISOString();

    const candidate = {
      ...candidateData,
      id: candidateRef.id,
      // FIXED: Use ISO string format for dates
      createdAt: candidateData.createdAt || timestamp,
      updatedAt: candidateData.updatedAt || timestamp,
      // Ensure email is lowercase for consistency
      email: candidateData.email
        ? candidateData.email.toLowerCase().trim()
        : null,
      // FIXED: Ensure education is a string
      education:
        typeof candidateData.education === "string"
          ? candidateData.education
          : candidateData.education
          ? String(candidateData.education)
          : "",
      // Default fields for automation
      source: candidateData.source || "email_automation",
      importMethod: candidateData.importMethod || "automated_parser",
      tags: candidateData.tags || [],
      stageId: candidateData.stageId || "",
      rating: candidateData.rating || 0,
      skills: Array.isArray(candidateData.skills) ? candidateData.skills : [],
      languages: Array.isArray(candidateData.languages)
        ? candidateData.languages
        : [],
      history: candidateData.history || [
        {
          date: timestamp,
          note: candidateData.notes || `Imported automatically from email`,
        },
      ],
    };

    // Remove any undefined or null values that might cause issues
    Object.keys(candidate).forEach((key) => {
      if (candidate[key] === undefined) {
        delete candidate[key];
      }
    });

    await candidateRef.set(candidate);

    logger.info(
      `Added candidate from email: ${candidateData.name} (${candidateData.email})`
    );
    return { id: candidateRef.id, created: true };
  } catch (error) {
    logger.error("Error adding candidate from email import:", error);
    throw new Error(`Failed to add candidate: ${error.message}`);
  }
};

/**
 * Add multiple candidates in batch
 * @param {Array<Object>} candidatesData - Array of candidate information
 * @returns {Promise<Object>} Results of batch operation
 */
const batchAddCandidates = async (candidatesData) => {
  try {
    if (!Array.isArray(candidatesData) || candidatesData.length === 0) {
      return { success: false, message: "No candidates to add" };
    }

    const batch = db.batch();
    const results = {
      totalProcessed: candidatesData.length,
      added: 0,
      updated: 0,
      failed: 0,
      ids: [],
    };

    // First, check which emails already exist
    const uniqueEmails = [
      ...new Set(candidatesData.filter((c) => c.email).map((c) => c.email)),
    ];

    let existingEmailsMap = {};

    if (uniqueEmails.length > 0) {
      // Firestore "in" queries are limited to 10 values
      // For larger sets, we'd need to break this into chunks
      const chunkSize = 10;
      const emailChunks = [];

      for (let i = 0; i < uniqueEmails.length; i += chunkSize) {
        emailChunks.push(uniqueEmails.slice(i, i + chunkSize));
      }

      // Process each chunk
      for (const chunk of emailChunks) {
        const querySnapshot = await db
          .collection("candidates")
          .where("email", "in", chunk)
          .get();

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.email) {
            existingEmailsMap[data.email] = {
              id: doc.id,
              ...data,
            };
          }
        });
      }
    }

    // Process each candidate
    for (const candidateData of candidatesData) {
      try {
        const timestamp = new Date().toISOString();

        if (candidateData.email && existingEmailsMap[candidateData.email]) {
          // Update existing candidate
          const existingCandidate = existingEmailsMap[candidateData.email];
          const docRef = db.collection("candidates").doc(existingCandidate.id);

          // Update the history
          const history = existingCandidate.history || [];
          history.push({
            date: timestamp,
            note: `Updated from batch import`,
          });

          batch.update(docRef, {
            updatedAt: timestamp,
            history,
            // Only update non-existent fields
            ...(!existingCandidate.source && { source: candidateData.source }),
            ...(!existingCandidate.hasResume &&
              candidateData.hasResume && {
                hasResume: candidateData.hasResume,
                resumeFileName: candidateData.resumeFileName,
              }),
          });

          results.updated++;
          results.ids.push(existingCandidate.id);
        } else {
          // Add new candidate
          const newCandidateRef = db.collection("candidates").doc();

          // Ensure required fields
          const completeData = {
            ...candidateData,
            createdAt: timestamp,
            updatedAt: timestamp,
            stageId: candidateData.stageId || "",
            tags: candidateData.tags || [],
            rating: candidateData.rating || 0,
            history: [
              {
                date: timestamp,
                note: "Imported from batch operation",
              },
            ],
            // If email is missing, add it with a placeholder
            email:
              candidateData.email ||
              `unknown-${new Date().getTime()}-${
                results.added
              }@placeholder.com`,
          };

          batch.set(newCandidateRef, completeData);

          results.added++;
          results.ids.push(newCandidateRef.id);
        }
      } catch (error) {
        logger.error("Error processing candidate in batch:", error);
        results.failed++;
      }
    }

    // Commit the batch
    await batch.commit();

    logger.info(
      `Batch processed ${results.totalProcessed} candidates: added ${results.added}, updated ${results.updated}, failed ${results.failed}`
    );

    return {
      success: true,
      ...results,
    };
  } catch (error) {
    logger.error("Error in batch adding candidates:", error);
    throw new Error(`Failed to process batch: ${error.message}`);
  }
};

/**
 * Update message status
 * @param {string} messageId - Message ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Success indicator
 */
const updateMessageStatus = async (messageId, status) => {
  try {
    const docRef = db.collection("messages").doc(messageId);
    await docRef.update({
      status,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    logger.error(
      `Error updating message ${messageId} status to ${status}:`,
      error
    );
    throw new Error(`Failed to update message status: ${error.message}`);
  }
};

/**
 * Get team member by ID
 * @param {string} teamMemberId - Team member ID
 * @returns {Promise<Object>} Team member data
 */
const getTeamMember = async (teamMemberId) => {
  try {
    const docRef = db.collection("teamMembers").doc(teamMemberId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`Team member with ID ${teamMemberId} not found`);
    }

    return { id: doc.id, ...doc.data() };
  } catch (error) {
    logger.error(`Error fetching team member with ID ${teamMemberId}:`, error);
    throw new Error(`Failed to retrieve team member: ${error.message}`);
  }
};

/**
 * Process and extract data from email attachments (resume parsing)
 * @param {Object} attachment - Email attachment data
 * @param {Object} candidateData - Existing candidate data to enrich
 * @returns {Promise<Object>} Enriched candidate data
 */
const processAttachment = async (attachment, candidateData) => {
  try {
    // In a real implementation, this would:
    // 1. Download the attachment from the email
    // 2. Use OCR/NLP to extract information from the resume
    // 3. Return the enhanced candidate data

    // For now, just add a flag that we have a resume attachment
    return {
      ...candidateData,
      hasResumeAttachment: true,
      resumeFilename: attachment.name,
      resumeFileType: attachment.contentType,
      resumeFileSize: attachment.size,
    };
  } catch (error) {
    logger.error("Error processing attachment:", error);
    // Return original data if processing fails
    return candidateData;
  }
};

// ===== NEW EMAIL AUTOMATION FUNCTIONS =====

/**
 * Store email account configuration for automation
 * @param {Object} accountData - Email account data
 * @returns {Promise<Object>} Stored account with ID
 */
const storeEmailAccount = async (accountData) => {
  try {
    const accountRef = db.collection("emailAccounts").doc();

    // Encrypt the password before storing
    let encryptedPassword;
    try {
      encryptedPassword = encrypt(accountData.password);
      logger.info(`Encrypted password for account: ${accountData.username}`);
    } catch (error) {
      logger.error("Failed to encrypt password:", error);
      throw new Error("Failed to encrypt account credentials");
    }

    const account = {
      id: accountRef.id,
      provider: accountData.provider,
      username: accountData.username,
      password: encryptedPassword, // Encrypted password object
      encrypted: true, // Flag to indicate password is encrypted
      automationEnabled: accountData.automationEnabled || false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastChecked: null,
      totalProcessed: 0,
      totalImported: 0,
      lastError: null,
      lastErrorAt: null,
      isActive: true,
      // Only add server/port if they exist (for IMAP)
      ...(accountData.server && { server: accountData.server }),
      ...(accountData.port && { port: accountData.port }),
    };

    await accountRef.set(account);

    logger.info(`Stored email account with encrypted password: ${accountData.username}`);
    return { id: accountRef.id, ...account };
  } catch (error) {
    logger.error("Error storing email account:", error);
    throw error;
  }
};

/**
 * Get stored email accounts with optional filters
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Array>} Array of email accounts
 */
const getStoredEmailAccounts = async (filters = {}) => {
  try {
    let query = db.collection("emailAccounts");

    // Apply filters
    if (filters.automationEnabled !== undefined) {
      query = query.where("automationEnabled", "==", filters.automationEnabled);
    }

    if (filters.isActive !== undefined) {
      query = query.where("isActive", "==", filters.isActive);
    }

    if (filters.id) {
      query = query.where(
        admin.firestore.FieldPath.documentId(),
        "==",
        filters.id
      );
    }

    const snapshot = await query.get();

    const accounts = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      accounts.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to Date objects
        createdAt: data.createdAt?.toDate(),
        lastChecked: data.lastChecked?.toDate(),
        lastErrorAt: data.lastErrorAt?.toDate(),
      });
    });

    return accounts;
  } catch (error) {
    logger.error("Error getting stored email accounts:", error);
    throw error;
  }
};

/**
 * Update email account settings
 * @param {string} accountId - Account ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<boolean>} Success indicator
 */
const updateEmailAccount = async (accountId, updates) => {
  try {
    const accountRef = db.collection("emailAccounts").doc(accountId);

    const updateData = {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await accountRef.update(updateData);

    logger.info(`Updated email account: ${accountId}`);
    return true;
  } catch (error) {
    logger.error(`Error updating email account ${accountId}:`, error);
    throw error;
  }
};

/**
 * Update last checked time for an email account
 * @param {string} accountId - Account ID
 * @param {Date} timestamp - Timestamp to set
 * @returns {Promise<boolean>} Success indicator
 */
const updateAccountLastChecked = async (accountId, timestamp = new Date()) => {
  try {
    const accountRef = db.collection("emailAccounts").doc(accountId);

    await accountRef.update({
      lastChecked: admin.firestore.Timestamp.fromDate(timestamp),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return true;
  } catch (error) {
    logger.error(
      `Error updating last checked time for account ${accountId}:`,
      error
    );
    throw error;
  }
};

/**
 * Increment processing stats for an email account
 * @param {string} accountId - Account ID
 * @param {Object} stats - Stats to update
 * @returns {Promise<boolean>} Success indicator
 */
const updateAccountStats = async (accountId, stats) => {
  try {
    const accountRef = db.collection("emailAccounts").doc(accountId);

    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (stats.processed) {
      updates.totalProcessed = admin.firestore.FieldValue.increment(
        stats.processed
      );
    }

    if (stats.imported) {
      updates.totalImported = admin.firestore.FieldValue.increment(
        stats.imported
      );
    }

    if (stats.lastError) {
      updates.lastError = stats.lastError;
      updates.lastErrorAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await accountRef.update(updates);

    return true;
  } catch (error) {
    logger.error(`Error updating account stats for ${accountId}:`, error);
    throw error;
  }
};

/**
 * Store automation log entry
 * @param {Object} activity - Activity to log
 * @returns {Promise<string>} Log entry ID
 */
const logAutomationActivity = async (activity) => {
  try {
    const logRef = db.collection("automationLogs").doc();

    const logEntry = {
      id: logRef.id,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type: activity.type, // 'check_started', 'check_completed', 'candidate_imported', 'error'
      accountId: activity.accountId,
      accountEmail: activity.accountEmail,
      details: activity.details || {},
      candidateId: activity.candidateId || null,
      errorMessage: activity.error || null,
    };

    await logRef.set(logEntry);
    return logRef.id;
  } catch (error) {
    logger.error("Error logging automation activity:", error);
    // Don't throw error for logging failures
  }
};

/**
 * Get automation logs with pagination
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Logs and pagination info
 */
const getAutomationLogs = async (options = {}) => {
  try {
    let query = db.collection("automationLogs").orderBy("timestamp", "desc");

    // Apply filters
    if (options.accountId) {
      query = query.where("accountId", "==", options.accountId);
    }

    if (options.type) {
      query = query.where("type", "==", options.type);
    }

    // Apply pagination
    const limit = options.limit || 50;
    query = query.limit(limit);

    if (options.startAfter) {
      const startAfterDoc = await db
        .collection("automationLogs")
        .doc(options.startAfter)
        .get();
      query = query.startAfter(startAfterDoc);
    }

    const snapshot = await query.get();

    const logs = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate(),
      });
    });

    return {
      logs,
      hasMore: logs.length === limit,
      lastDoc: logs.length > 0 ? logs[logs.length - 1].id : null,
    };
  } catch (error) {
    logger.error("Error getting automation logs:", error);
    throw error;
  }
};

/**
 * Delete email account
 * @param {string} accountId - Account ID
 * @returns {Promise<boolean>} Success indicator
 */
const deleteEmailAccount = async (accountId) => {
  try {
    await db.collection("emailAccounts").doc(accountId).delete();

    logger.info(`Deleted email account: ${accountId}`);
    return true;
  } catch (error) {
    logger.error(`Error deleting email account ${accountId}:`, error);
    throw error;
  }
};

/**
 * Get automation statistics
 * @param {string} accountId - Optional account ID for specific stats
 * @returns {Promise<Object>} Statistics object
 */
const getAutomationStats = async (accountId = null) => {
  try {
    let accountsQuery = db.collection("emailAccounts");

    if (accountId) {
      accountsQuery = accountsQuery.where(
        admin.firestore.FieldPath.documentId(),
        "==",
        accountId
      );
    }

    const accountsSnapshot = await accountsQuery.get();

    let totalAccounts = 0;
    let activeAccounts = 0;
    let totalProcessed = 0;
    let totalImported = 0;

    accountsSnapshot.forEach((doc) => {
      const data = doc.data();
      totalAccounts++;

      if (data.automationEnabled && data.isActive) {
        activeAccounts++;
      }

      totalProcessed += data.totalProcessed || 0;
      totalImported += data.totalImported || 0;
    });

    // Get recent activity (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let recentLogsQuery = db
      .collection("automationLogs")
      .where("timestamp", ">", admin.firestore.Timestamp.fromDate(yesterday));

    if (accountId) {
      recentLogsQuery = recentLogsQuery.where("accountId", "==", accountId);
    }

    const recentLogsSnapshot = await recentLogsQuery.get();

    let recentImports = 0;
    let recentErrors = 0;

    recentLogsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.type === "candidate_imported") {
        recentImports++;
      } else if (data.type === "error") {
        recentErrors++;
      }
    });

    return {
      totalAccounts,
      activeAccounts,
      totalProcessed,
      totalImported,
      recentImports,
      recentErrors,
      lastUpdated: new Date(),
    };
  } catch (error) {
    logger.error("Error getting automation stats:", error);
    throw error;
  }
};

/* ------------------------------------------------------------------ */
/* 1️⃣  getCandidatesByTimeAndNote                                     */
/* ------------------------------------------------------------------ */
const getCandidatesByTimeAndNote = async ({ since, notePattern = null }) => {
  try {
    // ‼️  Our Firestore field `createdAt` is stored as an ISO **string**,
    //     so we must compare string-to-string, not Timestamp-to-string.
    const sinceISO =
      since instanceof Date ? since.toISOString() : String(since);

    const qSnap = await db
      .collection("candidates")
      .where("createdAt", ">=", sinceISO) // 👈 string compare
      .orderBy("createdAt", "asc")
      .get();

    const docs = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    /* ---------- optional note filtering (checks history array too) -- */
    if (!notePattern) return docs;

    const re = new RegExp(notePattern, "i");
    return docs.filter((c) =>
      (c.history || []).some((h) => re.test(h?.note ?? ""))
    );
  } catch (err) {
    logger.error("getCandidatesByTimeAndNote:", err);
    throw err;
  }
};

/* ------------------------------------------------------------------ */
/* 2️⃣  getCandidatesSince                                             */
/* ------------------------------------------------------------------ */
const getCandidatesSince = async (since) => {
  try {
    const sinceISO =
      since instanceof Date ? since.toISOString() : String(since);

    const qSnap = await db
      .collection("candidates")
      .where("createdAt", ">=", sinceISO)
      .orderBy("createdAt", "asc")
      .get();

    return qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    logger.error("getCandidatesSince:", err);
    throw err;
  }
};

/* ------------------------------------------------------------------ */
/* 3️⃣  getCandidatesCountByPattern                                    */
/*     (same date-string tweak, regex checks history)                  */
/* ------------------------------------------------------------------ */
const getCandidatesCountByPattern = async ({
  since,
  until = new Date(),
  notePattern,
}) => {
  try {
    const sinceISO =
      since instanceof Date ? since.toISOString() : String(since);
    const untilISO =
      until instanceof Date ? until.toISOString() : String(until);

    const qSnap = await db
      .collection("candidates")
      .where("createdAt", ">=", sinceISO)
      .where("createdAt", "<=", untilISO)
      .orderBy("createdAt", "asc")
      .get();

    const re = new RegExp(notePattern, "i");
    return qSnap.docs.reduce((cnt, d) => {
      const hist = d.data().history || [];
      return hist.some((h) => re.test(h?.note ?? "")) ? cnt + 1 : cnt;
    }, 0);
  } catch (err) {
    logger.error("getCandidatesCountByPattern:", err);
    throw err;
  }
};

/**
 * Get email imported candidates with detailed breakdown
 * @param {Object} options - Query options
 * @param {Date} options.since - Date threshold
 * @param {number} options.limit - Maximum number of results (optional)
 * @returns {Object} Detailed breakdown of email imported candidates
 */
const getEmailImportedCandidatesBreakdown = async ({ since, limit = null }) => {
  try {
    const candidates = await getCandidatesByTimeAndNote({
      since,
      notePattern: "Imported from email with subject:",
    });

    // Filter for exact email import pattern
    const emailImportPattern =
      /^Imported from email with subject:\s*JOB-\d+-[A-Z]+/i;
    const emailImported = candidates.filter((candidate) => {
      const note = candidate.note || "";
      return emailImportPattern.test(note);
    });

    // Apply limit if specified
    const limitedResults = limit
      ? emailImported.slice(0, limit)
      : emailImported;

    // Create breakdown by job reference
    const jobBreakdown = {};
    const dailyBreakdown = {};

    limitedResults.forEach((candidate) => {
      // Extract job reference
      const jobMatch = candidate.note.match(/JOB-(\d+)-([A-Z]+)/i);
      if (jobMatch) {
        const jobRef = jobMatch[0];
        if (!jobBreakdown[jobRef]) {
          jobBreakdown[jobRef] = {
            count: 0,
            candidates: [],
          };
        }
        jobBreakdown[jobRef].count++;
        jobBreakdown[jobRef].candidates.push({
          id: candidate.id,
          createdAt: candidate.createdAt,
          name: candidate.name || "Unknown",
        });
      }

      // Daily breakdown
      if (candidate.createdAt) {
        const dayKey = candidate.createdAt.toISOString().split("T")[0];
        dailyBreakdown[dayKey] = (dailyBreakdown[dayKey] || 0) + 1;
      }
    });

    return {
      total: limitedResults.length,
      totalAvailable: emailImported.length,
      since: since.toISOString(),
      jobBreakdown,
      dailyBreakdown,
      candidates: limitedResults.map((c) => ({
        id: c.id,
        name: c.name || "Unknown",
        email: c.email || "",
        createdAt: c.createdAt,
        note: c.note,
      })),
    };
  } catch (error) {
    logger.error("Error getting email imported candidates breakdown:", error);
    throw error;
  }
};

module.exports = {
  // Firebase admin instance
  admin,
  
  // Existing functions
  db,
  getCandidate,
  getTeamMember,
  checkCandidateExists,
  getCandidateByEmail,
  updateMessageStatus,
  addCandidateFromEmail,
  batchAddCandidates,
  processAttachment,

  // NEW: Application functions for email automation workflow
  addApplicationFromEmail,
  checkApplicationExists,
  createNormalizedApplicationFromEmail,

  // Storage functions
  uploadFileToStorage,
  deleteFileFromStorage,

  // Existing automation functions
  storeEmailAccount,
  getStoredEmailAccounts,
  updateEmailAccount,
  updateAccountLastChecked,
  updateAccountStats,
  logAutomationActivity,
  getAutomationLogs,
  deleteEmailAccount,
  getAutomationStats,

  // NEW: Candidate querying functions for recent imports
  getCandidatesByTimeAndNote,
  getCandidatesSince,
  getCandidatesCountByPattern,
  getEmailImportedCandidatesBreakdown,
};
