/**
 * Script to update user role
 * Usage: npx ts-node scripts/update-user-role.ts <email> <role>
 * Example: npx ts-node scripts/update-user-role.ts user@example.com admin
 */

import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { config } from '../src/config';

const validRoles = ['super_admin', 'admin', 'recruiter', 'hiring_manager', 'interviewer'];

async function updateUserRole(email: string, role: string) {
  try {
    // Validate role
    if (!validRoles.includes(role)) {
      console.error(`❌ Invalid role: ${role}`);
      console.log(`Valid roles are: ${validRoles.join(', ')}`);
      process.exit(1);
    }

    // Connect to MongoDB
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Connected to MongoDB');

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.error(`❌ User not found with email: ${email}`);
      process.exit(1);
    }

    console.log(`\n📋 Current user info:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Current Role: ${user.role}`);
    console.log(`   Active: ${user.isActive}`);

    // Update role
    user.role = role as any;
    await user.save();

    console.log(`\n✅ User role updated successfully!`);
    console.log(`   New Role: ${user.role}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating user role:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Get command line arguments
const email = process.argv[2];
const role = process.argv[3];

if (!email || !role) {
  console.log('❌ Usage: npx ts-node scripts/update-user-role.ts <email> <role>');
  console.log(`Valid roles: ${validRoles.join(', ')}`);
  console.log('\nExample: npx ts-node scripts/update-user-role.ts user@example.com admin');
  process.exit(1);
}

updateUserRole(email, role);
