import { getFirestoreDB } from '../src/config/firebase';

async function auditDatabase() {
  try {
    const db = getFirestoreDB();
    
    const collections = [
      'users',
      'clients', 
      'jobs',
      'applications',
      'candidates',
      'categories',
      'tags',
      'pipelines',
      'interviews',
      'emailAccounts',
      'emailTemplates',
      'activityLogs',
      'notifications',
      'messages',
      'systemSettings'
    ];
    
    console.log('\n🔍 DATABASE SCHEMA AUDIT\n');
    console.log('='.repeat(80));
    
    for (const collectionName of collections) {
      console.log(`\n📁 Collection: ${collectionName}`);
      console.log('-'.repeat(80));
      
      const snapshot = await db.collection(collectionName).limit(5).get();
      
      if (snapshot.empty) {
        console.log('   ⚠️  Empty collection - no documents found');
        continue;
      }
      
      console.log(`   ✅ Documents found: ${snapshot.size}`);
      
      // Analyze first document structure
      const firstDoc = snapshot.docs[0];
      const data = firstDoc.data();
      
      console.log('\n   📋 Sample Document Structure:');
      console.log(`   Document ID: ${firstDoc.id}`);
      
      // Check common fields
      const issues = [];
      
      if (!data.id && !data._id) {
        issues.push('❌ Missing both id and _id fields');
      } else if (data.id && data._id) {
        if (data.id !== data._id) {
          issues.push(`⚠️  id (${data.id}) != _id (${data._id})`);
        }
      }
      
      if (!data.createdAt) {
        issues.push('❌ Missing createdAt field');
      } else {
        const type = typeof data.createdAt;
        if (type === 'object' && data.createdAt._seconds) {
          console.log(`   ✅ createdAt: Firestore Timestamp`);
        } else if (data.createdAt instanceof Date) {
          console.log(`   ✅ createdAt: Date object`);
        } else {
          issues.push(`⚠️  createdAt is ${type}: ${JSON.stringify(data.createdAt)}`);
        }
      }
      
      if (!data.updatedAt) {
        issues.push('⚠️  Missing updatedAt field');
      }
      
      // Collection-specific checks
      if (collectionName === 'applications') {
        if (!data.appliedAt) issues.push('❌ Missing appliedAt field');
        if (!data.source) issues.push('❌ Missing source field');
        if (!data.status) issues.push('❌ Missing status field');
      }
      
      if (collectionName === 'jobs') {
        if (!data.clientId) issues.push('❌ Missing clientId field');
        if (data.clientId && typeof data.clientId === 'object') {
          issues.push('⚠️  clientId is object instead of string');
        }
        if (!data.status) issues.push('❌ Missing status field');
      }
      
      if (collectionName === 'clients') {
        if (!data.companyName) issues.push('❌ Missing companyName field');
      }
      
      if (collectionName === 'candidates') {
        if (!data.email) issues.push('❌ Missing email field');
      }
      
      if (issues.length > 0) {
        console.log('\n   ⚠️  Issues Found:');
        issues.forEach(issue => console.log(`      ${issue}`));
      } else {
        console.log('\n   ✅ No issues found in sample');
      }
      
      // Show all fields
      console.log('\n   📝 All Fields:');
      Object.keys(data).sort().forEach(key => {
        const value = data[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        console.log(`      - ${key}: ${type}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Audit Complete\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

auditDatabase();
