// scripts/analyze-field-inconsistencies.js
// Analyze field inconsistencies across all applications

require('dotenv').config();
const { db } = require('../services/firebaseService');

async function analyzeInconsistencies() {
  try {
    console.log('🔍 ANALYZING FIELD INCONSISTENCIES ACROSS ALL APPLICATIONS');
    console.log('='.repeat(70));

    // Get all applications
    const snapshot = await db.collection('applications').get();
    console.log(`📊 Total applications: ${snapshot.size}`);

    if (snapshot.empty) {
      console.log('❌ No applications found');
      return;
    }

    // Collect all unique fields across all documents
    const allFieldsMap = new Map();
    const documentsAnalysis = [];
    
    snapshot.forEach((doc, index) => {
      const data = doc.data();
      const docFields = Object.keys(data);
      
      // Track field occurrence
      docFields.forEach(field => {
        if (!allFieldsMap.has(field)) {
          allFieldsMap.set(field, {
            count: 0,
            presentInDocs: [],
            missingInDocs: [],
            examples: []
          });
        }
        const fieldInfo = allFieldsMap.get(field);
        fieldInfo.count++;
        fieldInfo.presentInDocs.push(doc.id);
        
        // Store example values
        if (fieldInfo.examples.length < 3) {
          fieldInfo.examples.push(data[field]);
        }
      });

      documentsAnalysis.push({
        id: doc.id,
        fieldCount: docFields.length,
        fields: docFields
      });

      if (index < 5) {
        console.log(`📄 Document ${index + 1} (${doc.id}): ${docFields.length} fields`);
      }
    });

    // Find missing fields for each document
    const allUniqueFields = Array.from(allFieldsMap.keys()).sort();
    console.log(`\n📋 Total unique fields found: ${allUniqueFields.length}`);

    documentsAnalysis.forEach(docAnalysis => {
      const missingFields = allUniqueFields.filter(field => !docAnalysis.fields.includes(field));
      docAnalysis.missingFields = missingFields;
      docAnalysis.missingCount = missingFields.length;
      
      // Update field tracking
      missingFields.forEach(field => {
        allFieldsMap.get(field).missingInDocs.push(docAnalysis.id);
      });
    });

    // Field occurrence analysis
    console.log('\n📊 FIELD OCCURRENCE ANALYSIS:');
    console.log('-'.repeat(70));
    
    const fieldOccurrence = {
      universal: [], // 100% occurrence
      frequent: [],  // 80-99% occurrence
      occasional: [], // 50-79% occurrence
      rare: []       // <50% occurrence
    };

    allUniqueFields.forEach(field => {
      const fieldInfo = allFieldsMap.get(field);
      const percentage = (fieldInfo.count / snapshot.size) * 100;
      
      if (percentage === 100) {
        fieldOccurrence.universal.push(field);
      } else if (percentage >= 80) {
        fieldOccurrence.frequent.push(field);
      } else if (percentage >= 50) {
        fieldOccurrence.occasional.push(field);
      } else {
        fieldOccurrence.rare.push(field);
      }
    });

    console.log(`✅ Universal Fields (${fieldOccurrence.universal.length}): Always present`);
    console.log(`🔶 Frequent Fields (${fieldOccurrence.frequent.length}): 80-99% presence`);
    console.log(`⚠️  Occasional Fields (${fieldOccurrence.occasional.length}): 50-79% presence`);
    console.log(`🔻 Rare Fields (${fieldOccurrence.rare.length}): <50% presence`);

    // Document inconsistency analysis
    console.log('\n📄 DOCUMENT FIELD COUNT ANALYSIS:');
    console.log('-'.repeat(70));
    
    const fieldCounts = documentsAnalysis.map(doc => doc.fieldCount);
    const minFields = Math.min(...fieldCounts);
    const maxFields = Math.max(...fieldCounts);
    const avgFields = fieldCounts.reduce((a, b) => a + b, 0) / fieldCounts.length;

    console.log(`📊 Field count statistics:`);
    console.log(`   Minimum fields: ${minFields}`);
    console.log(`   Maximum fields: ${maxFields}`);
    console.log(`   Average fields: ${avgFields.toFixed(1)}`);
    console.log(`   Difference: ${maxFields - minFields} fields`);

    // Find documents with most and least fields
    const minFieldDoc = documentsAnalysis.find(doc => doc.fieldCount === minFields);
    const maxFieldDoc = documentsAnalysis.find(doc => doc.fieldCount === maxFields);

    console.log(`\n📄 Document with fewest fields: ${minFieldDoc.id} (${minFields} fields)`);
    console.log(`📄 Document with most fields: ${maxFieldDoc.id} (${maxFields} fields)`);

    // Identify problematic fields (not universal)
    const problematicFields = [...fieldOccurrence.frequent, ...fieldOccurrence.occasional, ...fieldOccurrence.rare];
    
    console.log(`\n⚠️  FIELDS CAUSING INCONSISTENCY (${problematicFields.length}):`);
    console.log('-'.repeat(70));
    
    problematicFields.forEach(field => {
      const fieldInfo = allFieldsMap.get(field);
      const percentage = (fieldInfo.count / snapshot.size) * 100;
      console.log(`🔹 ${field}: ${fieldInfo.count}/${snapshot.size} documents (${percentage.toFixed(1)}%)`);
      
      if (fieldInfo.missingInDocs.length <= 5) {
        console.log(`   Missing in: ${fieldInfo.missingInDocs.join(', ')}`);
      } else {
        console.log(`   Missing in: ${fieldInfo.missingInDocs.length} documents`);
      }
    });

    // Generate normalization plan
    console.log('\n🛠️  NORMALIZATION PLAN:');
    console.log('-'.repeat(70));
    
    const documentsToUpdate = documentsAnalysis.filter(doc => doc.fieldCount < allUniqueFields.length);
    console.log(`📊 Documents needing updates: ${documentsToUpdate.length}/${snapshot.size}`);
    
    if (documentsToUpdate.length > 0) {
      console.log('\n📋 Fields to add to incomplete documents:');
      problematicFields.forEach(field => {
        const fieldInfo = allFieldsMap.get(field);
        const defaultValue = getDefaultValueForField(field, fieldInfo.examples[0]);
        console.log(`   ${field}: ${JSON.stringify(defaultValue)}`);
      });
    }

    return {
      totalDocuments: snapshot.size,
      totalUniqueFields: allUniqueFields.length,
      universalFields: fieldOccurrence.universal,
      problematicFields,
      documentsToUpdate,
      allFieldsMap,
      fieldCounts: { min: minFields, max: maxFields, avg: avgFields }
    };

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Determine default value for a field based on its type and existing examples
function getDefaultValueForField(fieldName, example) {
  // Handle null/undefined examples
  if (example === null || example === undefined) {
    // Determine default based on field name patterns
    if (fieldName.includes('Date') || fieldName.includes('At')) {
      return null;
    }
    if (fieldName.includes('Score') || fieldName.includes('Count')) {
      return 0;
    }
    if (fieldName.includes('Array') || fieldName.endsWith('s') && Array.isArray(example)) {
      return [];
    }
    if (fieldName.includes('Verified') || fieldName.includes('Is') || fieldName.includes('Has')) {
      return false;
    }
    return null;
  }

  // Return appropriate default based on type
  const type = Array.isArray(example) ? 'array' : typeof example;
  
  switch (type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      if (example && example._seconds !== undefined) {
        // Firestore Timestamp
        return null;
      }
      return {};
    default:
      return null;
  }
}

if (require.main === module) {
  analyzeInconsistencies()
    .then(() => {
      console.log('\n✅ Analysis complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { analyzeInconsistencies };