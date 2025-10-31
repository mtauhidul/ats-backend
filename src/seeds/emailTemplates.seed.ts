import { EmailTemplate } from '../models/EmailTemplate';
import { connectDatabase } from '../config/database';

/**
 * Default email templates to seed into the database
 */
const defaultTemplates = [
  {
    name: 'Interview Invitation',
    subject: 'Interview Invitation for {{jobTitle}} at {{companyName}}',
    body: `Dear {{firstName}} {{lastName}},

We are pleased to invite you for an interview for the position of {{jobTitle}} at {{companyName}}.

Interview Details:
- Date: {{interviewDate}}
- Time: {{interviewTime}}
- Location/Link: {{interviewLocation}}
- Interviewer: {{interviewer}}

Please confirm your availability for this interview at your earliest convenience.

We look forward to speaking with you!

Best regards,
{{companyName}} Recruitment Team`,
    type: 'interview',
    isDefault: true,
  },
  {
    name: 'Job Offer Letter',
    subject: 'Job Offer - {{jobTitle}} at {{companyName}}',
    body: `Dear {{firstName}} {{lastName}},

Congratulations! We are delighted to offer you the position of {{jobTitle}} at {{companyName}}.

Offer Details:
- Position: {{jobTitle}}
- Start Date: {{startDate}}
- Salary: {{salary}}
- Location: {{location}}

Please review the attached documents and let us know your decision by {{offerDeadline}}.

We are excited about the prospect of you joining our team!

Best regards,
{{companyName}} HR Team`,
    type: 'offer',
    isDefault: true,
  },
  {
    name: 'Application Received',
    subject: 'Application Received - {{jobTitle}} at {{companyName}}',
    body: `Dear {{firstName}} {{lastName}},

Thank you for applying for the {{jobTitle}} position at {{companyName}}.

We have received your application and our recruitment team is currently reviewing all submissions. We will contact you if your qualifications match our requirements.

The review process typically takes 2-3 weeks. We appreciate your patience during this time.

Thank you for your interest in joining {{companyName}}.

Best regards,
{{companyName}} Recruitment Team`,
    type: 'application_received',
    isDefault: true,
  },
  {
    name: 'Rejection - Not Selected',
    subject: 'Update on Your Application - {{jobTitle}} at {{companyName}}',
    body: `Dear {{firstName}} {{lastName}},

Thank you for your interest in the {{jobTitle}} position at {{companyName}} and for taking the time to go through our selection process.

After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current requirements.

We appreciate the time and effort you invested in your application. We will keep your resume on file and may contact you if a suitable opportunity arises in the future.

We wish you all the best in your job search and future career endeavors.

Best regards,
{{companyName}} Recruitment Team`,
    type: 'rejection',
    isDefault: true,
  },
  {
    name: 'Follow-up Email',
    subject: 'Following Up - {{jobTitle}} Application at {{companyName}}',
    body: `Dear {{firstName}} {{lastName}},

I hope this email finds you well.

I wanted to follow up regarding your application for the {{jobTitle}} position at {{companyName}}. We are still in the process of reviewing applications and wanted to keep you updated on your status.

{{customMessage}}

If you have any questions or would like to provide additional information, please don't hesitate to reach out.

Thank you for your continued interest in {{companyName}}.

Best regards,
{{companyName}} Recruitment Team`,
    type: 'follow_up',
    isDefault: true,
  },
];

/**
 * Seed default email templates
 */
export async function seedEmailTemplates() {
  try {
    console.log('🌱 Seeding default email templates...');

    // Check if default templates already exist
    const existingTemplatesCount = await EmailTemplate.countDocuments({
      isDefault: true,
    });

    if (existingTemplatesCount > 0) {
      console.log(
        `✓ Default email templates already exist (${existingTemplatesCount} found). Skipping seed.`
      );
      return;
    }

    // Extract variables from each template and create
    const templatesWithVariables = defaultTemplates.map((template) => {
      const regex = /\{\{(\w+)\}\}/g;
      const variables: string[] = [];
      let match;

      while ((match = regex.exec(template.body + ' ' + template.subject)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }

      return {
        ...template,
        variables,
        isActive: true,
      };
    });

    // Insert all templates
    const result = await EmailTemplate.insertMany(templatesWithVariables);

    console.log(`✓ Successfully seeded ${result.length} default email templates`);
    console.log('  Templates created:');
    result.forEach((template) => {
      console.log(`  - ${template.name} (${template.type})`);
    });

    return result;
  } catch (error) {
    console.error('❌ Error seeding email templates:', error);
    throw error;
  }
}

/**
 * Run the seed script directly
 */
if (require.main === module) {
  (async () => {
    try {
      await connectDatabase();
      await seedEmailTemplates();
      console.log('\n✓ Email template seeding completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Email template seeding failed:', error);
      process.exit(1);
    }
  })();
}
