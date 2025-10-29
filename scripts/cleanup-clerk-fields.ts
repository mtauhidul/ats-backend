/**
 * Script to remove clerkId field from all user documents
 * This field is no longer needed after migrating from Clerk to custom JWT auth
 * 
 * Run this script with: npx ts-node scripts/cleanup-clerk-fields.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ats';

async function cleanupClerkFields() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    const usersCollection = db.collection('users');

    // Count documents with clerkId field
    const countWithClerkId = await usersCollection.countDocuments({
      clerkId: { $exists: true }
    });

    console.log(`\nFound ${countWithClerkId} users with clerkId field`);

    if (countWithClerkId > 0) {
      // Remove clerkId field from all documents
      console.log('\nRemoving clerkId field from all user documents...');
      const result = await usersCollection.updateMany(
        { clerkId: { $exists: true } },
        { $unset: { clerkId: '' } }
      );

      console.log(`✅ Updated ${result.modifiedCount} documents`);
    } else {
      console.log('✅ No documents have clerkId field - already cleaned up');
    }

    // Verify cleanup
    const remainingCount = await usersCollection.countDocuments({
      clerkId: { $exists: true }
    });

    if (remainingCount === 0) {
      console.log('\n✅ Cleanup complete! No documents have clerkId field anymore.');
    } else {
      console.log(`\n⚠️  Warning: ${remainingCount} documents still have clerkId field`);
    }

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
cleanupClerkFields();
