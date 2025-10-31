// scripts/test-email-import-structure.js
// Test what structure the current email import system creates

require('dotenv').config();
const { parseCandidateFromEmail } = require('../services/emailService');
const { addApplicationFromEmail } = require('../services/firebaseService');

// Create a mock email object to simulate what comes from the email parser
const mockEmail = {
  from: {
    value: [{
      name: "John Doe",
      address: "john.doe@example.com"
    }]
  },
  subject: "Application for Software Engineer Position - JOB-123-DEV",
  text: "Dear Hiring Manager, I am applying for the Software Engineer position...",
  attachments: [{
    filename: "john_doe_resume.pdf",
    contentType: "application/pdf",
    size: 150000
  }]
};

// Simulate what the resume processor might add
const mockResumeData = {
  skills: ["JavaScript", "React", "Node.js", "Python"],
  experience: ["3 years at Tech Corp", "2 years at StartupXYZ"],
  education: ["BS Computer Science - MIT"],
  phone: "+1-555-0123",
  resumeText: "John Doe\nSoftware Engineer\n\nExperience:\n- Tech Corp (3 years)\n- StartupXYZ (2 years)\n\nSkills: JavaScript, React, Node.js, Python"
};

function testEmailImportStructure() {
  console.log('🔬 TESTING EMAIL IMPORT STRUCTURE CREATION');
  console.log('='.repeat(60));
  
  // Step 1: Test parseCandidateFromEmail
  console.log('📋 Step 1: Testing parseCandidateFromEmail()');
  const basicApplicationData = parseCandidateFromEmail(mockEmail);
  
  console.log('📊 Basic application data structure:');
  console.log(`   Fields count: ${Object.keys(basicApplicationData).length}`);
  console.log('   Fields created:');
  Object.keys(basicApplicationData).forEach((key, index) => {
    console.log(`   ${(index + 1).toString().padStart(2)}. ${key}: ${typeof basicApplicationData[key]}`);
  });
  
  // Step 2: Test with resume data merged
  console.log('\n📋 Step 2: Testing with resume data merged');
  const enhancedApplicationData = {
    ...basicApplicationData,
    ...mockResumeData,
    // These would typically be added by the resume processor
    hasResume: true,
    hasResumeAttachment: true,
    originalFilename: mockEmail.attachments[0].filename,
    fileSize: mockEmail.attachments[0].size,
    fileType: mockEmail.attachments[0].contentType
  };
  
  console.log('📊 Enhanced application data structure:');
  console.log(`   Fields count: ${Object.keys(enhancedApplicationData).length}`);
  console.log('   Additional fields from resume processing:');
  const additionalFields = Object.keys(enhancedApplicationData).filter(
    key => !Object.keys(basicApplicationData).includes(key)
  );
  additionalFields.forEach((field, index) => {
    console.log(`   ${(index + 1).toString().padStart(2)}. ${field}: ${typeof enhancedApplicationData[field]}`);
  });

  // Step 3: Compare with normalized schema
  console.log('\n📋 Step 3: Comparing with normalized 108-field schema');
  
  // Import normalized schema (simplified version for testing)
  const NORMALIZED_FIELDS = [
    'assignedBy', 'assignedTo', 'assignmentDate', 'categories', 'communicationScore', 
    'communications', 'companyName', 'createdAt', 'culturalScore', 'currentOffer', 
    'education', 'email', 'emailVerified', 'experience', 'feedback', 'internalNotes', 
    'interviewHistory', 'interviewScore', 'interviews', 'isArchived', 'isFlagged', 
    'jobId', 'jobTitle', 'lastCommunication', 'location', 'notes', 'offers', 
    'overallScore', 'phone', 'phoneVerified', 'rating', 'resumeFileName', 'scores', 
    'skills', 'source', 'stage', 'stageId', 'status', 'tags', 'technicalScore', 
    'updatedAt', 'workflowHistory', 'workflowStage', 'aiInsights', 'aiScore', 
    'appliedPosition', 'assignedAt', 'candidateName', 'category', 'certifications', 
    'emailReceivedAt', 'fileSize', 'fileType', 'hasResume', 'hasResumeAttachment', 
    'history', 'id', 'importDate', 'importMethod', 'languages', 'lastReprocessed', 
    'linkedIn', 'name', 'originalFilename', 'parsedResume', 'portfolioURL', 
    'reprocessedWith', 'resetInfo', 'resume', 'resumeFileURL', 'resumeScore', 
    'resumeText', 'reviewNotes', 'reviewStatus', 'reviewedAt', 'reviewedBy', 
    'stageColor', 'stageName', 'aiReprocessReason', 'applicationSource', 
    'availableStartDate', 'candidateId', 'convertedAt', 'customFields', 'dateOfBirth', 
    'expectedSalary', 'firstName', 'gender', 'isActive', 'lastAIReprocess', 'lastName', 
    'lastNameFix', 'lastQuickFix', 'marketingConsent', 'migrationInfo', 'nameFixReason', 
    'nameFixedBy', 'nationality', 'parsedResumeData', 'privacyConsent', 'quickFixReason', 
    'referredBy', 'rejectionReason', 'reprocessedReason', 'resumeUrl', 'reviewedById', 
    'sourceDetails', 'submittedAt'
  ];
  
  const currentFields = new Set(Object.keys(enhancedApplicationData));
  const normalizedFields = new Set(NORMALIZED_FIELDS);
  
  const missingFields = [...normalizedFields].filter(field => !currentFields.has(field));
  const extraFields = [...currentFields].filter(field => !normalizedFields.has(field));
  
  console.log(`📈 Compliance Analysis:`);
  console.log(`   Current structure: ${currentFields.size} fields`);
  console.log(`   Normalized structure: ${normalizedFields.size} fields`);
  console.log(`   Missing fields: ${missingFields.length}`);
  console.log(`   Extra fields: ${extraFields.length}`);
  console.log(`   Compliance: ${((currentFields.size - missingFields.length) / normalizedFields.size * 100).toFixed(1)}%`);
  
  if (missingFields.length > 0) {
    console.log('\n❌ Missing fields (first 20):');
    missingFields.slice(0, 20).forEach((field, index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${field}`);
    });
    if (missingFields.length > 20) {
      console.log(`   ... and ${missingFields.length - 20} more`);
    }
  }
  
  if (extraFields.length > 0) {
    console.log('\n➕ Extra fields:');
    extraFields.forEach((field, index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${field}`);
    });
  }
  
  // Step 4: Show what needs to be fixed
  console.log('\n🔧 RECOMMENDATIONS TO FIX EMAIL IMPORT COMPLIANCE:');
  console.log('='.repeat(60));
  
  if (missingFields.length > 0) {
    console.log('1. The email import system is NOT creating the full normalized structure');
    console.log('2. Current email import creates only ~15-20 fields out of 108 required');
    console.log('3. This means new email imports will NOT be consistent with normalized apps');
    console.log('');
    console.log('✅ SOLUTION: Update email import functions to use normalized schema');
    console.log('');
    console.log('Files to update:');
    console.log('• services/firebaseService.js -> addApplicationFromEmail()');
    console.log('• services/emailService.js -> parseCandidateFromEmail()'); 
    console.log('• utils/resumeProcessor.js -> processing functions');
    console.log('');
    console.log('The functions should use the same normalization approach as:');
    console.log('• routes/resume-parser.js -> createNormalizedApplication()');
    console.log('• scripts/normalize-applications-structure.js -> NORMALIZED_SCHEMA');
  } else {
    console.log('✅ Email import system is fully compliant with normalized structure!');
  }
}

if (require.main === module) {
  testEmailImportStructure();
}

module.exports = { testEmailImportStructure };