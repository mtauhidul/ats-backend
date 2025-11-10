import { getFirestoreDb } from './src/config/firebase';

(async () => {
  const db = getFirestoreDb();
  const candidates = await db.collection('candidates').limit(1).get();
  
  if (candidates.empty) {
    console.log('No candidates found');
    return;
  }
  
  const doc = candidates.docs[0];
  const data = doc.data();
  
  console.log('=== CANDIDATE DOCUMENT ===');
  console.log('ID:', doc.id);
  console.log('\nFull Data:');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('\n=== KEY FIELDS ===');
  console.log('currentPipelineStageId:', data.currentPipelineStageId);
  console.log('jobIds:', data.jobIds);
  console.log('jobApplications:', JSON.stringify(data.jobApplications, null, 2));
  
  process.exit(0);
})();
