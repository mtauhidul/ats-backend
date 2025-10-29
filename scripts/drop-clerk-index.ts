/**
 * Script to drop the old clerkId index from the users collection
 * This index is no longer needed after migrating from Clerk to custom JWT auth
 * 
 * Run this script with: npx ts-node scripts/drop-clerk-index.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ats';

async function dropClerkIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    const usersCollection = db.collection('users');

    // Get all indexes on the users collection
    console.log('\nCurrent indexes on users collection:');
    const indexes = await usersCollection.indexes();
    indexes.forEach((index) => {
      console.log(`- ${index.name}:`, JSON.stringify(index.key));
    });

    // Check if clerkId index exists
    const clerkIdIndex = indexes.find(
      (idx) => idx.name === 'clerkId_1' || idx.key?.clerkId
    );

    if (clerkIdIndex) {
      const indexName = clerkIdIndex.name;
      if (!indexName) {
        throw new Error('Index name is undefined');
      }
      console.log(`\nDropping clerkId index: ${indexName}`);
      await usersCollection.dropIndex(indexName);
      console.log('✅ Successfully dropped clerkId index');
    } else {
      console.log('\n✅ No clerkId index found - already removed or never existed');
    }

    // Verify the index is gone
    console.log('\nFinal indexes on users collection:');
    const finalIndexes = await usersCollection.indexes();
    finalIndexes.forEach((index) => {
      console.log(`- ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n✅ Index cleanup complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
}

// Run the script
dropClerkIndex();
