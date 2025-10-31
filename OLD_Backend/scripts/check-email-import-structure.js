// scripts/check-email-import-structure.js
// Check if email import system follows the same normalized structure as Applications collection

require('dotenv').config();
const { db } = require('../services/firebaseService');

// Import normalized schema from the normalization script
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

function createNormalizedApplication(applicationData) {
  const normalizedApp = { ...NORMALIZED_SCHEMA };

  // Merge with existing data, preserving important values
  Object.keys(applicationData).forEach(key => {
    if (normalizedApp.hasOwnProperty(key)) {
      normalizedApp[key] = applicationData[key];
    }
  });

  // Set required fields
  normalizedApp.id = applicationData.id || "";
  normalizedApp.createdAt = applicationData.createdAt || new Date().toISOString();
  normalizedApp.updatedAt = new Date().toISOString();

  return normalizedApp;
}

async function checkEmailImportStructure() {
  try {
    console.log('🔍 CHECKING EMAIL IMPORT DATA STRUCTURE COMPLIANCE');
    console.log('='.repeat(70));
    
    // First, let's examine what the email import functions are currently creating
    console.log('📋 Current email import structure analysis:');
    console.log('1. addApplicationFromEmail() function in firebaseService.js');
    console.log('2. parseCandidateFromEmail() function in emailService.js');
    console.log('3. Resume processor functions in resumeProcessor.js');
    
    // Get sample applications created via email import
    console.log('\n🔎 Analyzing email-imported applications...');
    
    const snapshot = await db.collection('applications')
      .where('source', '==', 'email')
      .limit(10)
      .get();
    
    if (snapshot.empty) {
      console.log('⚠️  No email-imported applications found in the database');
      console.log('   This might mean:');
      console.log('   - No emails have been processed yet');
      console.log('   - Applications are being stored with different source value');
      console.log('   - Email import is disabled or not configured');
      
      // Let's check for any applications at all
      const allAppsSnapshot = await db.collection('applications').limit(5).get();
      if (!allAppsSnapshot.empty) {
        console.log('\n📊 Sample of existing applications:');
        allAppsSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`   ID: ${doc.id}`);
          console.log(`   Source: ${data.source || 'undefined'}`);
          console.log(`   Created: ${data.createdAt || 'undefined'}`);
          console.log(`   Fields count: ${Object.keys(data).length}`);
          console.log('   ---');
        });
      }
      return;
    }

    console.log(`📊 Found ${snapshot.size} email-imported applications`);
    
    const normalizedFieldsCount = Object.keys(NORMALIZED_SCHEMA).length;
    console.log(`🎯 Target normalized structure: ${normalizedFieldsCount} fields`);
    
    let complianceResults = {
      fullyCompliant: 0,
      partiallyCompliant: 0,
      nonCompliant: 0,
      fieldAnalysis: {},
      missingFields: new Set(),
      extraFields: new Set(),
      structureMismatches: []
    };

    console.log('\n📈 Analyzing each application:');
    console.log('ID'.padEnd(25) + 'Fields'.padEnd(8) + 'Compliance'.padEnd(15) + 'Created');
    console.log('-'.repeat(70));

    snapshot.forEach((doc) => {
      const data = doc.data();
      const docId = doc.id;
      const fieldCount = Object.keys(data).length;
      
      // Check compliance
      let compliance = 'Non-compliant';
      let complianceScore = 0;
      
      if (fieldCount === normalizedFieldsCount) {
        // Check if all fields match
        const dataFields = new Set(Object.keys(data));
        const normalizedFields = new Set(Object.keys(NORMALIZED_SCHEMA));
        const hasAllNormalizedFields = [...normalizedFields].every(field => dataFields.has(field));
        const hasOnlyNormalizedFields = [...dataFields].every(field => normalizedFields.has(field));
        
        if (hasAllNormalizedFields && hasOnlyNormalizedFields) {
          compliance = 'Fully compliant';
          complianceResults.fullyCompliant++;
          complianceScore = 100;
        } else {
          compliance = 'Partial match';
          complianceResults.partiallyCompliant++;
          complianceScore = 75;
        }
      } else if (fieldCount > normalizedFieldsCount * 0.8) {
        compliance = 'Mostly compliant';
        complianceResults.partiallyCompliant++;
        complianceScore = Math.round((fieldCount / normalizedFieldsCount) * 100);
      } else {
        complianceResults.nonCompliant++;
        complianceScore = Math.round((fieldCount / normalizedFieldsCount) * 100);
      }

      // Track missing and extra fields
      const dataFields = Object.keys(data);
      const normalizedFields = Object.keys(NORMALIZED_SCHEMA);
      
      normalizedFields.forEach(field => {
        if (!dataFields.includes(field)) {
          complianceResults.missingFields.add(field);
        }
      });
      
      dataFields.forEach(field => {
        if (!normalizedFields.includes(field)) {
          complianceResults.extraFields.add(field);
        }
      });

      console.log(
        docId.substring(0, 24).padEnd(25) +
        fieldCount.toString().padEnd(8) +
        `${compliance} (${complianceScore}%)`.padEnd(25) +
        (data.createdAt || 'Unknown')
      );
    });

    // Summary report
    console.log('\n📊 EMAIL IMPORT COMPLIANCE SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Fully compliant: ${complianceResults.fullyCompliant}`);
    console.log(`🟡 Partially compliant: ${complianceResults.partiallyCompliant}`);
    console.log(`❌ Non-compliant: ${complianceResults.nonCompliant}`);
    
    const totalApps = snapshot.size;
    const complianceRate = ((complianceResults.fullyCompliant / totalApps) * 100).toFixed(1);
    console.log(`📈 Overall compliance rate: ${complianceRate}%`);

    // Missing fields analysis
    if (complianceResults.missingFields.size > 0) {
      console.log('\n⚠️  COMMONLY MISSING FIELDS:');
      const missingArray = Array.from(complianceResults.missingFields);
      missingArray.sort().forEach((field, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${field}`);
      });
      console.log(`\nTotal missing fields: ${missingArray.length}`);
    }

    // Extra fields analysis
    if (complianceResults.extraFields.size > 0) {
      console.log('\n➕ EXTRA FIELDS (not in normalized schema):');
      const extraArray = Array.from(complianceResults.extraFields);
      extraArray.sort().forEach((field, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${field}`);
      });
      console.log(`\nTotal extra fields: ${extraArray.length}`);
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (complianceResults.fullyCompliant === totalApps) {
      console.log('✅ All email imports are fully compliant! No action needed.');
    } else {
      console.log('🔧 Email import system needs updates to ensure compliance:');
      console.log('');
      console.log('1. Update addApplicationFromEmail() in firebaseService.js:');
      console.log('   - Use the createNormalizedApplication() function');
      console.log('   - Ensure all 108 fields are populated with defaults');
      console.log('');
      console.log('2. Update parseCandidateFromEmail() in emailService.js:');
      console.log('   - Map email data to normalized field structure');
      console.log('   - Set appropriate default values for missing fields');
      console.log('');
      console.log('3. Update resume processor functions:');
      console.log('   - Ensure AI parsing results map to normalized schema');
      console.log('   - Handle all field types properly (arrays, objects, primitives)');
      console.log('');
      console.log('4. Consider running normalization on existing email imports:');
      console.log('   - Use the normalize-applications-structure.js script');
      console.log('   - Filter for source: "email_import" applications');
    }

    return complianceResults;

  } catch (error) {
    console.error('❌ Error checking email import structure:', error);
    throw error;
  }
}

// Create a function that can be used to fix email import compliance
function generateEmailImportFixes() {
  console.log('\n🔧 GENERATING EMAIL IMPORT COMPLIANCE FIXES');
  console.log('='.repeat(50));
  
  console.log(`
// Add this function to firebaseService.js:
function createNormalizedApplicationFromEmail(emailData) {
  const normalizedApp = ${JSON.stringify(NORMALIZED_SCHEMA, null, 2)};
  
  // Map email-specific data to normalized fields
  if (emailData.name) normalizedApp.name = emailData.name;
  if (emailData.email) normalizedApp.email = emailData.email.toLowerCase().trim();
  if (emailData.phone) normalizedApp.phone = emailData.phone;
  if (emailData.skills) normalizedApp.skills = Array.isArray(emailData.skills) ? emailData.skills : [];
  if (emailData.experience) normalizedApp.experience = Array.isArray(emailData.experience) ? emailData.experience : [emailData.experience];
  if (emailData.education) normalizedApp.education = Array.isArray(emailData.education) ? emailData.education : [emailData.education];
  
  // Set email import specific fields
  normalizedApp.source = "email_import";
  normalizedApp.importMethod = emailData.importMethod || "automated_parser";
  normalizedApp.status = "pending_review";
  normalizedApp.reviewStatus = "unreviewed";
  normalizedApp.stage = "new";
  
  // Set timestamps
  const now = new Date().toISOString();
  normalizedApp.createdAt = now;
  normalizedApp.updatedAt = now;
  normalizedApp.importDate = now;
  
  // Set history
  normalizedApp.history = [{
    date: now,
    note: emailData.notes || "Imported automatically from email"
  }];
  
  return normalizedApp;
}
  `);
}

// Run the analysis
if (require.main === module) {
  checkEmailImportStructure()
    .then((results) => {
      if (results && (results.partiallyCompliant > 0 || results.nonCompliant > 0)) {
        generateEmailImportFixes();
      }
      console.log('\n✅ Analysis complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = {
  checkEmailImportStructure,
  createNormalizedApplication,
  NORMALIZED_SCHEMA
};