#!/usr/bin/env ts-node

/**
 * Test Email Notifications for Team Members
 * 
 * This script tests the email notification system for:
 * 1. Team member assignments
 * 2. Profile updates
 * 3. Role changes
 * 
 * Run with: npm run test:email-notifications
 * Or: ts-node scripts/test-email-notifications.ts
 */

import { sendAssignmentEmail, sendTeamMemberUpdateEmail } from '../src/services/email.service';
import logger from '../src/utils/logger';

// Test email recipient (change this to your test email)
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_FIRST_NAME = 'John';

async function testAssignmentEmail() {
  console.log('\n📧 Testing Assignment Email...');
  console.log(`Sending to: ${TEST_EMAIL}`);
  
  try {
    const result = await sendAssignmentEmail(
      TEST_EMAIL,
      TEST_FIRST_NAME,
      'job',
      'Senior Full Stack Developer',
      'Jane Smith (Admin)'
    );
    
    if (result) {
      console.log('✅ Assignment email sent successfully!');
      console.log(`Email ID: ${result}`);
    } else {
      console.log('❌ Assignment email failed to send');
    }
  } catch (error) {
    console.error('❌ Error sending assignment email:', error);
  }
}

async function testProfileUpdateEmail() {
  console.log('\n📧 Testing Profile Update Email...');
  console.log(`Sending to: ${TEST_EMAIL}`);
  
  try {
    const changes = [
      'First name updated',
      'Phone number updated',
      'Job title updated',
      'Department updated'
    ];
    
    const result = await sendTeamMemberUpdateEmail(
      TEST_EMAIL,
      TEST_FIRST_NAME,
      changes,
      'Jane Smith (Admin)'
    );
    
    if (result) {
      console.log('✅ Profile update email sent successfully!');
      console.log(`Email ID: ${result}`);
    } else {
      console.log('❌ Profile update email failed to send');
    }
  } catch (error) {
    console.error('❌ Error sending profile update email:', error);
  }
}

async function testRoleChangeEmail() {
  console.log('\n📧 Testing Role Change Email...');
  console.log(`Sending to: ${TEST_EMAIL}`);
  
  try {
    const changes = [
      'Role changed to hiring_manager',
      'Permissions updated'
    ];
    
    const result = await sendTeamMemberUpdateEmail(
      TEST_EMAIL,
      TEST_FIRST_NAME,
      changes,
      'Jane Smith (Admin)'
    );
    
    if (result) {
      console.log('✅ Role change email sent successfully!');
      console.log(`Email ID: ${result}`);
    } else {
      console.log('❌ Role change email failed to send');
    }
  } catch (error) {
    console.error('❌ Error sending role change email:', error);
  }
}

async function testCandidateAssignmentEmail() {
  console.log('\n📧 Testing Candidate Assignment Email...');
  console.log(`Sending to: ${TEST_EMAIL}`);
  
  try {
    const result = await sendAssignmentEmail(
      TEST_EMAIL,
      TEST_FIRST_NAME,
      'candidate',
      'Candidate: Sarah Johnson (Senior Full Stack Developer)',
      'Jane Smith (Admin)'
    );
    
    if (result) {
      console.log('✅ Candidate assignment email sent successfully!');
      console.log(`Email ID: ${result}`);
    } else {
      console.log('❌ Candidate assignment email failed to send');
    }
  } catch (error) {
    console.error('❌ Error sending candidate assignment email:', error);
  }
}

async function testSelfUpdateEmail() {
  console.log('\n📧 Testing Self Update Email...');
  console.log(`Sending to: ${TEST_EMAIL}`);
  
  try {
    const changes = [
      'Profile picture updated',
      'Phone number updated'
    ];
    
    const result = await sendTeamMemberUpdateEmail(
      TEST_EMAIL,
      TEST_FIRST_NAME,
      changes,
      'You (self-update)'
    );
    
    if (result) {
      console.log('✅ Self update email sent successfully!');
      console.log(`Email ID: ${result}`);
    } else {
      console.log('❌ Self update email failed to send');
    }
  } catch (error) {
    console.error('❌ Error sending self update email:', error);
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('    Email Notifications Test Suite');
  console.log('═══════════════════════════════════════════════════════════');
  
  // Check if RESEND_API_KEY is set
  if (!process.env.RESEND_API_KEY) {
    console.error('\n❌ ERROR: RESEND_API_KEY environment variable is not set!');
    console.error('Please set it in your .env file and try again.');
    process.exit(1);
  }
  
  console.log(`\n📬 Test emails will be sent to: ${TEST_EMAIL}`);
  console.log('Make sure this is a valid email address you can access.\n');
  
  // Run all tests
  await testAssignmentEmail();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
  
  await testProfileUpdateEmail();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testRoleChangeEmail();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testCandidateAssignmentEmail();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testSelfUpdateEmail();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('    Test Suite Complete');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\nPlease check your email inbox for the test emails.');
  console.log('Also check spam/junk folder if you don\'t see them.\n');
}

// Run the tests
runTests().catch(error => {
  console.error('\n❌ Fatal error running tests:', error);
  process.exit(1);
});
