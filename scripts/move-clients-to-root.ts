/**
 * Move clients data from companies/default-company/clients to root clients collection
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

async function moveClientsToRoot() {
  console.log('🔄 Moving clients from nested to root collection...\n');

  // Get clients from nested collection
  const nestedPath = 'companies/default-company/clients';
  const nestedSnapshot = await db.collection(nestedPath).get();

  if (nestedSnapshot.empty) {
    console.log('❌ No clients found in', nestedPath);
    return;
  }

  console.log(`📦 Found ${nestedSnapshot.size} client(s) in ${nestedPath}`);

  // Move each client to root collection
  for (const doc of nestedSnapshot.docs) {
    const data = doc.data();
    console.log(`\n📋 Processing client: ${doc.id}`);
    console.log(`   Company: ${data.companyName}`);

    // Copy to root collection
    await db.collection('clients').doc(doc.id).set(data);
    console.log('   ✅ Copied to root /clients collection');

    // Delete from nested collection
    await doc.ref.delete();
    console.log('   ✅ Deleted from', nestedPath);
  }

  // Verify root collection
  const rootSnapshot = await db.collection('clients').get();
  console.log(`\n✅ Migration complete!`);
  console.log(`📊 Total clients in root collection: ${rootSnapshot.size}`);
}

moveClientsToRoot().catch(console.error);
