import { getFirestoreDB } from '../src/config/firebase';
import openaiService from '../src/services/openai.service';
import axios from 'axios';

interface CorruptedApplication {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  resumeUrl: string;
  resumeRawText: string;
  parsedData: any;
}

/**
 * Download resume file from URL
 */
async function downloadResume(url: string): Promise<Buffer> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    return Buffer.from(response.data);
  } catch (error: any) {
    throw new Error(`Failed to download resume: ${error.message}`);
  }
}

/**
 * Find all corrupted applications
 * Criteria: 
 * - resumeRawText is empty or very short (< 50 chars)
 * - OR firstName/lastName contains suspicious values (Unknown, Candidate, Moinur)
 */
async function findCorruptedApplications(): Promise<CorruptedApplication[]> {
  console.log('🔍 Searching for corrupted applications...\n');
  
  const db = getFirestoreDB();
  const applicationsSnapshot = await db.collection('applications').get();
  
  const corrupted: CorruptedApplication[] = [];
  
  applicationsSnapshot.forEach((doc: any) => {
    const app = doc.data();
    const resumeRawTextLength = app.resumeRawText?.length || 0;
    
    // Check for corruption indicators
    const hasEmptyResumeText = resumeRawTextLength < 50;
    const hasSuspiciousName = 
      app.firstName?.toLowerCase() === 'unknown' ||
      app.lastName?.toLowerCase() === 'candidate' ||
      app.firstName?.toLowerCase()?.includes('moinur') ||
      app.lastName?.toLowerCase()?.includes('hossain');
    const hasResumeUrl = !!app.resumeUrl;
    const isPendingAICheck = app.aiCheckStatus === 'pending';
    
    if ((hasEmptyResumeText || hasSuspiciousName || isPendingAICheck) && hasResumeUrl) {
      corrupted.push({
        id: doc.id,
        email: app.email,
        firstName: app.firstName,
        lastName: app.lastName,
        resumeUrl: app.resumeUrl,
        resumeRawText: app.resumeRawText || '',
        parsedData: app.parsedData,
      });
    }
  });
  
  return corrupted;
}

/**
 * Fix a single corrupted application
 */
async function fixApplication(app: CorruptedApplication, dryRun: boolean = false): Promise<boolean> {
  try {
    console.log(`\n📄 Processing: ${app.firstName} ${app.lastName} (${app.email})`);
    console.log(`   Resume URL: ${app.resumeUrl}`);
    console.log(`   Current text length: ${app.resumeRawText?.length || 0} chars`);
    
    // Download resume
    console.log('   ⬇️  Downloading resume...');
    const resumeBuffer = await downloadResume(app.resumeUrl);
    console.log(`   ✅ Downloaded ${resumeBuffer.length} bytes`);
    
    // Parse resume directly (this will extract text and parse in one step)
    console.log('   🤖 Parsing resume with AI...');
    let resumeRawText = '';
    let parsedData = null;
    
    try {
      // Try standard text extraction first
      console.log('   📄 Attempting standard text extraction...');
      try {
        const fileType = app.resumeUrl.toLowerCase().includes('.pdf') ? 'pdf' :
                        app.resumeUrl.toLowerCase().includes('.docx') ? 'docx' : 'doc';
        resumeRawText = await openaiService.extractTextFromResume(resumeBuffer, fileType);
        
        if (resumeRawText && resumeRawText.trim().length >= 50) {
          console.log(`   ✅ Standard extraction successful (${resumeRawText.length} chars)`);
          // Now parse the extracted text
          parsedData = await openaiService.parseResume(resumeRawText);
          console.log(`   ✅ Parsing successful`);
        } else {
          throw new Error('Standard extraction produced insufficient text');
        }
      } catch (extractError: any) {
        console.log(`   ⚠️  Standard extraction failed: ${extractError.message}`);
        console.log('   🔄 Trying OCR with OpenAI Vision API...');
        
        // For PDFs, try Adobe PDF Services (includes OCR for scanned documents)
        if (app.resumeUrl.toLowerCase().includes('.pdf')) {
          try {
            console.log('   🔄 Trying Adobe PDF Services (with OCR)...');
            const adobePDFService = require('../src/services/adobe-pdf.service').default;
            
            if (!adobePDFService.isAvailable()) {
              throw new Error('Adobe PDF Services not configured');
            }
            
            resumeRawText = await adobePDFService.extractTextWithRetry(resumeBuffer);
            
            if (resumeRawText && resumeRawText.trim().length >= 50) {
              console.log(`   ✅ Adobe PDF extraction successful (${resumeRawText.length} chars)`);
              // Now parse the extracted text
              parsedData = await openaiService.parseResume(resumeRawText);
              console.log(`   ✅ Parsing successful`);
            } else {
              throw new Error('Adobe PDF extraction produced insufficient text');
            }
          } catch (adobeError: any) {
            console.log(`   ❌ Adobe PDF extraction failed: ${adobeError.message}`);
            
            // Final fallback: try pdf2json
            try {
              console.log('   🔄 Trying alternative PDF parser (pdf2json)...');
              const pdf2json = require('pdf2json');
              const pdfParser = new pdf2json();
              
              await new Promise((resolve, reject) => {
                pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
                  try {
                    const texts: string[] = [];
                    if (pdfData.Pages) {
                      for (const page of pdfData.Pages) {
                        if (page.Texts) {
                          for (const text of page.Texts) {
                            if (text.R && text.R[0] && text.R[0].T) {
                              const decoded = decodeURIComponent(text.R[0].T);
                              texts.push(decoded);
                            }
                          }
                        }
                      }
                    }
                    resumeRawText = texts.join(' ').trim();
                    resolve(resumeRawText);
                  } catch (parseErr) {
                    reject(parseErr);
                  }
                });
                
                pdfParser.on('pdfParser_dataError', (errData: any) => {
                  reject(new Error(errData.parserError || 'PDF parsing failed'));
                });
                
                pdfParser.parseBuffer(resumeBuffer);
              });
              
              if (resumeRawText && resumeRawText.trim().length >= 50) {
                console.log(`   ✅ Alternative PDF extraction successful (${resumeRawText.length} chars)`);
                parsedData = await openaiService.parseResume(resumeRawText);
                console.log(`   ✅ Parsing successful`);
              } else {
                throw new Error('All PDF extraction methods produced insufficient text');
              }
            } catch (finalPdfError: any) {
              console.log(`   ❌ All PDF extraction methods failed: ${finalPdfError.message}`);
              throw new Error('All extraction methods failed');
            }
          }
        } else {
          throw new Error('Non-PDF document and standard extraction failed');
        }
      }
    } catch (finalError: any) {
      console.log(`   ❌ All parsing attempts failed: ${finalError.message}`);
    }
    
    if (!resumeRawText || resumeRawText.trim().length < 50) {
      console.log(`   ❌ FAILED: Extracted text is too short (${resumeRawText?.length || 0} chars)`);
      console.log('   ℹ️  This file may be corrupted or in an unsupported format');
      return false;
    }
    
    console.log(`   ✅ Extracted ${resumeRawText.length} characters`);
    
    // If we don't have parsed data yet (meaning both parsing methods above failed), 
    // try one more time with just the text
    if (!parsedData && resumeRawText) {
      console.log('   🤖 Attempting final parse with extracted text...');
      try {
        parsedData = await openaiService.parseResume(resumeRawText);
        console.log(`   ✅ Parsed successfully`);
      } catch (finalError: any) {
        console.log(`   ⚠️  Final parse attempt failed: ${finalError.message}`);
      }
    }
    
    // Validate resume
    console.log('   🔍 Validating resume...');
    let validationResult = null;
    try {
      validationResult = await openaiService.validateResume(resumeRawText);
      console.log(`   ✅ Validation: ${validationResult.isValid ? 'VALID' : 'INVALID'} (score: ${validationResult.score}/100)`);
    } catch (validationError) {
      console.log('   ⚠️  Validation failed, continuing without validation data');
    }
    
    // Prepare update data
    const updateData: any = {
      resumeRawText,
      parsedData,
      aiCheckStatus: 'completed',
      aiCheckCompletedAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Update name if parsed successfully
    if (parsedData?.personalInfo?.firstName) {
      updateData.firstName = parsedData.personalInfo.firstName;
      console.log(`   📝 Name update: ${app.firstName} → ${parsedData.personalInfo.firstName}`);
    }
    if (parsedData?.personalInfo?.lastName) {
      updateData.lastName = parsedData.personalInfo.lastName;
      console.log(`   📝 Last name update: ${app.lastName} → ${parsedData.personalInfo.lastName}`);
    }
    if (parsedData?.personalInfo?.phone) {
      updateData.phone = parsedData.personalInfo.phone;
    }
    
    // Update validation results if available
    if (validationResult) {
      updateData.isValidResume = validationResult.isValid;
      updateData.validationScore = validationResult.score;
      updateData.validationReason = validationResult.reason;
    }
    
    if (dryRun) {
      console.log('   🔍 DRY RUN - Would update with:');
      console.log(`      - resumeRawText: ${resumeRawText.length} chars`);
      console.log(`      - firstName: ${updateData.firstName || app.firstName}`);
      console.log(`      - lastName: ${updateData.lastName || app.lastName}`);
      console.log(`      - phone: ${updateData.phone || 'N/A'}`);
      console.log(`      - aiCheckStatus: completed`);
      console.log(`      - isValidResume: ${updateData.isValidResume ?? 'N/A'}`);
      return true;
    }
    
    // Update Firestore
    const db = getFirestoreDB();
    await db.collection('applications').doc(app.id).update(updateData);
    
    console.log(`   ✅ FIXED: Application updated successfully!`);
    console.log(`      New name: ${updateData.firstName || app.firstName} ${updateData.lastName || app.lastName}`);
    
    return true;
  } catch (error: any) {
    console.error(`   ❌ ERROR fixing application: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const autoFix = args.includes('--fix') || args.includes('-f');
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  FIX CORRUPTED APPLICATIONS SCRIPT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : autoFix ? '🔧 AUTO FIX' : '👁️  INSPECTION ONLY'}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    // Find corrupted applications
    const corruptedApps = await findCorruptedApplications();
    
    if (corruptedApps.length === 0) {
      console.log('✅ No corrupted applications found! All good!');
      process.exit(0);
      return;
    }
    
    console.log(`\n⚠️  Found ${corruptedApps.length} potentially corrupted application(s):\n`);
    
    // Display summary
    corruptedApps.forEach((app, index) => {
      console.log(`${index + 1}. ${app.firstName} ${app.lastName} (${app.email})`);
      console.log(`   - Resume text: ${app.resumeRawText?.length || 0} chars`);
      console.log(`   - AI check: ${app.parsedData ? '✅ Has parsed data' : '❌ No parsed data'}`);
      console.log(`   - Resume URL: ${app.resumeUrl.substring(0, 60)}...`);
      console.log('');
    });
    
    if (!autoFix && !dryRun) {
      console.log('\n💡 To fix these applications, run:');
      console.log('   - Dry run (see what would change): pnpm tsx scripts/fix-corrupted-applications.ts --dry-run');
      console.log('   - Actually fix them: pnpm tsx scripts/fix-corrupted-applications.ts --fix');
      process.exit(0);
      return;
    }
    
    // Process each application
    console.log('\n' + '═'.repeat(60));
    console.log(dryRun ? 'DRY RUN - Processing applications...' : 'FIXING applications...');
    console.log('═'.repeat(60));
    
    let successCount = 0;
    let failCount = 0;
    
    for (const app of corruptedApps) {
      const success = await fixApplication(app, dryRun);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Final summary
    console.log('\n' + '═'.repeat(60));
    console.log('SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total processed: ${corruptedApps.length}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    
    if (dryRun) {
      console.log('\n💡 This was a dry run. No changes were made.');
      console.log('   Run with --fix to actually fix the applications.');
    } else if (autoFix) {
      console.log('\n✅ All fixes have been applied!');
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the script
main();
