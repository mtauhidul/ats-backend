import { getFirestoreDB } from '../src/config/firebase';

async function fixApplication() {
  try {
    const db = getFirestoreDB();
    const snapshot = await db.collection('applications').get();
    
    console.log('Fixing applications...\n');
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Fix createdAt if it's empty or invalid
      if (!data.createdAt || typeof data.createdAt !== 'object' || !data.createdAt._seconds) {
        console.log(`Fixing application ${doc.id}...`);
        
        const now = new Date();
        await doc.ref.update({
          createdAt: now,
          appliedAt: now,
          updatedAt: now
        });
        
        console.log('✅ Fixed!');
      }
    }
    
    console.log('\n✅ All applications fixed!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

fixApplication();
