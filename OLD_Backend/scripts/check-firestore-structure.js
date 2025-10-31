// scripts/check-firestore-structure.js
// Script to examine the actual Firestore Applications collection structure

require('dotenv').config();
const { db } = require('../services/firebaseService');

async function checkApplicationsStructure() {
  try {
    console.log('🔍 Checking Firestore Applications Collection Structure...\n');

    // Get a sample of applications from Firestore
    const snapshot = await db.collection('applications')
      .limit(5)
      .get();

    if (snapshot.empty) {
      console.log('❌ No applications found in Firestore');
      return;
    }

    console.log(`📊 Found ${snapshot.size} sample applications\n`);

    const allFields = new Set();
    const fieldTypes = {};
    const fieldExamples = {};

    snapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n📄 Application ${index + 1} (ID: ${doc.id}):`);
      console.log('==========================================');
      
      Object.keys(data).forEach(field => {
        allFields.add(field);
        
        const value = data[field];
        const type = Array.isArray(value) ? 'array' : typeof value;
        
        // Store type info
        if (!fieldTypes[field]) {
          fieldTypes[field] = new Set();
        }
        fieldTypes[field].add(type);
        
        // Store example values (first occurrence)
        if (!fieldExamples[field]) {
          fieldExamples[field] = value;
        }
        
        console.log(`  ${field}: ${JSON.stringify(value, null, 2)}`);
      });
    });

    console.log('\n\n📋 COMPLETE FIELD ANALYSIS:');
    console.log('==========================================');
    
    const sortedFields = Array.from(allFields).sort();
    
    sortedFields.forEach(field => {
      const types = Array.from(fieldTypes[field]).join(' | ');
      const example = fieldExamples[field];
      
      console.log(`\n🔹 ${field}:`);
      console.log(`   Type(s): ${types}`);
      console.log(`   Example: ${JSON.stringify(example)}`);
    });

    // Check for status values
    console.log('\n\n📈 STATUS VALUES ANALYSIS:');
    console.log('==========================================');
    
    const statusValues = new Set();
    const reviewStatusValues = new Set();
    const sourceValues = new Set();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.status) statusValues.add(data.status);
      if (data.reviewStatus) reviewStatusValues.add(data.reviewStatus);
      if (data.source) sourceValues.add(data.source);
    });
    
    console.log(`Status values found: [${Array.from(statusValues).join(', ')}]`);
    console.log(`Review status values found: [${Array.from(reviewStatusValues).join(', ')}]`);
    console.log(`Source values found: [${Array.from(sourceValues).join(', ')}]`);

    // Get collection statistics
    const totalSnapshot = await db.collection('applications').get();
    console.log(`\n\n📊 COLLECTION STATISTICS:`);
    console.log('==========================================');
    console.log(`Total applications: ${totalSnapshot.size}`);

  } catch (error) {
    console.error('❌ Error checking Firestore structure:', error);
  }
}

// Run the analysis
checkApplicationsStructure()
  .then(() => {
    console.log('\n✅ Analysis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });