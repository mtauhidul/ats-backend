import { getFirestoreDB } from '../src/config/firebase';

async function checkApplications() {
  try {
    const db = getFirestoreDB();
    const snapshot = await db.collection('applications').get();
    
    console.log('\n📊 Applications in Database:');
    console.log('Total applications:', snapshot.size);
    
    if (snapshot.size > 0) {
      snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\nApplication ${index + 1}:`);
        console.log('- ID:', doc.id);
        console.log('- Source:', data.source);
        console.log('- Created At:', data.createdAt);
        console.log('- Created At Type:', typeof data.createdAt);
        console.log('- Created At Value:', JSON.stringify(data.createdAt));
        console.log('- Status:', data.status);
        console.log('- Job ID:', data.jobId);
      });
    } else {
      console.log('\n❌ No applications found in database!');
      console.log('The dashboard will show "No data available" because there are no applications.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkApplications();
