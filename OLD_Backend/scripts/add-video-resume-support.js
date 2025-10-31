// scripts/add-video-resume-support.js
// Add video resume and video introduction support to the normalized schema

require('dotenv').config();
const { db } = require('../services/firebaseService');

// Extended normalized schema with video support
const ENHANCED_SCHEMA_WITH_VIDEO = {
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
  resumeFileName: "", // For document resumes (PDF/DOCX)
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

  // Frequently Present Fields (32 + 8 new video fields = 40 fields)
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
  fileSize: 0, // For document resumes
  fileType: "", // For document resumes
  hasResume: false, // For document resumes
  hasResumeAttachment: false,
  
  // NEW: Video Resume Support (8 new fields)
  hasVideoResume: false,
  videoResume: {
    fileName: "",
    fileURL: "",
    fileSize: 0,
    fileType: "",
    duration: 0, // in seconds
    thumbnailURL: "",
    uploadedAt: null,
    processedAt: null
  },
  videoIntroduction: {
    fileName: "",
    fileURL: "",
    fileSize: 0,
    fileType: "",
    duration: 0, // in seconds
    thumbnailURL: "",
    uploadedAt: null,
    processedAt: null
  },
  videoResumeFileName: "", // For backward compatibility
  videoResumeURL: "", // For backward compatibility
  videoResumeFileSize: 0, // For backward compatibility
  videoResumeFileType: "", // For backward compatibility
  hasVideoIntroduction: false,
  videoAttachments: [], // Array for multiple video files
  
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
  nameFixdBy: "",
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

function isVideoFile(filename) {
  if (!filename) return false;
  const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp', '.ogv'];
  return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

function categorizeVideoFile(filename) {
  if (!filename) return 'unknown';
  
  const name = filename.toLowerCase();
  
  // Check for video introduction keywords
  if (name.includes('intro') || name.includes('introduction') || name.includes('hello') || name.includes('greet')) {
    return 'introduction';
  }
  
  // Check for video resume keywords
  if (name.includes('resume') || name.includes('cv') || name.includes('profile')) {
    return 'resume';
  }
  
  // Check for recording platform keywords
  if (name.includes('loom') || name.includes('zoom') || name.includes('recording')) {
    return 'introduction'; // Most recordings are introductions
  }
  
  // Default to resume if unclear
  return 'resume';
}

async function migrateExistingVideoFiles(dryRun = true) {
  try {
    console.log('🎬 MIGRATING EXISTING VIDEO FILES TO ENHANCED SCHEMA');
    console.log('='.repeat(65));
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE UPDATE'}`);
    
    // Get applications with video files
    const snapshot = await db.collection('applications').get();
    
    let applicationsWithVideo = [];
    let migrationsNeeded = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const docId = doc.id;
      
      // Check if resumeFileName contains video file
      if (data.resumeFileName && isVideoFile(data.resumeFileName)) {
        applicationsWithVideo.push({
          id: docId,
          data: data,
          videoFileName: data.resumeFileName
        });
        
        const videoType = categorizeVideoFile(data.resumeFileName);
        const migration = {
          id: docId,
          name: data.name || data.candidateName || 'Unknown',
          currentFile: data.resumeFileName,
          videoType: videoType,
          changes: {}
        };
        
        // Determine what changes need to be made
        if (videoType === 'introduction') {
          migration.changes = {
            hasVideoIntroduction: true,
            hasVideoResume: false,
            videoIntroduction: {
              fileName: data.resumeFileName,
              fileURL: data.resumeFileURL || "",
              fileSize: data.fileSize || 0,
              fileType: getVideoMimeType(data.resumeFileName),
              duration: 0,
              thumbnailURL: "",
              uploadedAt: data.createdAt || null,
              processedAt: null
            },
            videoResumeFileName: data.resumeFileName, // For backward compatibility
            resumeFileName: "", // Clear this since it's not a document resume
            hasResume: false, // No document resume
            hasResumeAttachment: true // But has video attachment
          };
        } else {
          migration.changes = {
            hasVideoResume: true,
            hasVideoIntroduction: false,
            videoResume: {
              fileName: data.resumeFileName,
              fileURL: data.resumeFileURL || "",
              fileSize: data.fileSize || 0,
              fileType: getVideoMimeType(data.resumeFileName),
              duration: 0,
              thumbnailURL: "",
              uploadedAt: data.createdAt || null,
              processedAt: null
            },
            videoResumeFileName: data.resumeFileName, // For backward compatibility
            videoResumeURL: data.resumeFileURL || "",
            videoResumeFileSize: data.fileSize || 0,
            videoResumeFileType: getVideoMimeType(data.resumeFileName),
            resumeFileName: "", // Clear this since it's not a document resume
            hasResume: false, // No document resume
            hasResumeAttachment: true // But has video attachment
          };
        }
        
        migrationsNeeded.push(migration);
      }
    });
    
    console.log(`📊 Found ${applicationsWithVideo.length} applications with video files`);
    console.log(`🔄 Migrations needed: ${migrationsNeeded.length}`);
    
    if (migrationsNeeded.length > 0) {
      console.log('\n📋 MIGRATION PLAN:');
      console.log('-'.repeat(50));
      
      migrationsNeeded.forEach((migration, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${migration.name}`);
        console.log(`    📄 ID: ${migration.id}`);
        console.log(`    📂 Current: ${migration.currentFile}`);
        console.log(`    🎬 Type: ${migration.videoType}`);
        console.log(`    🔧 Changes: ${Object.keys(migration.changes).length} fields to update`);
        console.log('');
      });
      
      if (!dryRun) {
        console.log('🔄 Applying migrations...');
        
        const batch = db.batch();
        let batchCount = 0;
        
        for (const migration of migrationsNeeded) {
          const docRef = db.collection('applications').doc(migration.id);
          
          // Merge the enhanced schema with existing data and new changes
          const enhancedData = { ...ENHANCED_SCHEMA_WITH_VIDEO };
          const existingApp = applicationsWithVideo.find(app => app.id === migration.id);
          
          // Preserve existing data
          Object.keys(existingApp.data).forEach(key => {
            if (enhancedData.hasOwnProperty(key)) {
              enhancedData[key] = existingApp.data[key];
            }
          });
          
          // Apply migration changes
          Object.keys(migration.changes).forEach(key => {
            enhancedData[key] = migration.changes[key];
          });
          
          // Set metadata
          enhancedData.updatedAt = new Date().toISOString();
          enhancedData.id = migration.id;
          
          batch.update(docRef, enhancedData);
          batchCount++;
          
          // Commit batch every 500 operations
          if (batchCount >= 500) {
            await batch.commit();
            console.log(`✅ Committed batch of ${batchCount} updates`);
            batchCount = 0;
          }
        }
        
        // Commit remaining operations
        if (batchCount > 0) {
          await batch.commit();
          console.log(`✅ Committed final batch of ${batchCount} updates`);
        }
        
        console.log('🎉 Migration completed successfully!');
      } else {
        console.log('💡 Run with dryRun=false to apply these migrations');
      }
    } else {
      console.log('✅ No video files found that need migration');
    }
    
    // Generate enhanced file upload config
    console.log('\n🔧 ENHANCED FILE UPLOAD CONFIGURATION NEEDED');
    console.log('-'.repeat(50));
    console.log('Update fileUploadService.js to support video files:');
    console.log('');
    console.log('Add to ALLOWED_FILE_TYPES:');
    console.log(`
  'video/mp4': {
    extensions: ['.mp4'],
    mimeTypes: ['video/mp4'],
    magicBytes: [
      [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // MP4
      [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], // MP4
    ]
  },
  'video/quicktime': {
    extensions: ['.mov'],
    mimeTypes: ['video/quicktime'],
    magicBytes: [
      [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70], // MOV
    ]
  },
  'video/webm': {
    extensions: ['.webm'],
    mimeTypes: ['video/webm'],
    magicBytes: [
      [0x1A, 0x45, 0xDF, 0xA3], // WebM
    ]
  }`);
    
    return {
      applicationsWithVideo: applicationsWithVideo.length,
      migrationsNeeded: migrationsNeeded.length,
      migrations: migrationsNeeded,
      enhancedSchema: ENHANCED_SCHEMA_WITH_VIDEO
    };
    
  } catch (error) {
    console.error('❌ Error during video file migration:', error);
    throw error;
  }
}

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

// Generate updated email import function with video support
function generateEnhancedEmailImportFunction() {
  console.log('\n📧 ENHANCED EMAIL IMPORT FUNCTION WITH VIDEO SUPPORT');
  console.log('-'.repeat(55));
  
  console.log(`
// Enhanced createNormalizedApplicationFromEmail with video support
function createNormalizedApplicationFromEmailWithVideo(emailData) {
  const normalizedApp = JSON.parse(JSON.stringify(ENHANCED_SCHEMA_WITH_VIDEO));

  // ... existing field mapping logic ...

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
        uploadedAt: new Date().toISOString(),
        processedAt: null
      };
      normalizedApp.hasResume = false; // Not a document resume
    } else {
      normalizedApp.hasVideoResume = true;
      normalizedApp.videoResume = {
        fileName: emailData.originalFilename,
        fileURL: emailData.resumeFileURL || "",
        fileSize: emailData.fileSize || 0,
        fileType: getVideoMimeType(emailData.originalFilename),
        duration: 0,
        thumbnailURL: "",
        uploadedAt: new Date().toISOString(),
        processedAt: null
      };
      
      // Backward compatibility fields
      normalizedApp.videoResumeFileName = emailData.originalFilename;
      normalizedApp.videoResumeURL = emailData.resumeFileURL || "";
      normalizedApp.videoResumeFileSize = emailData.fileSize || 0;
      normalizedApp.videoResumeFileType = getVideoMimeType(emailData.originalFilename);
      normalizedApp.hasResume = false; // Not a document resume
    }
    
    normalizedApp.hasResumeAttachment = true;
    normalizedApp.resumeFileName = ""; // Clear document resume field
  }

  return normalizedApp;
}
  `);
}

if (require.main === module) {
  migrateExistingVideoFiles(false) // Run live migration
    .then((results) => {
      console.log(`\n📊 SUMMARY: Found ${results.applicationsWithVideo} applications with video files`);
      console.log(`🔄 ${results.migrationsNeeded} migrations ready to apply`);
      
      generateEnhancedEmailImportFunction();
      
      if (results.migrationsNeeded > 0) {
        console.log('\n🚀 NEXT STEPS:');
        console.log('1. Review the migration plan above');
        console.log('2. Update the normalized schema to include video fields');
        console.log('3. Run migration with dryRun=false when ready');
        console.log('4. Update email import functions with video support');
        console.log('5. Update file upload service to support video formats');
      }
      
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { 
  migrateExistingVideoFiles, 
  ENHANCED_SCHEMA_WITH_VIDEO,
  isVideoFile,
  categorizeVideoFile 
};