// scripts/fix-email-import-normalization.js
// Update email import system to follow normalized 108-field structure

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

// Import the normalized schema from our normalization script
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

  // Frequently Present Fields (32 fields)
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

function createNormalizedApplicationFromEmail(emailData) {
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

  return normalizedApp;
}

async function generateUpdatedEmailImportFunctions() {
  console.log('🔧 GENERATING UPDATED EMAIL IMPORT FUNCTIONS');
  console.log('='.repeat(60));

  // Generate the updated firebaseService.js function
  const updatedFirebaseFunction = `
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
          \`Application with email \${applicationData.email} already exists, skipping\`
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
      \`Added normalized application from email: \${applicationData.name} (\${applicationData.email})\`
    );
    return { id: applicationRef.id, created: true };
  } catch (error) {
    logger.error("Error adding application from email import:", error);
    throw new Error(\`Failed to add application: \${error.message}\`);
  }
};

/**
 * Create normalized application from email data (NEW function for email import compliance)
 * @param {Object} emailData - Raw email data
 * @returns {Object} Normalized application with all 108 fields
 */
function createNormalizedApplicationFromEmail(emailData) {
  // Complete normalized schema with all 108 fields
  const NORMALIZED_SCHEMA = ${JSON.stringify(NORMALIZED_SCHEMA, null, 2)};

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

  return normalizedApp;
}`;

  // Save the updated functions to a file for reference
  await fs.writeFile(
    path.join(__dirname, 'updated-email-import-functions.js'),
    updatedFirebaseFunction
  );

  console.log('📝 Updated functions saved to: updated-email-import-functions.js');
  
  console.log('\n📋 IMPLEMENTATION STEPS:');
  console.log('='.repeat(40));
  console.log('1. ✅ Generated normalized email import functions');
  console.log('2. 📝 Update services/firebaseService.js:');
  console.log('   - Replace addApplicationFromEmail() function');
  console.log('   - Add createNormalizedApplicationFromEmail() function');
  console.log('3. 🧪 Test the updated functions');
  console.log('4. ✅ Verify new email imports have 108 fields');
  
  console.log('\n💡 KEY CHANGES:');
  console.log('• Email imports will now create ALL 108 normalized fields');
  console.log('• Default values provided for missing fields');
  console.log('• Proper field mapping for email-specific data');
  console.log('• Maintains backward compatibility with existing code');
  console.log('• Ensures consistency with normalized application structure');

  return {
    updatedFunction: updatedFirebaseFunction,
    filePath: path.join(__dirname, 'updated-email-import-functions.js')
  };
}

// Run the script
if (require.main === module) {
  generateUpdatedEmailImportFunctions()
    .then((result) => {
      console.log('\n✅ Email import normalization fix generated successfully');
      console.log(`📁 Check file: ${result.filePath}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed to generate fix:', error);
      process.exit(1);
    });
}

module.exports = {
  createNormalizedApplicationFromEmail,
  generateUpdatedEmailImportFunctions,
  NORMALIZED_SCHEMA
};