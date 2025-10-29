/**
 * Script to create the first admin user
 * Usage: npx ts-node scripts/create-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createAdmin() {
  try {
    console.log('\n=== Create First Admin User ===\n');

    // Get user input
    const email = await question('Enter admin email: ');
    const firstName = await question('Enter first name: ');
    const lastName = await question('Enter last name: ');
    const password = await question('Enter password (min 8 characters): ');

    // Validate input
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }

    if (!firstName || !lastName) {
      throw new Error('First name and last name are required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    console.log('\nHashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    console.log('Creating admin user...');
    const admin = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        passwordHash,
        role: 'admin',
        isActive: true,
        emailVerified: true, // Auto-verify for first admin
      },
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('\nUser details:');
    console.log(`  ID: ${admin.id}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Name: ${admin.firstName} ${admin.lastName}`);
    console.log(`  Role: ${admin.role}`);
    console.log('\nYou can now login at: http://localhost:5173/login');
    console.log(`  Email: ${admin.email}`);
    console.log('  Password: [the password you just entered]');

  } catch (error) {
    console.error('\n❌ Error creating admin user:');
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Run the script
createAdmin();
