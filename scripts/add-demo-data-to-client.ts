/**
 * Add Demo Data to Existing Client in Firestore
 * Updates client with comprehensive technology company data
 * Target Client ID: bweo9z1wcKQrwsPK8lBJ
 */

import { clientService } from '../src/services/firestore';
import type { IClient } from '../src/services/firestore/client.service';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
};

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const CLIENT_ID = 'bweo9z1wcKQrwsPK8lBJ';

async function addDemoDataToClient() {
  log('blue', '\n╔═══════════════════════════════════════════════════════════╗');
  log('blue', '║        Add Demo Data to Existing Client                  ║');
  log('blue', '╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // First, verify the client exists
    log('yellow', `🔍 Checking if client exists...`);
    const existingClient = await clientService.findById(CLIENT_ID);

    if (!existingClient) {
      log('red', `❌ Client with ID ${CLIENT_ID} not found!`);
      log('yellow', '\nPlease verify the client ID and try again.\n');
      process.exit(1);
    }

    log('green', `✅ Client found: ${existingClient.companyName || 'Unnamed'}\n`);

    // Prepare comprehensive demo data for a technology company
    const demoData: Partial<IClient> = {
      // Basic Information
      companyName: 'InnovateTech Solutions',
      email: 'contact@innovatetech.com',
      phone: '+1 (415) 555-0123',
      website: 'https://www.innovatetech.com',
      logo: 'https://ui-avatars.com/api/?name=InnovateTech+Solutions&background=667eea&color=fff&size=200',

      // Classification
      industry: 'technology',
      companySize: '201-500',
      status: 'active',

      // Location
      address: {
        street: '350 Mission Street, Floor 15',
        city: 'San Francisco',
        state: 'California',
        country: 'United States',
        postalCode: '94105',
      },

      // Description
      description: 'InnovateTech Solutions is a cutting-edge technology company specializing in AI-powered enterprise solutions, cloud infrastructure, and digital transformation services. We partner with Fortune 500 companies to modernize their tech stack and drive innovation. Our expertise spans machine learning, DevOps, cybersecurity, and full-stack development. With a team of 350+ talented engineers and consultants, we deliver scalable solutions that transform businesses.',

      // Contacts
      contacts: [
        {
          id: `contact_${Date.now()}_1`,
          name: 'Jennifer Martinez',
          email: 'j.martinez@innovatetech.com',
          phone: '+1 (415) 555-0123',
          position: 'Chief Technology Officer',
          isPrimary: true,
        },
        {
          id: `contact_${Date.now()}_2`,
          name: 'David Chen',
          email: 'd.chen@innovatetech.com',
          phone: '+1 (415) 555-0124',
          position: 'VP of Engineering',
          isPrimary: false,
        },
        {
          id: `contact_${Date.now()}_3`,
          name: 'Sarah Williams',
          email: 's.williams@innovatetech.com',
          phone: '+1 (415) 555-0125',
          position: 'Head of People & Culture',
          isPrimary: false,
        },
        {
          id: `contact_${Date.now()}_4`,
          name: 'Michael Thompson',
          email: 'm.thompson@innovatetech.com',
          phone: '+1 (415) 555-0126',
          position: 'Director of Talent Acquisition',
          isPrimary: false,
        },
      ],

      // Statistics (based on actual data: 1 job, 2 candidates, 0 active, 1 hired)
      statistics: {
        totalJobs: 1,
        activeJobs: 0,
        closedJobs: 1,
        draftJobs: 0,
        totalCandidates: 2,
        activeCandidates: 0,
        hiredCandidates: 1,
        rejectedCandidates: 1,
        averageTimeToHire: 28, // days
        successRate: 50, // percentage (1 hired out of 2)
      },

      // Communication Notes
      communicationNotes: [
        {
          id: `note_${Date.now()}_1`,
          clientId: CLIENT_ID,
          type: 'meeting',
          subject: 'Q1 2025 Hiring Strategy Planning',
          content: 'Met with Jennifer Martinez (CTO) and Michael Thompson (Talent Director) to discuss Q1 hiring goals. Key points: 1) Need to hire 15 senior engineers (Full-Stack, Backend, Frontend), 2) Looking for 3 DevOps engineers with Kubernetes expertise, 3) 2 Product Managers with B2B SaaS experience, 4) Budget approved for $2.5M in Q1 hiring. Timeline: Start posting jobs by mid-January, complete hires by end of March.',
          createdBy: 'system',
          createdByName: 'Recruitment Team',
          createdAt: new Date('2025-01-05'),
          updatedAt: new Date('2025-01-05'),
        },
        {
          id: `note_${Date.now()}_2`,
          clientId: CLIENT_ID,
          type: 'phone',
          subject: 'Urgent: Senior Backend Developer Need',
          content: 'Phone call with David Chen - urgent need for 2 Senior Backend Developers (Python/Go). Project starting Feb 1st. Ideal candidates should have: 5+ years experience, microservices architecture, AWS/GCP, strong system design skills. Salary range: $150K-$200K. Fast-track interview process approved.',
          createdBy: 'system',
          createdByName: 'Recruitment Team',
          createdAt: new Date('2025-01-12'),
          updatedAt: new Date('2025-01-12'),
        },
        {
          id: `note_${Date.now()}_3`,
          clientId: CLIENT_ID,
          type: 'email',
          subject: 'Feedback on Recent Candidates',
          content: 'Received feedback from technical interviews. Candidates showed strong technical skills but need better communication abilities. Updating job requirements to emphasize collaboration and communication skills. Also increasing compensation package to remain competitive in the market.',
          createdBy: 'system',
          createdByName: 'Recruitment Team',
          createdAt: new Date('2025-01-18'),
          updatedAt: new Date('2025-01-18'),
        },
        {
          id: `note_${Date.now()}_4`,
          clientId: CLIENT_ID,
          type: 'video_call',
          subject: 'Successful Hires Review',
          content: 'Video call with Sarah Williams to review successful hires from Q4 2024. 8 engineers onboarded successfully. Feedback very positive. Discussing referral bonus program to incentivize employee referrals. InnovateTech happy with quality of candidates and speed of hiring process.',
          createdBy: 'system',
          createdByName: 'Recruitment Team',
          createdAt: new Date('2025-01-10'),
          updatedAt: new Date('2025-01-10'),
        },
        {
          id: `note_${Date.now()}_5`,
          clientId: CLIENT_ID,
          type: 'meeting',
          subject: 'Engineering Team Expansion Plan',
          content: 'Strategic planning session for 2025. InnovateTech planning major expansion: New offices in Austin, TX and Seattle, WA. Will need 50+ engineers across all locations in 2025. Breakdown: 20 Full-Stack, 15 Backend, 10 Frontend, 5 Mobile, 8 DevOps, 2 Security Engineers. Multi-phase hiring approach discussed. Partnership extended through 2025.',
          createdBy: 'system',
          createdByName: 'Recruitment Team',
          createdAt: new Date('2025-01-15'),
          updatedAt: new Date('2025-01-15'),
        },
      ],

      // Activity History
      activityHistory: [
        {
          id: `activity_${Date.now()}_1`,
          action: 'client_created',
          description: 'Client account initially created',
          performedBy: 'system',
          performedByName: 'System',
          timestamp: new Date('2024-12-01'),
        },
        {
          id: `activity_${Date.now()}_2`,
          action: 'client_updated',
          description: 'Updated company information and contacts',
          performedBy: 'system',
          performedByName: 'Admin',
          timestamp: new Date('2024-12-15'),
        },
        {
          id: `activity_${Date.now()}_3`,
          action: 'job_posted',
          description: 'Posted Senior Full-Stack Engineer position',
          performedBy: 'system',
          performedByName: 'Jennifer Martinez',
          timestamp: new Date('2025-01-08'),
        },
        {
          id: `activity_${Date.now()}_4`,
          action: 'candidate_hired',
          description: 'Hired Sarah Johnson as Senior Backend Developer',
          performedBy: 'system',
          performedByName: 'Michael Thompson',
          timestamp: new Date('2025-01-20'),
        },
        {
          id: `activity_${Date.now()}_5`,
          action: 'contract_renewed',
          description: 'Recruitment partnership extended through 2025',
          performedBy: 'system',
          performedByName: 'Admin',
          timestamp: new Date('2025-01-15'),
        },
        {
          id: `activity_${Date.now()}_6`,
          action: 'demo_data_added',
          description: 'Comprehensive demo data added to client profile',
          performedBy: 'system',
          performedByName: 'System Script',
          timestamp: new Date(),
        },
      ],

      // Metadata
      updatedBy: 'demo-script',
      updatedAt: new Date(),
    };

    log('yellow', '📝 Updating client with demo data...\n');
    log('cyan', '   📋 Company Information');
    log('cyan', `      Name: ${demoData.companyName}`);
    log('cyan', `      Industry: ${demoData.industry}`);
    log('cyan', `      Size: ${demoData.companySize}`);
    log('cyan', `      Location: ${demoData.address?.city}, ${demoData.address?.state}`);
    
    log('cyan', '\n   👥 Contacts: ' + demoData.contacts?.length);
    demoData.contacts?.forEach((contact, idx) => {
      log('cyan', `      ${idx + 1}. ${contact.name} - ${contact.position}`);
    });

    log('cyan', '\n   📊 Statistics');
    log('cyan', `      Total Jobs: ${demoData.statistics?.totalJobs}`);
    log('cyan', `      Active Jobs: ${demoData.statistics?.activeJobs}`);
    log('cyan', `      Total Candidates: ${demoData.statistics?.totalCandidates}`);
    log('cyan', `      Hired: ${demoData.statistics?.hiredCandidates}`);
    log('cyan', `      Success Rate: ${demoData.statistics?.successRate}%`);

    log('cyan', '\n   💬 Communication Notes: ' + demoData.communicationNotes?.length);
    log('cyan', '   📜 Activity History: ' + demoData.activityHistory?.length);
    log('cyan', '');

    // Update the client
    await clientService.update(CLIENT_ID, demoData);

    log('green', `✅ Client updated successfully!\n`);

    // Verify the update
    log('yellow', '🔍 Verifying updated client data...');
    const updatedClient = await clientService.findById(CLIENT_ID);

    if (updatedClient) {
      log('green', `✅ Verification successful!\n`);

      log('blue', '╔═══════════════════════════════════════════════════════════╗');
      log('blue', '║           Demo Data Added Successfully! 🎉               ║');
      log('blue', '╚═══════════════════════════════════════════════════════════╝\n');

      log('magenta', '📋 Updated Client Summary:');
      log('green', `   ID: ${CLIENT_ID}`);
      log('green', `   Company: ${updatedClient.companyName}`);
      log('green', `   Email: ${updatedClient.email}`);
      log('green', `   Phone: ${updatedClient.phone}`);
      log('green', `   Website: ${updatedClient.website}`);
      log('green', `   Industry: ${updatedClient.industry}`);
      log('green', `   Size: ${updatedClient.companySize}`);
      log('green', `   Status: ${updatedClient.status}`);
      log('green', `   Location: ${updatedClient.address?.city}, ${updatedClient.address?.state}, ${updatedClient.address?.country}`);
      log('green', `   Contacts: ${updatedClient.contacts?.length} contact(s)`);
      log('green', `   Primary Contact: ${updatedClient.contacts?.find(c => c.isPrimary)?.name} (${updatedClient.contacts?.find(c => c.isPrimary)?.position})`);
      log('green', `   Communication Notes: ${updatedClient.communicationNotes?.length} note(s)`);
      log('green', `   Activity History: ${updatedClient.activityHistory?.length} event(s)`);

      log('magenta', '\n📊 Statistics:');
      log('green', `   Total Jobs: ${updatedClient.statistics?.totalJobs}`);
      log('green', `   Active Jobs: ${updatedClient.statistics?.activeJobs}`);
      log('green', `   Total Candidates: ${updatedClient.statistics?.totalCandidates}`);
      log('green', `   Active Candidates: ${updatedClient.statistics?.activeCandidates}`);
      log('green', `   Hired: ${updatedClient.statistics?.hiredCandidates}`);
      log('green', `   Average Time to Hire: ${updatedClient.statistics?.averageTimeToHire} days`);
      log('green', `   Success Rate: ${updatedClient.statistics?.successRate}%`);

      log('cyan', '\n✅ The client now has comprehensive demo data!');
      log('cyan', '✅ You can view this client in the dashboard for testing.\n');

      process.exit(0);
    } else {
      throw new Error('Client was updated but verification failed');
    }
  } catch (error: any) {
    log('red', `\n❌ Error: ${error.message}`);
    if (error.stack) {
      log('red', `Stack: ${error.stack}\n`);
    }
    process.exit(1);
  }
}

// Run the script
log('blue', '\n🚀 Starting demo data addition script...\n');
addDemoDataToClient();
