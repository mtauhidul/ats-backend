// scripts/detailed-firestore-analysis.js
// Detailed analysis of Firestore Applications collection

require('dotenv').config();
const { db } = require('../services/firebaseService');

async function detailedAnalysis() {
  try {
    console.log('🔍 DETAILED FIRESTORE APPLICATIONS ANALYSIS');
    console.log('='.repeat(60));

    // Get more comprehensive sample
    const snapshot = await db.collection('applications')
      .limit(20)
      .get();

    if (snapshot.empty) {
      console.log('❌ No applications found');
      return;
    }

    // Field analysis
    const fieldAnalysis = {};
    const enumValues = {
      status: new Set(),
      reviewStatus: new Set(),
      source: new Set(),
      importMethod: new Set(),
      stage: new Set(),
      category: new Set()
    };

    snapshot.forEach(doc => {
      const data = doc.data();
      
      Object.keys(data).forEach(field => {
        if (!fieldAnalysis[field]) {
          fieldAnalysis[field] = {
            count: 0,
            types: new Set(),
            nullCount: 0,
            examples: []
          };
        }
        
        fieldAnalysis[field].count++;
        
        const value = data[field];
        if (value === null || value === undefined) {
          fieldAnalysis[field].nullCount++;
        } else {
          const type = Array.isArray(value) ? 'array' : typeof value;
          fieldAnalysis[field].types.add(type);
          
          // Keep first few examples
          if (fieldAnalysis[field].examples.length < 3) {
            fieldAnalysis[field].examples.push(value);
          }
        }
        
        // Collect enum values
        if (enumValues[field] && value) {
          enumValues[field].add(value);
        }
      });
    });

    // Print comprehensive field analysis
    console.log('\n📋 FIELD ANALYSIS:');
    console.log('-'.repeat(60));
    
    const sortedFields = Object.keys(fieldAnalysis).sort();
    sortedFields.forEach(field => {
      const analysis = fieldAnalysis[field];
      const occurrence = `${analysis.count}/${snapshot.size}`;
      const types = Array.from(analysis.types).join(' | ');
      const nulls = analysis.nullCount > 0 ? ` (${analysis.nullCount} nulls)` : '';
      
      console.log(`\n🔹 ${field}:`);
      console.log(`   Occurrence: ${occurrence}${nulls}`);
      console.log(`   Type(s): ${types}`);
      if (analysis.examples.length > 0) {
        console.log(`   Examples: ${JSON.stringify(analysis.examples[0])}`);
      }
    });

    // Print enum analysis
    console.log('\n\n📊 ENUM VALUES:');
    console.log('-'.repeat(60));
    Object.keys(enumValues).forEach(field => {
      if (enumValues[field].size > 0) {
        console.log(`${field}: [${Array.from(enumValues[field]).join(', ')}]`);
      }
    });

    // Check for required vs optional patterns
    console.log('\n\n📋 FIELD PATTERNS:');
    console.log('-'.repeat(60));
    
    const required = [];
    const optional = [];
    const rare = [];
    
    sortedFields.forEach(field => {
      const analysis = fieldAnalysis[field];
      const percentage = (analysis.count / snapshot.size) * 100;
      
      if (percentage === 100) {
        required.push(field);
      } else if (percentage >= 50) {
        optional.push(field);
      } else {
        rare.push(field);
      }
    });
    
    console.log(`\n✅ Always Present (${required.length}): ${required.join(', ')}`);
    console.log(`\n🔶 Frequently Present (${optional.length}): ${optional.join(', ')}`);
    console.log(`\n⚠️  Rarely Present (${rare.length}): ${rare.join(', ')}`);

    // Sample complete document structure
    const sampleDoc = snapshot.docs[0];
    console.log('\n\n📄 SAMPLE DOCUMENT STRUCTURE:');
    console.log('-'.repeat(60));
    console.log('Document ID:', sampleDoc.id);
    console.log('Fields:', Object.keys(sampleDoc.data()).length);
    console.log('\nComplete structure:');
    console.log(JSON.stringify(sampleDoc.data(), null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

detailedAnalysis()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });