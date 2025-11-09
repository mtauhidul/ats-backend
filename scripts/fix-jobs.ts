import { getFirestoreDB } from '../src/config/firebase';

async function fixJobs() {
  console.log('🔧 Fixing jobs...\n');
  
  const db = getFirestoreDB();
  const jobsRef = db.collection('jobs');
  const snapshot = await jobsRef.get();
  
  let fixedCount = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates: any = {};
    const issues: string[] = [];
    
    // Fix clientId if it's an object
    if (data.clientId && typeof data.clientId === 'object') {
      issues.push('clientId is object (should be string)');
      updates.clientId = data.clientId.id || data.clientId._id;
    }
    
    // Fix categoryIds if they're objects
    if (data.categoryIds && Array.isArray(data.categoryIds)) {
      const hasObjects = data.categoryIds.some((cat: any) => typeof cat === 'object');
      if (hasObjects) {
        issues.push('categoryIds contains objects (should be string IDs)');
        updates.categoryIds = data.categoryIds.map((cat: any) => 
          typeof cat === 'object' ? cat.id : cat
        );
      }
    }
    
    // Fix createdAt if it's empty object
    if (data.createdAt && typeof data.createdAt === 'object' && Object.keys(data.createdAt).length === 0) {
      issues.push('createdAt is empty object');
      updates.createdAt = new Date();
    }
    
    // Fix updatedAt if missing
    if (!data.updatedAt) {
      issues.push('missing updatedAt');
      updates.updatedAt = new Date();
    }
    
    // Fix id field if missing
    if (!data.id) {
      issues.push('missing id field');
      updates.id = doc.id;
    }
    
    if (Object.keys(updates).length > 0) {
      console.log(`\n📝 Job: ${data.title || doc.id}`);
      console.log('   Issues:', issues.join(', '));
      console.log('   Fixes:', JSON.stringify(updates, null, 2));
      
      await jobsRef.doc(doc.id).update(updates);
      fixedCount++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} jobs`);
}

fixJobs().catch(console.error);
