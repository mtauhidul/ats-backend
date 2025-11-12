import axios from 'axios';

async function testEmailAccountsAPI() {
  try {
    console.log('Testing /api/email-accounts endpoint...\n');
    
    // First, let's check if there are any accounts in Firestore
    const admin = require('firebase-admin');
    const serviceAccount = require('./firebase_config.json');

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    const db = admin.firestore();
    const snapshot = await db.collection('emailAccounts').get();
    
    console.log(`✅ Found ${snapshot.size} email account(s) in Firestore\n`);
    
    if (snapshot.size > 0) {
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('📧 Account in Firestore:');
        console.log(`   ID: ${doc.id}`);
        console.log(`   Email: ${data.email}`);
        console.log(`   Is Active: ${data.isActive}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

testEmailAccountsAPI();
