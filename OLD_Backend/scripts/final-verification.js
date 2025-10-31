// scripts/final-verification.js
// Final comprehensive verification of all applications

require('dotenv').config();
const { db } = require('../services/firebaseService');

async function finalVerification() {
  try {
    console.log('🔍 FINAL COMPREHENSIVE VERIFICATION');
    console.log('='.repeat(50));

    const snapshot = await db.collection('applications').get();
    console.log(`📊 Total applications: ${snapshot.size}`);

    const expectedFieldCount = 108;
    let allNormalized = true;
    let normalizedCount = 0;
    const fieldCounts = [];
    const issues = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const fieldCount = Object.keys(data).length;
      fieldCounts.push(fieldCount);

      if (fieldCount === expectedFieldCount) {
        normalizedCount++;
      } else {
        allNormalized = false;
        issues.push({
          id: doc.id,
          fieldCount,
          difference: fieldCount - expectedFieldCount
        });
      }
    });

    // Statistics
    const minFields = Math.min(...fieldCounts);
    const maxFields = Math.max(...fieldCounts);
    const avgFields = fieldCounts.reduce((a, b) => a + b, 0) / fieldCounts.length;

    console.log('\n📊 VERIFICATION RESULTS:');
    console.log('-'.repeat(50));
    console.log(`✅ Properly normalized: ${normalizedCount}/${snapshot.size}`);
    console.log(`📋 Expected fields: ${expectedFieldCount}`);
    console.log(`📈 Field count range: ${minFields} - ${maxFields}`);
    console.log(`📊 Average fields: ${avgFields.toFixed(1)}`);

    if (allNormalized) {
      console.log('\n🎉 SUCCESS! All documents are perfectly normalized!');
      console.log(`✅ All ${snapshot.size} documents have exactly ${expectedFieldCount} fields`);
      
      // Sample a few documents to show the structure consistency
      console.log('\n📄 Sample documents structure verification:');
      const sampleDocs = snapshot.docs.slice(0, 5);
      sampleDocs.forEach((doc, index) => {
        const fieldCount = Object.keys(doc.data()).length;
        console.log(`   ${index + 1}. ${doc.id}: ${fieldCount} fields ✓`);
      });

    } else {
      console.log('\n❌ Issues found:');
      issues.forEach(issue => {
        console.log(`   ${issue.id}: ${issue.fieldCount} fields (${issue.difference > 0 ? '+' : ''}${issue.difference})`);
      });
    }

    // Check for specific required fields in a sample
    console.log('\n🔍 Checking key field presence in sample documents:');
    const keyFields = ['id', 'email', 'name', 'status', 'createdAt', 'updatedAt'];
    const sampleDoc = snapshot.docs[0].data();
    
    keyFields.forEach(field => {
      const hasField = sampleDoc.hasOwnProperty(field);
      console.log(`   ${field}: ${hasField ? '✅' : '❌'}`);
    });

    return {
      totalDocuments: snapshot.size,
      normalizedDocuments: normalizedCount,
      allNormalized,
      expectedFields: expectedFieldCount,
      issues
    };

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}

if (require.main === module) {
  finalVerification()
    .then((results) => {
      if (results.allNormalized) {
        console.log('\n🎉 MISSION ACCOMPLISHED!');
        console.log('✅ All applications now have identical data structures');
        console.log(`📋 ${results.totalDocuments} documents × ${results.expectedFields} fields each`);
        process.exit(0);
      } else {
        console.log('\n⚠️  Some issues still need attention');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Final verification failed:', error);
      process.exit(1);
    });
}

module.exports = { finalVerification };