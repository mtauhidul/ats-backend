import { getFirestoreDB } from '../src/config/firebase';
import openaiService from '../src/services/openai.service';

const manualResumeText = `Gregorio Alba

+63 967 359 2363 | greghizar@gmail.com

EXPERIENCE

Oct 2024 — Oct 2025
AR Follow up
ASC STRATEGIC Revenue Solutions, LLC | 115-10 Myrtle Avenue Richmond Hill, NY 11418

• Verified patient insurance eligibility and benefits via calls and portals
• Followed up on claims and resolved denials
• Checked claim status through payer portals and calls
• Updated billing records and documentation
• Handled data entry, emails, and administrative tasks
• Assisted providers with billing concerns

April 2022 — Oct 2024
Customer Service Representative II
VXI Global Holdings B.V | Robinsons Delta, Bajada, Davao City, Philippines, 8000

• Provided customer support via phone, chat, and email
• Handled billing inquiries, disputes, and account updates
• Ensured accurate documentation and empathetic service
• Resolved issues promptly while maintaining high satisfaction scores

EDUCATION

2022-2025 Davao de Oro State College
Poblacion Compostela Davao de Oro, Philippines | Graduate
Bachelor of Elementary Education

SKILLS

Customer Service, Insurance Verification, Claim Denial Management, Data Entry & Accuracy, Eligibility & Benefits Verification and Administrative Support

PERSONAL INFORMATION
Status: Single
I.D.: Philippine Passport

REFERENCES

Chrysler Elison
Subject matter expert
Phone: 09057315079

John Mark Sucayan Olaer
Team Leader
Phone: 09275593120`;

async function fixGregorioAlba() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  FIX GREGORIO ALBA APPLICATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const db = getFirestoreDB();
    
    // Find Gregorio Alba's application
    console.log('🔍 Searching for Gregorio Alba (gregbizar@gmail.com)...');
    const applicationsSnapshot = await db
      .collection('applications')
      .where('email', '==', 'gregbizar@gmail.com')
      .get();

    if (applicationsSnapshot.empty) {
      console.log('❌ Application not found!');
      process.exit(1);
    }

    const doc = applicationsSnapshot.docs[0];
    const app = doc.data();
    
    console.log('✅ Found application:');
    console.log(`   Current name: ${app.firstName} ${app.lastName}`);
    console.log(`   Current text length: ${app.resumeRawText?.length || 0} chars\n`);

    // Parse resume with OpenAI
    console.log('🤖 Parsing resume with OpenAI...');
    const parsedData = await openaiService.parseResume(manualResumeText);
    
    if (!parsedData) {
      console.log('❌ Failed to parse resume!');
      process.exit(1);
    }

    console.log('✅ Parsing successful!\n');

    // Validate resume
    console.log('🔍 Validating resume...');
    const validation = await openaiService.validateResume(manualResumeText);
    console.log(`✅ Validation: ${validation.isValid ? 'VALID' : 'INVALID'} (score: ${validation.score}/100)\n`);

    // Prepare update data
    const updateData = {
      firstName: parsedData.personalInfo?.firstName || 'Gregorio',
      lastName: parsedData.personalInfo?.lastName || 'Alba',
      resumeRawText: manualResumeText,
      parsedData: parsedData,
      aiCheckStatus: 'completed',
      isValidResume: validation.isValid,
      phone: parsedData.personalInfo?.phone || '+63 967 359 2363',
      updatedAt: new Date(),
    };

    console.log('📝 Update details:');
    console.log(`   Name: ${app.firstName} ${app.lastName} → ${updateData.firstName} ${updateData.lastName}`);
    console.log(`   Resume text: ${app.resumeRawText?.length || 0} → ${updateData.resumeRawText.length} chars`);
    console.log(`   Phone: ${updateData.phone}`);
    console.log(`   AI Status: ${app.aiCheckStatus} → ${updateData.aiCheckStatus}`);
    console.log(`   Valid: ${updateData.isValidResume}\n`);

    // Update Firestore
    console.log('💾 Updating Firestore...');
    await doc.ref.update(updateData);
    
    console.log('✅ Successfully updated Gregorio Alba\'s application!\n');
    
    console.log('════════════════════════════════════════════════════════════');
    console.log('✅ COMPLETED');
    console.log('════════════════════════════════════════════════════════════');
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the fix
fixGregorioAlba();
