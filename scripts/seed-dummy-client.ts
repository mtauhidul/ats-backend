/**
 * Seed Dummy Client to Firestore
 * Creates a test client with sample data
 */

import { clientService } from '../src/services/firestore';
import type { IClient } from '../src/services/firestore/client.service';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function seedDummyClient() {
  log('blue', '\n╔═══════════════════════════════════════════════════════════╗');
  log('blue', '║           Seed Dummy Client to Firestore                 ║');
  log('blue', '╚═══════════════════════════════════════════════════════════╝\n');

  try {
    const dummyClient: Omit<IClient, 'id'> = {
      // Basic Information
      companyName: 'TechCorp Solutions Inc.',
      email: 'contact@techcorp-solutions.com',
      phone: '+1 (555) 123-4567',
      website: 'https://techcorp-solutions.com',
      logo: 'https://ui-avatars.com/api/?name=TechCorp+Solutions&background=0D8ABC&color=fff&size=200',

      // Classification
      industry: 'technology',
      companySize: '201-500',
      status: 'active',

      // Location
      address: {
        street: '123 Tech Boulevard, Suite 400',
        city: 'San Francisco',
        state: 'CA',
        country: 'United States',
        postalCode: '94105',
      },

      // Description
      description: 'TechCorp Solutions is a leading technology company specializing in enterprise software solutions, cloud infrastructure, and AI-powered analytics. We help businesses transform digitally and scale efficiently.',

      // Contacts
      contacts: [
        {
          name: 'John Smith',
          email: 'john.smith@techcorp-solutions.com',
          phone: '+1 (555) 123-4567',
          position: 'CEO & Founder',
          isPrimary: true,
        },
        {
          name: 'Sarah Johnson',
          email: 'sarah.johnson@techcorp-solutions.com',
          phone: '+1 (555) 123-4568',
          position: 'HR Director',
          isPrimary: false,
        },
        {
          name: 'Michael Chen',
          email: 'michael.chen@techcorp-solutions.com',
          phone: '+1 (555) 123-4569',
          position: 'VP of Engineering',
          isPrimary: false,
        },
      ],

      // Statistics (initial values)
      statistics: {
        totalJobs: 0,
        activeJobs: 0,
        closedJobs: 0,
        draftJobs: 0,
        totalCandidates: 0,
        activeCandidates: 0,
        hiredCandidates: 0,
        rejectedCandidates: 0,
        averageTimeToHire: 0,
        successRate: 0,
      },

      // Relations
      jobIds: [],

      // Communication Notes (initial)
      communicationNotes: [
        {
          id: `note_${Date.now()}`,
          clientId: '', // Will be set after creation
          type: 'meeting',
          subject: 'Initial Client Onboarding',
          content: 'Had initial meeting with John Smith to discuss hiring needs. They are looking to hire 5 software engineers and 2 product managers in Q1 2025. Budget approved.',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],

      // Activity History (initial)
      activityHistory: [
        {
          id: `activity_${Date.now()}`,
          action: 'client_created',
          description: 'Client account created by seed script',
          performedBy: 'system',
          performedByName: 'System',
          timestamp: new Date(),
        },
      ],

      // Metadata
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    log('yellow', '📝 Creating dummy client...');
    log('cyan', `   Company: ${dummyClient.companyName}`);
    log('cyan', `   Email: ${dummyClient.email}`);
    log('cyan', `   Industry: ${dummyClient.industry}`);
    log('cyan', `   Location: ${dummyClient.address?.city}, ${dummyClient.address?.state}`);
    log('cyan', `   Contacts: ${dummyClient.contacts?.length} contact(s)\n`);

    const clientId = await clientService.create(dummyClient);

    log('green', `✅ Client created successfully!`);
    log('green', `   Client ID: ${clientId}\n`);

    // Verify the client was created
    log('yellow', '🔍 Verifying client in database...');
    const createdClient = await clientService.findById(clientId);

    if (createdClient) {
      log('green', `✅ Verification successful!`);
      log('cyan', `   Company Name: ${createdClient.companyName}`);
      log('cyan', `   Status: ${createdClient.status}`);
      log('cyan', `   Industry: ${createdClient.industry}`);
      log('cyan', `   Created At: ${createdClient.createdAt}\n`);

      log('blue', '╔═══════════════════════════════════════════════════════════╗');
      log('blue', '║              Dummy Client Created! 🎉                    ║');
      log('blue', '╚═══════════════════════════════════════════════════════════╝\n');

      log('green', `📋 Client Details:`);
      log('green', `   ID: ${clientId}`);
      log('green', `   Company: ${createdClient.companyName}`);
      log('green', `   Email: ${createdClient.email}`);
      log('green', `   Phone: ${createdClient.phone}`);
      log('green', `   Website: ${createdClient.website}`);
      log('green', `   Industry: ${createdClient.industry}`);
      log('green', `   Size: ${createdClient.companySize}`);
      log('green', `   Status: ${createdClient.status}`);
      log('green', `   Primary Contact: ${createdClient.contacts?.[0].name} (${createdClient.contacts?.[0].position})`);
      log('green', `\n✅ You can now use this client for testing!\n`);

      process.exit(0);
    } else {
      throw new Error('Client was created but verification failed');
    }
  } catch (error: any) {
    log('red', `\n❌ Error: ${error.message}`);
    log('red', `Stack: ${error.stack}\n`);
    process.exit(1);
  }
}

// Run the seed script
log('blue', '\n🚀 Starting client seed script...\n');
seedDummyClient();
