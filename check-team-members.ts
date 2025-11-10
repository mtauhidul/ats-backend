import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(__dirname, './firebase_config.json');
const serviceAccount = require(serviceAccountPath);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function checkTeamMembers() {
  try {
    const snapshot = await db.collection('teamMembers').get();
    
    console.log(`\n📊 Found ${snapshot.size} team members\n`);
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n${index + 1}. Team Member ID: ${doc.id}`);
      console.log(`   Name: ${data.firstName} ${data.lastName}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   User ID: ${data.userId || 'NOT SET'}`);
      console.log(`   Role: ${data.role}`);
      console.log(`   Status/Active: ${data.status || data.isActive}`);
    });
    
    // Also check users collection
    const usersSnapshot = await db.collection('users').get();
    console.log(`\n\n👥 Found ${usersSnapshot.size} users\n`);
    
    usersSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n${index + 1}. User ID: ${doc.id}`);
      console.log(`   Name: ${data.firstName} ${data.lastName}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Role: ${data.role}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkTeamMembers();
