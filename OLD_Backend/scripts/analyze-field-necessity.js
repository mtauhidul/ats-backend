// scripts/analyze-field-necessity.js
// Analyze which fields are actually required vs optional

require('dotenv').config();
const { db } = require('../services/firebaseService');

// Define field categories based on business logic and usage patterns
const FIELD_ANALYSIS = {
  // ABSOLUTELY REQUIRED - Core business fields that must exist
  CRITICAL: {
    description: "Fields essential for basic functionality",
    fields: [
      'id',           // Document identifier
      'email',        // Primary contact - required for deduplication
      'createdAt',    // Audit trail requirement
      'updatedAt',    // Change tracking requirement
      'status',       // Application state management
      'source'        // Data lineage tracking
    ]
  },

  // HIGHLY RECOMMENDED - Important for normal operations
  IMPORTANT: {
    description: "Fields important for normal operations",
    fields: [
      'name',                // Candidate identification
      'candidateName',       // Alternative name field
      'appliedPosition',     // Job matching
      'reviewStatus',        // Workflow management
      'skills',             // Candidate evaluation
      'resumeText',         // Content for AI processing
      'resumeFileName',     // File tracking
      'history',            // Audit trail
      'stage',              // Workflow position
      'jobId',              // Job association
      'phone'               // Secondary contact
    ]
  },

  // WORKFLOW DEPENDENT - Required for specific workflows
  CONDITIONAL: {
    description: "Required only in specific workflows or conditions",
    fields: [
      'resumeFileURL',      // Only if file uploaded
      'resumeScore',        // Only if AI scoring enabled
      'aiScore',            // Only if AI processing enabled
      'parsedResume',       // Only if resume parsing enabled
      'reviewedBy',         // Only if reviewed
      'reviewedAt',         // Only if reviewed
      'reviewNotes',        // Only if reviewed
      'candidateId',        // Only if converted to candidate
      'convertedAt',        // Only if converted
      'migrationInfo',      // Only for migrated records
      'resetInfo',          // Only for reset operations
      'assignedTo',         // Only if assignment workflow used
      'assignedBy',         // Only if assignment workflow used
      'assignedAt'          // Only if assignment workflow used
    ]
  },

  // FEATURE SPECIFIC - Required for optional features
  FEATURE_SPECIFIC: {
    description: "Required only when specific features are enabled",
    fields: [
      'aiInsights',         // AI feature
      'aiReprocessReason',  // AI feature
      'lastAIReprocess',    // AI feature
      'reprocessedWith',    // AI feature
      'fileSize',           // File management feature
      'fileType',           // File management feature
      'hasResume',          // File management feature
      'hasResumeAttachment',// File management feature
      'originalFilename',   // File management feature
      'linkedIn',           // Social profile feature
      'portfolioURL',       // Portfolio feature
      'certifications',     // Certification tracking
      'languages',          // Multi-language support
      'location'            // Geographic features
    ]
  },

  // AUDIT & TRACKING - Good to have for compliance
  AUDIT: {
    description: "Fields for audit, tracking, and compliance",
    fields: [
      'importMethod',       // Data lineage
      'importDate',         // Data lineage
      'emailReceivedAt',    // Email automation tracking
      'lastReprocessed',    // Processing audit
      'workflowHistory',    // Change audit
      'communications',     // Communication tracking
      'tags',              // Organizational
      'categories'         // Organizational
    ]
    
  },

  // LEGACY/MIGRATION - May not be needed for new records
  LEGACY: {
    description: "Fields from legacy systems or migrations",
    fields: [
      'applicationSource',  // Legacy tracking
      'sourceDetails',      // Legacy tracking
      'nameFixReason',      // Data quality fix tracking
      'nameFixedBy',        // Data quality fix tracking
      'lastNameFix',        // Data quality fix tracking
      'quickFixReason',     // Data quality fix tracking
      'lastQuickFix',       // Data quality fix tracking
      'reprocessedReason',  // Legacy reprocessing
      'parsedResumeData'    // Alternative parsed data
    ]
  },

  // RARELY USED - Low business value
  RARELY_USED: {
    description: "Fields that are rarely populated or used",
    fields: [
      'companyName',        // Rarely filled
      'jobTitle',           // Often empty
      'workflowStage',      // Duplicate of stage
      'stageName',          // UI display (can be computed)
      'stageColor',         // UI display (can be computed)  
      'stageId',            // Often empty
      'internalNotes',      // Rarely used
      'feedback',           // Rarely filled
      'notes',              // Often empty
      'expectedSalary',     // Optional candidate info
      'availableStartDate', // Optional candidate info
      'dateOfBirth',        // Optional candidate info
      'gender',             // Optional candidate info
      'nationality',        // Optional candidate info
      'referredBy',         // Referral tracking
      'firstName',          // Can be derived from name
      'lastName',           // Can be derived from name
      'resumeUrl',          // Alternative to resumeFileURL
      'customFields',       // Flexible metadata
      'isActive',           // Status flag
      'marketingConsent',   // GDPR compliance
      'privacyConsent',     // GDPR compliance
      'submittedAt'         // Alternative to createdAt
    ]
  },

  // SCORING & ANALYTICS - Business intelligence
  ANALYTICS: {
    description: "Fields for scoring and analytics",
    fields: [
      'rating',             // Manual rating
      'overallScore',       // Computed score
      'technicalScore',     // Assessment score
      'communicationScore', // Assessment score
      'culturalScore',      // Assessment score
      'interviewScore',     // Interview assessment
      'scores'              // Generic scores object
    ]
  },

  // WORKFLOW & PROCESS - Process management
  PROCESS: {
    description: "Fields for workflow and process management", 
    fields: [
      'offers',             // Offer management
      'currentOffer',       // Current offer status
      'interviews',         // Interview scheduling
      'interviewHistory',   // Interview tracking
      'assignmentDate',     // Assignment tracking
      'lastCommunication',  // Communication tracking
      'isArchived',         // Archive status
      'isFlagged',          // Flag for attention
      'rejectionReason',    // Rejection tracking
      'reviewedById'        // Alternative reviewer tracking
    ]
  },

  // COMPUTED - Can be derived from other fields
  COMPUTED: {
    description: "Fields that can be computed from other data",
    fields: [
      'emailVerified',      // Can be computed
      'phoneVerified',      // Can be computed
      'category',           // Can be derived from job/skills
      'experience',         // Can be extracted from resume
      'education'           // Can be extracted from resume
    ]
  }
};

async function analyzeFieldNecessity() {
  try {
    console.log('📊 FIELD NECESSITY ANALYSIS');
    console.log('='.repeat(60));

    // Get sample of applications to analyze actual usage
    const snapshot = await db.collection('applications').limit(50).get();
    console.log(`📋 Analyzing ${snapshot.size} sample documents\n`);

    // Track field usage statistics
    const fieldStats = {};
    let totalDocs = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      totalDocs++;
      
      Object.keys(data).forEach(field => {
        if (!fieldStats[field]) {
          fieldStats[field] = {
            populated: 0,
            empty: 0,
            null: 0,
            examples: []
          };
        }
        
        const value = data[field];
        if (value === null || value === undefined) {
          fieldStats[field].null++;
        } else if (value === '' || (Array.isArray(value) && value.length === 0) || 
                  (typeof value === 'object' && Object.keys(value).length === 0)) {
          fieldStats[field].empty++;
        } else {
          fieldStats[field].populated++;
          if (fieldStats[field].examples.length < 2) {
            fieldStats[field].examples.push(value);
          }
        }
      });
    });

    // Analyze each category
    Object.entries(FIELD_ANALYSIS).forEach(([category, info]) => {
      console.log(`\n🏷️  ${category}: ${info.description}`);
      console.log('-'.repeat(60));
      
      info.fields.forEach(field => {
        const stats = fieldStats[field];
        if (stats) {
          const populatedPct = ((stats.populated / totalDocs) * 100).toFixed(1);
          const emptyPct = ((stats.empty / totalDocs) * 100).toFixed(1);
          const nullPct = ((stats.null / totalDocs) * 100).toFixed(1);
          
          const usage = stats.populated > (totalDocs * 0.8) ? '🟢' : 
                       stats.populated > (totalDocs * 0.5) ? '🟡' : 
                       stats.populated > (totalDocs * 0.1) ? '🟠' : '🔴';
          
          console.log(`${usage} ${field}`);
          console.log(`   Usage: ${populatedPct}% filled, ${emptyPct}% empty, ${nullPct}% null`);
          
          if (stats.examples.length > 0) {
            const example = typeof stats.examples[0] === 'string' && stats.examples[0].length > 50 
              ? stats.examples[0].substring(0, 50) + '...'
              : JSON.stringify(stats.examples[0]);
            console.log(`   Example: ${example}`);
          }
        } else {
          console.log(`❌ ${field} - Field not found in current schema`);
        }
      });
    });

    // Generate recommendations
    console.log('\n\n📋 FIELD OPTIMIZATION RECOMMENDATIONS');
    console.log('='.repeat(60));

    const recommendations = {
      keep_critical: [],
      keep_important: [],  
      conditional_keep: [],
      consider_removal: [],
      definitely_remove: []
    };

    Object.entries(fieldStats).forEach(([field, stats]) => {
      const populatedPct = (stats.populated / totalDocs) * 100;
      
      // Find which category this field belongs to
      let category = 'UNKNOWN';
      Object.entries(FIELD_ANALYSIS).forEach(([cat, info]) => {
        if (info.fields.includes(field)) {
          category = cat;
        }
      });

      if (category === 'CRITICAL') {
        recommendations.keep_critical.push({ field, usage: populatedPct, category });
      } else if (category === 'IMPORTANT' && populatedPct > 50) {
        recommendations.keep_important.push({ field, usage: populatedPct, category });
      } else if (['CONDITIONAL', 'FEATURE_SPECIFIC', 'AUDIT'].includes(category)) {
        recommendations.conditional_keep.push({ field, usage: populatedPct, category });
      } else if (populatedPct < 10 && ['RARELY_USED', 'LEGACY'].includes(category)) {
        recommendations.consider_removal.push({ field, usage: populatedPct, category });
      } else if (populatedPct < 5) {
        recommendations.definitely_remove.push({ field, usage: populatedPct, category });
      }
    });

    // Print recommendations
    console.log('\n✅ KEEP CRITICAL (Essential for functionality):');
    recommendations.keep_critical.forEach(item => {
      console.log(`   ${item.field} (${item.usage.toFixed(1)}% usage)`);
    });

    console.log('\n🔶 KEEP IMPORTANT (High business value):');
    recommendations.keep_important.forEach(item => {
      console.log(`   ${item.field} (${item.usage.toFixed(1)}% usage)`);
    });

    console.log('\n⚠️  CONDITIONAL KEEP (Workflow/feature dependent):');
    recommendations.conditional_keep.forEach(item => {
      console.log(`   ${item.field} (${item.usage.toFixed(1)}% usage) - ${item.category}`);
    });

    console.log('\n🟡 CONSIDER REMOVAL (Low usage, low value):');
    recommendations.consider_removal.forEach(item => {
      console.log(`   ${item.field} (${item.usage.toFixed(1)}% usage) - ${item.category}`);
    });

    console.log('\n🔴 RECOMMEND REMOVAL (Very low/no usage):');
    recommendations.definitely_remove.forEach(item => {
      console.log(`   ${item.field} (${item.usage.toFixed(1)}% usage) - ${item.category}`);
    });

    // Summary statistics
    const totalFields = Object.keys(fieldStats).length;
    const criticalFields = recommendations.keep_critical.length;
    const importantFields = recommendations.keep_important.length;
    const conditionalFields = recommendations.conditional_keep.length;
    const removalCandidates = recommendations.consider_removal.length + recommendations.definitely_remove.length;

    console.log('\n📊 OPTIMIZATION SUMMARY:');
    console.log('-'.repeat(40));
    console.log(`Total fields analyzed: ${totalFields}`);
    console.log(`Critical fields: ${criticalFields}`);
    console.log(`Important fields: ${importantFields}`);  
    console.log(`Conditional fields: ${conditionalFields}`);
    console.log(`Removal candidates: ${removalCandidates}`);
    console.log(`Potential reduction: ${((removalCandidates / totalFields) * 100).toFixed(1)}%`);

    return {
      fieldStats,
      recommendations,
      totalFields,
      analysis: FIELD_ANALYSIS
    };

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
  }
}

if (require.main === module) {
  analyzeFieldNecessity()
    .then(() => {
      console.log('\n✅ Field necessity analysis complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { analyzeFieldNecessity, FIELD_ANALYSIS };