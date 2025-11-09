import { getFirestoreDB } from '../src/config/firebase';

async function checkTimestamps() {
  const db = getFirestoreDB();
  const doc = await db.collection('applications').doc('EZqi6cFmdCJt7uPXdub2').get();
  
  if (!doc.exists) {
    console.log('Document not found');
    process.exit(1);
  }
  
  const data = doc.data()!;
  console.log('createdAt:', data.createdAt);
  console.log('updatedAt:', data.updatedAt);
  console.log('appliedAt:', data.appliedAt);
  
  process.exit(0);
}

checkTimestamps();
