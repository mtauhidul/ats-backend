/**
 * Check Firestore Data
 * Quick script to verify if data exists in Firestore collections
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../firebase_config.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const companyId = process.env.DEFAULT_COMPANY_ID || 'default-company';

async function checkData() {
  console.log('🔍 Checking Firestore data...\n');
  console.log(`📍 Company ID: ${companyId}\n`);

  const collections = ['jobs', 'applications', 'candidates', 'clients', 'categories', 'tags'];

  for (const collectionName of collections) {
    try {
      const collectionPath = `companies/${companyId}/${collectionName}`;
      const snapshot = await db.collection(collectionPath).limit(5).get();
      
      console.log(`📦 ${collectionName.toUpperCase()}`);
      console.log(`   Path: ${collectionPath}`);
      console.log(`   Count: ${snapshot.size} documents (showing first 5)`);
      
      if (snapshot.empty) {
        console.log(`   ❌ EMPTY - No documents found!`);
      } else {
        console.log(`   ✅ Has data`);
        snapshot.forEach(doc => {
          const data = doc.data();
          const preview = {
            id: doc.id,
            ...Object.fromEntries(
              Object.entries(data).slice(0, 3) // Show first 3 fields
            )
          };
          console.log(`   - ${JSON.stringify(preview, null, 0)}`);
        });
      }
      console.log('');
    } catch (error) {
      console.log(`📦 ${collectionName.toUpperCase()}`);
      console.log(`   ❌ ERROR: ${error}`);
      console.log('');
    }
  }

  console.log('✅ Check complete!\n');
  
  // Summary
  console.log('📊 SUMMARY:');
  console.log('If all collections show "EMPTY", you need to seed data.');
  console.log('Options:');
  console.log('  1. Create data via admin dashboard');
  console.log('  2. Run: npx tsx scripts/seed-firestore-test-data.ts');
  console.log('  3. Manually add via Firebase Console\n');
  
  process.exit(0);
}

checkData().catch(console.error);
