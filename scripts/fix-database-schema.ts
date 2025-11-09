import { getFirestoreDB } from '../src/config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

async function fixDatabaseSchema() {
  try {
    const db = getFirestoreDB();
    
    console.log('\n🔧 FIXING DATABASE SCHEMA ISSUES\n');
    console.log('='.repeat(80));
    
    const collections = [
      'users',
      'clients',
      'applications',
      'categories',
      'pipelines',
      'activityLogs',
      'systemSettings'
    ];
    
    for (const collectionName of collections) {
      console.log(`\n📁 Processing: ${collectionName}`);
      console.log('-'.repeat(80));
      
      const snapshot = await db.collection(collectionName).get();
      
      if (snapshot.empty) {
        console.log('   ⚠️  Empty collection - skipping');
        continue;
      }
      
      let fixed = 0;
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const updates: any = {};
        let needsUpdate = false;
        
        // Fix 1: Add id field matching document ID
        if (!data.id && !data._id) {
          updates.id = doc.id;
          needsUpdate = true;
        }
        
        // Fix 2: Fix createdAt if it's empty object
        if (data.createdAt && typeof data.createdAt === 'object') {
          if (!data.createdAt._seconds && Object.keys(data.createdAt).length === 0) {
            updates.createdAt = Timestamp.now();
            needsUpdate = true;
          }
        } else if (!data.createdAt) {
          updates.createdAt = Timestamp.now();
          needsUpdate = true;
        }
        
        // Fix 3: Fix updatedAt if it's empty object
        if (data.updatedAt && typeof data.updatedAt === 'object') {
          if (!data.updatedAt._seconds && Object.keys(data.updatedAt).length === 0) {
            updates.updatedAt = Timestamp.now();
            needsUpdate = true;
          }
        } else if (!data.updatedAt) {
          updates.updatedAt = Timestamp.now();
          needsUpdate = true;
        }
        
        // Fix 4: Fix lastLogin if it's empty object (users only)
        if (collectionName === 'users' && data.lastLogin && typeof data.lastLogin === 'object') {
          if (!data.lastLogin._seconds && Object.keys(data.lastLogin).length === 0) {
            updates.lastLogin = Timestamp.now();
            needsUpdate = true;
          }
        }
        
        // Fix 5: Fix appliedAt for applications
        if (collectionName === 'applications') {
          if (!data.appliedAt || (typeof data.appliedAt === 'object' && !data.appliedAt._seconds)) {
            updates.appliedAt = data.createdAt || Timestamp.now();
            needsUpdate = true;
          }
        }
        
        if (needsUpdate) {
          await doc.ref.update(updates);
          fixed++;
          console.log(`   ✅ Fixed document: ${doc.id}`);
          console.log(`      Updates:`, Object.keys(updates).join(', '));
        }
      }
      
      if (fixed > 0) {
        console.log(`\n   ✅ Fixed ${fixed} document(s) in ${collectionName}`);
      } else {
        console.log(`\n   ℹ️  No fixes needed for ${collectionName}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Schema Fix Complete\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

fixDatabaseSchema();
