import * as fs from 'fs';
import * as path from 'path';
import { parseResumeWithFallback, validateParsedData } from '../src/services/enhancedResumeParser.service';
import openaiService from '../src/services/openai.service';

/**
 * Test script for enhanced resume parser
 * Usage: ts-node scripts/test-enhanced-parser.ts <path-to-resume.pdf>
 */

async function testParser() {
  const resumePath = process.argv[2];
  
  if (!resumePath) {
    console.error('❌ Please provide a resume file path');
    console.error('Usage: ts-node scripts/test-enhanced-parser.ts <path-to-resume.pdf>');
    process.exit(1);
  }
  
  if (!fs.existsSync(resumePath)) {
    console.error(`❌ File not found: ${resumePath}`);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING ENHANCED RESUME PARSER');
  console.log('='.repeat(80));
  console.log(`📄 File: ${path.basename(resumePath)}`);
  console.log(`📊 Size: ${(fs.statSync(resumePath).size / 1024).toFixed(2)} KB`);
  console.log('='.repeat(80) + '\n');
  
  try {
    // Read file
    const buffer = fs.readFileSync(resumePath);
    const filename = path.basename(resumePath);
    
    // Test 1: Triple fallback parsing
    console.log('TEST 1: Text Extraction with Triple Fallback');
    console.log('-'.repeat(80));
    const startExtract = Date.now();
    const { text, method } = await parseResumeWithFallback(buffer, filename);
    const extractDuration = Date.now() - startExtract;
    
    console.log(`✅ SUCCESS`);
    console.log(`   Method used: ${method}`);
    console.log(`   Characters extracted: ${text.length}`);
    console.log(`   Duration: ${extractDuration}ms`);
    console.log(`   First 200 chars: ${text.substring(0, 200)}...`);
    console.log('');
    
    // Test 2: AI Parsing with retry logic
    console.log('TEST 2: AI Parsing with Retry Logic');
    console.log('-'.repeat(80));
    const startParse = Date.now();
    const parsed = await openaiService.parseResume(text);
    const parseDuration = Date.now() - startParse;
    
    console.log(`✅ SUCCESS`);
    console.log(`   Duration: ${parseDuration}ms`);
    console.log('');
    console.log('   Personal Info:');
    console.log(`     Name: ${parsed.personalInfo?.firstName} ${parsed.personalInfo?.lastName}`);
    console.log(`     Email: ${parsed.personalInfo?.email}`);
    console.log(`     Phone: ${parsed.personalInfo?.phone || 'N/A'}`);
    console.log('');
    console.log(`   Current Position: ${parsed.currentTitle || 'N/A'}`);
    console.log(`   Current Company: ${parsed.currentCompany || 'N/A'}`);
    console.log(`   Years of Experience: ${parsed.yearsOfExperience || 0}`);
    console.log('');
    console.log(`   Skills: ${parsed.skills?.length || 0} found`);
    if (parsed.skills && parsed.skills.length > 0) {
      console.log(`     ${parsed.skills.slice(0, 10).join(', ')}${parsed.skills.length > 10 ? '...' : ''}`);
    }
    console.log('');
    console.log(`   Experience: ${parsed.experience?.length || 0} positions`);
    if (parsed.experience && parsed.experience.length > 0) {
      parsed.experience.forEach((exp, i) => {
        console.log(`     ${i + 1}. ${exp.title} at ${exp.company} (${exp.duration})`);
      });
    }
    console.log('');
    console.log(`   Education: ${parsed.education?.length || 0} degrees`);
    if (parsed.education && parsed.education.length > 0) {
      parsed.education.forEach((edu, i) => {
        console.log(`     ${i + 1}. ${edu.degree} in ${edu.field || 'N/A'} from ${edu.institution}`);
      });
    }
    console.log('');
    
    // Test 3: Validation
    console.log('TEST 3: Data Validation');
    console.log('-'.repeat(80));
    const candidateData = {
      firstName: parsed.personalInfo?.firstName,
      lastName: parsed.personalInfo?.lastName,
      email: parsed.personalInfo?.email,
    };
    
    const isValid = validateParsedData(candidateData);
    if (isValid) {
      console.log(`✅ VALID: Data passed validation`);
    } else {
      console.log(`❌ INVALID: Data contains placeholders or missing fields`);
    }
    console.log('');
    
    // Summary
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Text extraction: ${method} (${extractDuration}ms)`);
    console.log(`✅ AI parsing: OpenAI (${parseDuration}ms)`);
    console.log(`${isValid ? '✅' : '❌'} Validation: ${isValid ? 'Passed' : 'Failed'}`);
    console.log(`📈 Total duration: ${extractDuration + parseDuration}ms`);
    console.log('='.repeat(80) + '\n');
    
    // Full JSON output
    console.log('📋 FULL PARSED DATA (JSON):');
    console.log('-'.repeat(80));
    console.log(JSON.stringify(parsed, null, 2));
    console.log('');
    
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testParser().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
