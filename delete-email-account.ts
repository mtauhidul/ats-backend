import * as admin from 'firebase-admin';

// Initialize Firebase Admin
const serviceAccount = require('./firebase_config.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function deleteEmailAccount() {
  try {
    const emailToDelete = 'hello@notequik.com';
    
    console.log(`🔍 Searching for email account: ${emailToDelete}...\n`);
    
    const snapshot = await db.collection('emailAccounts')
      .where('email', '==', emailToDelete)
      .get();
    
    if (snapshot.empty) {
      console.log(`❌ No email account found with email: ${emailToDelete}`);
      return;
    }
    
    for (const doc of snapshot.docs) {
      console.log(`🗑️  Deleting account: ${doc.id} (${doc.data().email})`);
      await doc.ref.delete();
      console.log(`✅ Account deleted successfully!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

deleteEmailAccount();
