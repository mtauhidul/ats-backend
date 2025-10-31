// routes/resume-parser.js
// Unified resume parsing endpoint for all resume processing

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { validateApiKey } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { z } = require('zod');
const logger = require('../utils/logger');
const { db, uploadFileToStorage } = require('../services/firebaseService');
const { validateFile, getUploadConfig } = require('../services/fileUploadService');
const EnhancedAIService = require('../services/enhancedAIService');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

// Initialize services
const enhancedAI = new EnhancedAIService();
const uploadConfig = getUploadConfig();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: uploadConfig.fileFilter,
  limits: uploadConfig.limits,
});

// Validation schema for resume parsing request
const parseResumeSchema = z.object({
  body: z.object({
    appliedPosition: z.string().optional(),
    jobId: z.string().optional(),
    source: z.enum(['web', 'email', 'api', 'manual']).default('web'),
    candidateEmail: z.string().email().optional()
  }).optional().default({})
});

// Apply auth middleware
router.use(validateApiKey);

/**
 * Normalized application schema following the 108-field structure
 * This ensures all applications have identical data structure
 */
function createNormalizedApplication(parsedData, fileInfo, requestData, applicationId) {
  const now = new Date().toISOString();

  return {
    // Core Identifiers & Assignment - Always Present (43 fields)
    assignedBy: "",
    assignedTo: "",
    assignmentDate: null,
    categories: [],
    communicationScore: 0,
    communications: [],
    companyName: parsedData.currentCompany || "",
    createdAt: now,
    culturalScore: 0,
    currentOffer: null,
    education: parsedData.education || [],
    email: parsedData.email || requestData.candidateEmail || "",
    emailVerified: false,
    experience: parsedData.experience || [],
    feedback: "",
    internalNotes: "",
    interviewHistory: [],
    interviewScore: 0,
    interviews: [],
    isArchived: false,
    isFlagged: false,
    jobId: requestData.jobId || "",
    jobTitle: parsedData.jobTitle || "",
    lastCommunication: null,
    location: {
      state: parsedData.location?.state || "",
      city: parsedData.location?.city || "",
      address: parsedData.location?.address || null,
      country: parsedData.location?.country || ""
    },
    notes: "",
    offers: [],
    overallScore: 0,
    phone: parsedData.phone || "",
    phoneVerified: false,
    rating: 0,
    resumeFileName: fileInfo.originalName || "",
    scores: {},
    skills: parsedData.skills || [],
    source: requestData.source || "web",
    stage: "new",
    stageId: "",
    status: "pending",
    tags: [],
    technicalScore: 0,
    updatedAt: now,
    workflowHistory: [],
    workflowStage: "",

    // Frequently Present Fields (32 fields)
    aiInsights: {
      aiVersion: "enhanced-v2",
      reprocessReason: null,
      aiScore: null,
      aiProcessedAt: now
    },
    aiScore: 0, // Will be set during scoring phase
    appliedPosition: requestData.appliedPosition || "",
    assignedAt: null,
    candidateName: parsedData.name || "",
    category: "General",
    certifications: parsedData.certifications || [],
    emailReceivedAt: requestData.source === 'email' ? now : "",
    fileSize: fileInfo.size || 0,
    fileType: fileInfo.mimetype || "",
    hasResume: true,
    hasResumeAttachment: true,
    history: [{
      date: now,
      note: `Resume parsed and imported via ${requestData.source} with AI parsing`,
      actionBy: "system"
    }],
    id: applicationId,
    importDate: now,
    importMethod: "enhanced_ai_parser",
    languages: parsedData.languages || [],
    lastReprocessed: null,
    linkedIn: parsedData.linkedIn || null,
    name: parsedData.name || "",
    originalFilename: fileInfo.originalName || "",
    parsedResume: {
      experience: parsedData.experienceSummary || "",
      phone: parsedData.phone || "",
      skills: parsedData.skills || [],
      email: parsedData.email || "",
      languages: parsedData.languages || [],
      summary: parsedData.summary || "",
      education: parsedData.education || [],
      location: parsedData.location?.full || "",
      certifications: parsedData.certifications || [],
      name: parsedData.name || ""
    },
    portfolioURL: parsedData.portfolioURL || null,
    reprocessedWith: "enhanced-ai-v2",
    resetInfo: {
      reason: "",
      resetVersion: "",
      resetAt: null
    },
    resume: {
      fileType: fileInfo.mimetype || "",
      aiFeedback: null,
      textExtract: fileInfo.extractedText || "",
      fileName: fileInfo.originalName || "",
      fileSize: fileInfo.size || 0,
      fileURL: fileInfo.downloadURL || "",
      score: {
        feedback: "",
        skillMatch: [],
        finalScore: 0
      }
    },
    resumeFileURL: fileInfo.downloadURL || "",
    resumeScore: {
      skillMatch: [],
      finalScore: 0,
      feedback: ""
    },
    resumeText: fileInfo.extractedText || "",
    reviewNotes: null,
    reviewStatus: "unreviewed",
    reviewedAt: null,
    reviewedBy: null,
    stageColor: "",
    stageName: "",

    // Rarely Present Fields (30 fields) - initialized for consistency
    aiReprocessReason: "",
    applicationSource: requestData.source || "",
    availableStartDate: parsedData.availableStartDate || "",
    candidateId: "",
    convertedAt: "",
    customFields: {},
    dateOfBirth: parsedData.dateOfBirth || "",
    expectedSalary: parsedData.expectedSalary || "",
    firstName: parsedData.firstName || "",
    gender: "",
    isActive: true,
    lastAIReprocess: null,
    lastName: parsedData.lastName || "",
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
    nationality: parsedData.nationality || "",
    parsedResumeData: {},
    privacyConsent: false,
    quickFixReason: "",
    referredBy: "",
    rejectionReason: "",
    reprocessedReason: "",
    resumeUrl: "",
    reviewedById: "",
    sourceDetails: `Parsed via unified resume parser from ${requestData.source}`,
    submittedAt: now
  };
}

/**
 * Extract text from various file formats
 */
async function extractTextFromFile(buffer, originalName, mimetype) {
  try {
    let extractedText = '';
    
    if (mimetype === 'application/pdf') {
      const data = await pdf(buffer);
      extractedText = data.text;
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: buffer });
      extractedText = result.value;
    } else if (mimetype === 'text/plain') {
      extractedText = buffer.toString('utf-8');
    } else {
      throw new Error(`Unsupported file type: ${mimetype}`);
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text could be extracted from the file');
    }

    return extractedText;
  } catch (error) {
    logger.error('Error extracting text from file:', {
      originalName,
      mimetype,
      error: error.message
    });
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

/**
 * Validate and clean parsed resume data
 */
function validateParsedData(parsedData, filename) {
  // Basic validation
  if (!parsedData || typeof parsedData !== 'object') {
    throw new Error('Invalid parsed data structure');
  }

  // Ensure we have at minimum a name or email
  if (!parsedData.name && !parsedData.email) {
    throw new Error('Resume must contain at least a name or email address');
  }

  // Clean and validate data
  const cleaned = {
    name: parsedData.name?.trim() || '',
    email: parsedData.email?.trim()?.toLowerCase() || '',
    phone: parsedData.phone?.trim() || '',
    summary: parsedData.summary?.trim() || '',
    skills: Array.isArray(parsedData.skills) ? parsedData.skills.filter(skill => 
      skill && typeof skill === 'string' && skill.trim().length > 0
    ) : [],
    experience: Array.isArray(parsedData.experience) ? parsedData.experience : [],
    education: Array.isArray(parsedData.education) ? parsedData.education : [],
    certifications: Array.isArray(parsedData.certifications) ? parsedData.certifications : [],
    languages: Array.isArray(parsedData.languages) ? parsedData.languages : [],
    location: parsedData.location || {},
    jobTitle: parsedData.jobTitle?.trim() || '',
    linkedIn: parsedData.linkedIn?.trim() || null,
    portfolioURL: parsedData.portfolioURL?.trim() || null
  };

  logger.info('Resume data validated and cleaned', {
    filename,
    hasName: !!cleaned.name,
    hasEmail: !!cleaned.email,
    skillsCount: cleaned.skills.length,
    experienceCount: cleaned.experience.length,
    educationCount: cleaned.education.length
  });

  return cleaned;
}

/**
 * Check for duplicate applications based on email
 */
async function checkForDuplicate(email) {
  if (!email) return null;

  try {
    const snapshot = await db.collection('applications')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const existingApp = snapshot.docs[0];
      return {
        id: existingApp.id,
        ...existingApp.data()
      };
    }

    return null;
  } catch (error) {
    logger.error('Error checking for duplicate application:', error);
    // Don't fail the entire process for duplicate check errors
    return null;
  }
}

/**
 * POST /api/resume-parser/parse
 * Unified resume parsing endpoint
 * Accepts file upload and processes it through AI parsing
 * Stores normalized data in Firestore applications collection
 */
router.post('/parse', upload.single('resume'), validate(parseResumeSchema), async (req, res) => {
  const startTime = Date.now();
  let tempFilePath = null;
  
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No resume file uploaded'
      });
    }

    // Validate file
    const fileValidation = validateFile(req.file);
    if (!fileValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: fileValidation.error
      });
    }

    const requestData = req.body || {};
    
    logger.info('Resume parsing request started', {
      originalName: req.file.originalname,
      fileSize: req.file.size,
      mimetype: req.file.mimetype,
      source: requestData.source,
      appliedPosition: requestData.appliedPosition
    });

    // Step 1: Extract text from file
    const extractedText = await extractTextFromFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    logger.info('Text extracted successfully', {
      textLength: extractedText.length,
      filename: req.file.originalname
    });

    // Step 2: Upload file to Firebase Storage
    let downloadURL = '';
    try {
      const uploadResult = await uploadFileToStorage(
        req.file.buffer,
        req.file.originalname,
        'resumes/'
      );
      downloadURL = uploadResult.downloadURL;
      
      logger.info('File uploaded to Firebase Storage', {
        filename: req.file.originalname,
        downloadURL: downloadURL.substring(0, 100) + '...'
      });
    } catch (uploadError) {
      logger.error('File upload failed', { error: uploadError.message });
      // Continue without file URL - parsing can still proceed
    }

    // Step 3: Parse resume using STRICT AI (no fallbacks)
    logger.info('Starting strict AI parsing - no fallbacks allowed', {
      filename: req.file.originalname,
      textLength: extractedText.length
    });

    const parsedData = await enhancedAI.parseResume(extractedText, req.file.originalname);
    
    // STRICT VALIDATION - Fail immediately if quality is insufficient
    if (!parsedData || !parsedData.name || !Array.isArray(parsedData.skills) || parsedData.skills.length < 3) {
      throw new Error(`PARSING QUALITY INSUFFICIENT: Critical data missing (name: ${!!parsedData?.name}, skills: ${parsedData?.skills?.length || 0})`);
    }
    
    logger.info('HIGH-QUALITY AI parsing completed successfully', {
      filename: req.file.originalname,
      parsedName: parsedData.name,
      parsedEmail: parsedData.email,
      skillsCount: parsedData.skills.length,
      hasExperience: !!parsedData.experience,
      extractedFields: Object.keys(parsedData).length
    });

    // Step 4: Validate and clean parsed data
    const cleanedData = validateParsedData(parsedData, req.file.originalname);

    // Step 5: Check for duplicate applications
    if (cleanedData.email) {
      const duplicate = await checkForDuplicate(cleanedData.email);
      if (duplicate) {
        logger.info('Duplicate application found', {
          email: cleanedData.email,
          existingId: duplicate.id
        });
        
        return res.status(409).json({
          success: false,
          error: 'Application already exists for this email address',
          duplicateId: duplicate.id,
          existingApplication: {
            id: duplicate.id,
            name: duplicate.name,
            email: duplicate.email,
            createdAt: duplicate.createdAt,
            status: duplicate.status
          }
        });
      }
    }

    // Step 6: Create Firestore document reference and get auto-generated ID
    const docRef = db.collection('applications').doc();
    const applicationId = docRef.id;

    // Step 7: Create normalized application data
    const fileInfo = {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      downloadURL,
      extractedText
    };

    const applicationData = createNormalizedApplication(cleanedData, fileInfo, requestData, applicationId);

    // Step 8: Store in Firestore
    await docRef.set(applicationData);

    const processingTime = Date.now() - startTime;

    logger.info('Resume parsing completed successfully', {
      applicationId: applicationData.id,
      filename: req.file.originalname,
      email: cleanedData.email,
      processingTime: `${processingTime}ms`
    });

    // Step 9: Return success response
    res.status(201).json({
      success: true,
      message: 'Resume parsed and application created successfully',
      data: {
        applicationId: applicationData.id,
        parsedData: {
          name: cleanedData.name,
          email: cleanedData.email,
          phone: cleanedData.phone,
          skills: cleanedData.skills,
          summary: cleanedData.summary,
          jobTitle: cleanedData.jobTitle,
          location: cleanedData.location
        },
        fileInfo: {
          originalName: req.file.originalname,
          fileSize: req.file.size,
          fileType: req.file.mimetype,
          downloadURL
        },
        processingStats: {
          processingTime: `${processingTime}ms`,
          textExtracted: extractedText.length,
          skillsFound: cleanedData.skills.length,
          source: requestData.source
        }
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Resume parsing failed', {
      filename: req.file?.originalname,
      error: error.message,
      stack: error.stack,
      processingTime: `${processingTime}ms`
    });

    // Clean up temp file if it exists
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        logger.error('Failed to clean up temp file', { 
          tempFilePath, 
          error: cleanupError.message 
        });
      }
    }

    res.status(500).json({
      success: false,
      error: 'Resume parsing failed',
      details: error.message,
      processingTime: `${processingTime}ms`
    });
  }
});

/**
 * GET /api/resume-parser/status/:id
 * Get parsing status and application details
 */
router.get('/status/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection('applications').doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    const data = doc.data();
    
    res.json({
      success: true,
      data: {
        id: doc.id,
        status: data.status,
        name: data.name,
        email: data.email,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        processingStatus: {
          parsed: true,
          scored: data.resumeScore?.finalScore > 0,
          reviewed: data.reviewStatus !== 'unreviewed'
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching application status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch application status'
    });
  }
});

/**
 * GET /api/resume-parser/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Resume Parser API',
    version: '2.0.0',
    status: 'healthy',
    features: {
      aiParsing: true,
      fileUpload: true,
      duplicateDetection: true,
      normalizedSchema: true,
      supportedFormats: ['PDF', 'DOCX', 'TXT']
    }
  });
});

module.exports = router;