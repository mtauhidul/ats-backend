import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../firebase_config.json'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const emailTemplates = [
  {
    name: 'Interview Invitation',
    subject: 'Interview Invitation for {{jobTitle}} at {{companyName}}',
    body: `Dear {{candidateName}},

We are pleased to invite you for an interview for the position of {{jobTitle}} at {{companyName}}.

Interview Details:
- Date: {{interviewDate}}
- Time: {{interviewTime}}
- Location: {{interviewLocation}}
- Duration: {{interviewDuration}}

Please confirm your availability by replying to this email.

We look forward to meeting you!

Best regards,
{{recruiterName}}
{{companyName}}`,
    type: 'interview',
    variables: ['candidateName', 'jobTitle', 'companyName', 'interviewDate', 'interviewTime', 'interviewLocation', 'interviewDuration', 'recruiterName'],
    isDefault: true,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    name: 'Job Offer',
    subject: 'Job Offer - {{jobTitle}} at {{companyName}}',
    body: `Dear {{candidateName}},

Congratulations! We are delighted to extend an offer of employment for the position of {{jobTitle}} at {{companyName}}.

Offer Details:
- Position: {{jobTitle}}
- Start Date: {{startDate}}
- Salary: {{salary}}
- Benefits: {{benefits}}

Please review the attached offer letter and let us know if you have any questions. We would appreciate your response by {{responseDeadline}}.

We are excited about the prospect of you joining our team!

Best regards,
{{recruiterName}}
{{companyName}}`,
    type: 'offer',
    variables: ['candidateName', 'jobTitle', 'companyName', 'startDate', 'salary', 'benefits', 'responseDeadline', 'recruiterName'],
    isDefault: true,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    name: 'Application Received',
    subject: 'Application Received - {{jobTitle}} at {{companyName}}',
    body: `Dear {{candidateName}},

Thank you for applying for the {{jobTitle}} position at {{companyName}}.

We have received your application and our team will review it carefully. If your qualifications match our requirements, we will contact you to discuss the next steps.

We appreciate your interest in joining our team.

Best regards,
{{recruiterName}}
{{companyName}}`,
    type: 'application_received',
    variables: ['candidateName', 'jobTitle', 'companyName', 'recruiterName'],
    isDefault: true,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    name: 'Rejection - After Interview',
    subject: 'Update on Your Application - {{jobTitle}}',
    body: `Dear {{candidateName}},

Thank you for taking the time to interview for the {{jobTitle}} position at {{companyName}}.

After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.

We were impressed by your background and appreciate your interest in our company. We encourage you to apply for future opportunities that align with your skills and experience.

We wish you the best in your job search.

Best regards,
{{recruiterName}}
{{companyName}}`,
    type: 'rejection',
    variables: ['candidateName', 'jobTitle', 'companyName', 'recruiterName'],
    isDefault: true,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    name: 'Follow-up After Application',
    subject: 'Following Up - {{jobTitle}} Application',
    body: `Dear {{candidateName}},

Thank you for your interest in the {{jobTitle}} position at {{companyName}}.

We wanted to provide you with an update on your application. Our team is currently reviewing all applications and we expect to complete the initial screening by {{screeningDeadline}}.

If you are selected to move forward in the process, we will contact you to schedule an interview.

Thank you for your patience.

Best regards,
{{recruiterName}}
{{companyName}}`,
    type: 'follow_up',
    variables: ['candidateName', 'jobTitle', 'companyName', 'screeningDeadline', 'recruiterName'],
    isDefault: true,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    name: 'General Communication',
    subject: 'Regarding Your Application - {{jobTitle}}',
    body: `Dear {{candidateName}},

I hope this email finds you well.

{{customMessage}}

If you have any questions, please don't hesitate to reach out.

Best regards,
{{recruiterName}}
{{companyName}}`,
    type: 'general',
    variables: ['candidateName', 'jobTitle', 'customMessage', 'recruiterName', 'companyName'],
    isDefault: false,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  }
];

async function seedEmailTemplates() {
  console.log('🌱 Starting email templates seeding...');
  
  try {
    const templatesRef = db.collection('emailTemplates');
    
    // Check if templates already exist
    const existingTemplates = await templatesRef.get();
    
    if (existingTemplates.size > 0) {
      console.log(`⚠️  Found ${existingTemplates.size} existing templates`);
      console.log('Do you want to continue? This will add new templates. (Existing templates will not be deleted)');
    }
    
    let addedCount = 0;
    
    for (const template of emailTemplates) {
      // Check if template with same name exists
      const existingQuery = await templatesRef.where('name', '==', template.name).get();
      
      if (existingQuery.empty) {
        await templatesRef.add(template);
        console.log(`✅ Added template: ${template.name}`);
        addedCount++;
      } else {
        console.log(`⏭️  Skipped (already exists): ${template.name}`);
      }
    }
    
    console.log(`\n✨ Seeding complete! Added ${addedCount} new templates.`);
    console.log(`📊 Total templates in database: ${existingTemplates.size + addedCount}`);
    
  } catch (error) {
    console.error('❌ Error seeding email templates:', error);
    throw error;
  }
}

// Run the seeding
seedEmailTemplates()
  .then(() => {
    console.log('✅ Email templates seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Email templates seeding failed:', error);
    process.exit(1);
  });
