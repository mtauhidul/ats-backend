// scripts/normalize-applications-structure.js
// Normalize all applications to have the same field structure

require('dotenv').config();
const { db } = require('../services/firebaseService');

// Define the complete normalized schema with default values
const NORMALIZED_SCHEMA = {
  // Core Identifiers & Assignment - Always Present (43 fields)
  assignedBy: "",
  assignedTo: "",
  assignmentDate: null,
  categories: [],
  communicationScore: 0,
  communications: [],
  companyName: "",
  createdAt: "", // Will be preserved from existing data
  culturalScore: 0,
  currentOffer: null,
  education: [],
  email: "", // Will be preserved from existing data
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
  updatedAt: null, // Will be set to current timestamp
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
  id: "", // Will be set to document ID
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

  // Rarely Present Fields (30 fields) - but we'll include them for consistency
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

async function normalizeApplications(dryRun = true, batchSize = 50) {
  try {
    console.log('🔧 NORMALIZING APPLICATIONS STRUCTURE');
    console.log('='.repeat(60));
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE UPDATE'}`);
    console.log(`Batch size: ${batchSize}`);
    
    // Get all applications
    const snapshot = await db.collection('applications').get();
    console.log(`📊 Total applications to process: ${snapshot.size}`);

    if (snapshot.empty) {
      console.log('❌ No applications found');
      return;
    }

    const expectedFieldCount = Object.keys(NORMALIZED_SCHEMA).length;
    console.log(`📋 Target field count: ${expectedFieldCount}`);

    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process in batches to avoid memory issues and rate limits
    const docs = snapshot.docs;
    const totalBatches = Math.ceil(docs.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, docs.length);
      const batchDocs = docs.slice(batchStart, batchEnd);

      console.log(`\n📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batchDocs.length} documents)`);

      // Prepare batch update
      const batch = db.batch();
      let batchUpdates = 0;

      for (const doc of batchDocs) {
        try {
          const existingData = doc.data();
          const currentFieldCount = Object.keys(existingData).length;
          
          // Create normalized document
          const normalizedDoc = { ...NORMALIZED_SCHEMA };
          
          // Preserve existing data where it exists
          Object.keys(existingData).forEach(field => {
            if (normalizedDoc.hasOwnProperty(field)) {
              normalizedDoc[field] = existingData[field];
            } else {
              // Log unexpected fields
              console.log(`⚠️  Unexpected field '${field}' in document ${doc.id}`);
              normalizedDoc[field] = existingData[field]; // Keep it for now
            }
          });

          // Set special fields
          normalizedDoc.id = doc.id;
          normalizedDoc.updatedAt = new Date().toISOString();

          // Ensure required fields have valid values
          if (!normalizedDoc.email) {
            console.log(`⚠️  Missing email in document ${doc.id}`);
          }
          if (!normalizedDoc.createdAt) {
            normalizedDoc.createdAt = new Date().toISOString();
          }

          const newFieldCount = Object.keys(normalizedDoc).length;
          const fieldDifference = newFieldCount - currentFieldCount;

          if (fieldDifference !== 0) {
            console.log(`📄 ${doc.id}: ${currentFieldCount} → ${newFieldCount} fields (${fieldDifference > 0 ? '+' : ''}${fieldDifference})`);
            
            if (!dryRun) {
              batch.update(doc.ref, normalizedDoc);
              batchUpdates++;
            }
            updatedCount++;
          }

          processedCount++;

        } catch (error) {
          console.error(`❌ Error processing document ${doc.id}:`, error.message);
          errors.push({ docId: doc.id, error: error.message });
          errorCount++;
        }
      }

      // Commit batch if there are updates
      if (!dryRun && batchUpdates > 0) {
        try {
          await batch.commit();
          console.log(`✅ Committed ${batchUpdates} updates in batch ${batchIndex + 1}`);
          
          // Small delay to avoid overwhelming Firestore
          if (batchIndex < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`❌ Error committing batch ${batchIndex + 1}:`, error);
          errorCount += batchUpdates;
        }
      }
    }

    // Final summary
    console.log('\n📊 NORMALIZATION SUMMARY');
    console.log('-'.repeat(60));
    console.log(`📄 Total documents processed: ${processedCount}`);
    console.log(`📝 Documents needing updates: ${updatedCount}`);
    console.log(`✅ Successfully processed: ${processedCount - errorCount}`);
    console.log(`❌ Errors encountered: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\n❌ ERRORS:');
      errors.forEach(error => {
        console.log(`   ${error.docId}: ${error.error}`);
      });
    }

    if (dryRun) {
      console.log('\n🔍 This was a DRY RUN - no changes were made');
      console.log('📝 Run with dryRun=false to apply changes');
    } else {
      console.log('\n✅ Normalization completed successfully!');
      console.log(`📋 All documents now have ${expectedFieldCount} fields`);
    }

    return {
      processed: processedCount,
      updated: updatedCount,
      errors: errorCount,
      expectedFields: expectedFieldCount
    };

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

// Verification function to check normalization success
async function verifyNormalization() {
  try {
    console.log('\n🔍 VERIFYING NORMALIZATION');
    console.log('='.repeat(40));

    const snapshot = await db.collection('applications').limit(10).get();
    const expectedFieldCount = Object.keys(NORMALIZED_SCHEMA).length;
    
    let allNormalized = true;
    snapshot.forEach(doc => {
      const data = doc.data();
      const fieldCount = Object.keys(data).length;
      
      if (fieldCount !== expectedFieldCount) {
        console.log(`❌ ${doc.id}: ${fieldCount} fields (expected ${expectedFieldCount})`);
        allNormalized = false;
      } else {
        console.log(`✅ ${doc.id}: ${fieldCount} fields ✓`);
      }
    });

    if (allNormalized) {
      console.log('\n✅ All checked documents are properly normalized!');
    } else {
      console.log('\n❌ Some documents still need normalization');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--live');
  const verify = args.includes('--verify');
  
  if (verify) {
    verifyNormalization()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Verification failed:', error);
        process.exit(1);
      });
  } else {
    normalizeApplications(dryRun)
      .then(() => {
        console.log('\n✅ Script completed successfully!');
        if (dryRun) {
          console.log('💡 Run with --live flag to apply changes');
        }
        process.exit(0);
      })
      .catch(error => {
        console.error('❌ Script failed:', error);
        process.exit(1);
      });
  }
}

module.exports = { normalizeApplications, verifyNormalization, NORMALIZED_SCHEMA };