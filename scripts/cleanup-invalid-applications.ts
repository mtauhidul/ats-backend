import { getFirestoreDB } from '../src/config/firebase';

async function cleanupInvalidApplications() {
  const db = getFirestoreDB();
  const snapshot = await db.collection('applications').get();
  
  console.log(`Found ${snapshot.size} applications\n`);
  
  let deletedCount = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Delete if missing required fields or invalid status
    const isInvalid = !data.jobId || !data.candidateId || data.status === 'approved';
    
    if (isInvalid) {
      console.log(`Deleting invalid application: ${doc.id}`);
      console.log(`  Missing jobId: ${!data.jobId}`);
      console.log(`  Missing candidateId: ${!data.candidateId}`);
      console.log(`  Invalid status (approved): ${data.status === 'approved'}`);
      
      await db.collection('applications').doc(doc.id).delete();
      deletedCount++;
    }
  }
  
  console.log(`\n✅ Deleted ${deletedCount} invalid applications`);
  process.exit(0);
}

cleanupInvalidApplications().catch(console.error);
