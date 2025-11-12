import * as admin from 'firebase-admin';

// Initialize Firebase Admin
const serviceAccount = require('./firebase_config.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function listEmailAccounts() {
  try {
    console.log('Fetching email accounts...\n');
    
    const snapshot = await db.collection('emailAccounts').get();
    
    if (snapshot.empty) {
      console.log('❌ No email accounts found.');
      return;
    }
    
    console.log(`✅ Found ${snapshot.size} email account(s):\n`);
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`📧 Email Account:`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Provider: ${data.provider || 'N/A'}`);
      console.log(`   IMAP Host: ${data.imapHost || 'N/A'}`);
      console.log(`   IMAP Port: ${data.imapPort || 'N/A'}`);
      console.log(`   Is Active: ${data.isActive}`);
      console.log(`   Created At: ${data.createdAt?.toDate?.() || 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

listEmailAccounts();
