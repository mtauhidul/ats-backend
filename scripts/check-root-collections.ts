/**
 * Check Root Collections in Firestore
 * Verifies data at root level (not under companies)
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

async function checkRootCollections() {
  console.log('🔍 Checking ROOT level Firestore collections...\n');

  const collections = ['clients', 'categories', 'tags', 'jobs', 'applications', 'candidates'];

  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).limit(5).get();
      
      console.log(`📦 ${collectionName.toUpperCase()}`);
      console.log(`   Path: /${collectionName}`);
      console.log(`   Count: ${snapshot.size} documents (showing first 5)`);
      
      if (snapshot.empty) {
        console.log(`   ❌ EMPTY - No documents found!`);
      } else {
        console.log(`   ✅ Has data`);
        snapshot.forEach(doc => {
          const data = doc.data();
          const preview: Record<string, any> = { id: doc.id };
          
          // Show relevant fields based on collection
          if (collectionName === 'clients') {
            preview.companyName = data.companyName;
            preview.email = data.email;
            preview.status = data.status;
          } else if (collectionName === 'jobs') {
            preview.title = data.title;
            preview.status = data.status;
          } else if (collectionName === 'candidates') {
            preview.name = data.name;
            preview.email = data.email;
          } else {
            // Show first 3 fields
            Object.entries(data).slice(0, 3).forEach(([key, value]) => {
              preview[key] = value;
            });
          }
          
          console.log(`   - ${JSON.stringify(preview)}`);
        });
      }
      console.log('');
    } catch (error) {
      console.error(`   ❌ Error checking ${collectionName}:`, error);
      console.log('');
    }
  }

  console.log('✅ Check complete!\n');
}

checkRootCollections().catch(console.error);
