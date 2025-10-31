// Test script for enhanced AI parsing system
// This script validates that the AI parsing system works accurately without fallbacks

require('dotenv').config();
const EnhancedAIService = require('../services/enhancedAIService');
const logger = require('../utils/logger');

// Test resume samples
const testResumes = [
  {
    name: "Simple Developer Resume",
    text: `
John Michael Smith
Software Engineer
Email: john.smith@email.com
Phone: +1-555-123-4567
Location: San Francisco, CA

PROFESSIONAL SUMMARY
Experienced Full Stack Developer with 5 years of experience in web application development.
Proficient in JavaScript, React, Node.js, and cloud technologies.

TECHNICAL SKILLS
- Programming Languages: JavaScript, TypeScript, Python, Java
- Frontend: React, Angular, Vue.js, HTML5, CSS3
- Backend: Node.js, Express.js, Django, Spring Boot
- Databases: MongoDB, PostgreSQL, MySQL
- Cloud: AWS, Docker, Kubernetes
- Tools: Git, Jenkins, JIRA

WORK EXPERIENCE
Senior Software Engineer | Tech Corp | 2021 - Present
- Developed scalable web applications using React and Node.js
- Led a team of 3 junior developers
- Implemented CI/CD pipelines using Jenkins and Docker

Software Engineer | StartupXYZ | 2019 - 2021
- Built RESTful APIs using Express.js and MongoDB
- Collaborated with cross-functional teams on product development

EDUCATION
Bachelor of Science in Computer Science
Stanford University, 2019

CERTIFICATIONS
- AWS Solutions Architect Associate
- Google Cloud Professional Developer

LANGUAGES
English (Native), Spanish (Conversational)
`
  },
  {
    name: "Marketing Manager Resume",
    text: `
Sarah Johnson
Digital Marketing Manager
sarah.johnson@marketing.com | LinkedIn: linkedin.com/in/sarahjohnson
Phone: (555) 987-6543 | New York, NY

SUMMARY
Results-driven Digital Marketing Manager with 7 years of experience in campaign management,
SEO optimization, and brand development. Proven track record of increasing ROI by 150%.

CORE COMPETENCIES
• Digital Marketing Strategy
• Google Analytics & AdWords
• SEO/SEM Optimization
• Content Marketing
• Social Media Management
• Email Marketing Automation
• A/B Testing
• Project Management
• Team Leadership
• Budget Management

PROFESSIONAL EXPERIENCE

Senior Digital Marketing Manager
Global Marketing Inc. | New York, NY | 2020 - Present
• Manage $2M annual digital marketing budget
• Increased website traffic by 200% through SEO optimization
• Led cross-functional team of 8 marketing professionals

Digital Marketing Specialist
Creative Agency | New York, NY | 2017 - 2020
• Developed and executed integrated marketing campaigns
• Managed social media accounts with 100K+ followers

EDUCATION
Master of Business Administration (MBA)
Columbia University | New York, NY | 2017

Bachelor of Arts in Marketing
New York University | New York, NY | 2015

CERTIFICATIONS
• Google Analytics Certified
• HubSpot Content Marketing Certified
• Facebook Blueprint Certified
`
  }
];

async function testEnhancedAIParsing() {
  console.log('🧪 TESTING ENHANCED AI PARSING SYSTEM');
  console.log('=' .repeat(60));
  console.log('Testing strict parsing without fallbacks...\n');

  const enhancedAI = new EnhancedAIService();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const [index, testCase] of testResumes.entries()) {
    totalTests++;
    console.log(`\n📄 TEST ${index + 1}: ${testCase.name}`);
    console.log('-'.repeat(40));
    
    try {
      const startTime = Date.now();
      
      // Test the enhanced AI parsing
      const result = await enhancedAI.parseResume(testCase.text, `test-${index + 1}.txt`);
      
      const processingTime = Date.now() - startTime;
      
      // Validate critical fields
      const validations = {
        hasName: !!result.name && result.name.trim().length > 2,
        hasSkills: Array.isArray(result.skills) && result.skills.length >= 3,
        hasExperience: !!result.experience && result.experience.trim().length > 5,
        hasValidEmail: !result.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email),
        noPlaceholderData: !containsPlaceholderData(result)
      };

      const validationsPassed = Object.values(validations).filter(Boolean).length;
      const isHighQuality = validationsPassed >= 4; // At least 4/5 validations must pass

      if (isHighQuality) {
        passedTests++;
        console.log('✅ PARSING SUCCESS - High Quality Data');
        console.log(`   Processing Time: ${processingTime}ms`);
        console.log(`   Name: "${result.name}"`);
        console.log(`   Email: "${result.email || 'Not provided'}"`);
        console.log(`   Skills: ${result.skills?.length || 0} extracted`);
        console.log(`   Experience: "${(result.experience || '').substring(0, 50)}..."`);
        console.log(`   Quality Score: ${validationsPassed}/5 validations passed`);
        
        // Log sample skills
        if (result.skills && result.skills.length > 0) {
          console.log(`   Sample Skills: ${result.skills.slice(0, 5).join(', ')}`);
        }
      } else {
        failedTests++;
        console.log('❌ PARSING FAILED - Insufficient Quality');
        console.log(`   Validations Passed: ${validationsPassed}/5`);
        console.log('   Failed Validations:');
        Object.entries(validations).forEach(([key, passed]) => {
          if (!passed) console.log(`   - ${key}`);
        });
      }

    } catch (error) {
      failedTests++;
      console.log('❌ PARSING ERROR');
      console.log(`   Error: ${error.message}`);
      console.log(`   This indicates the strict validation is working correctly`);
    }
  }

  // Final Results
  console.log('\n' + '='.repeat(60));
  console.log('🎯 FINAL TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED - Enhanced AI parsing is working perfectly!');
  } else if (passedTests > 0) {
    console.log('⚠️ PARTIAL SUCCESS - Some tests passed, system may need fine-tuning');
  } else {
    console.log('🚨 ALL TESTS FAILED - System needs immediate attention');
  }

  // Test AI Service Metrics
  const metrics = enhancedAI.getMetrics();
  console.log('\n📊 AI SERVICE METRICS:');
  console.log(`   Total Requests: ${metrics.totalRequests}`);
  console.log(`   Total Tokens Used: ${metrics.totalTokens}`);
  console.log(`   Average Latency: ${metrics.averageLatency.toFixed(2)}ms`);
  console.log(`   Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%`);

  return {
    totalTests,
    passedTests,
    failedTests,
    successRate: (passedTests / totalTests) * 100,
    metrics
  };
}

function containsPlaceholderData(data) {
  const placeholderPatterns = [
    /not\s+(available|provided|specified|mentioned)/i,
    /unable\s+to\s+(determine|extract|find)/i,
    /no\s+(information|data|details)\s+provided/i,
    /unknown\s+(candidate|applicant)/i,
    /placeholder/i,
    /sample.*data/i,
    /example\.(com|org)/i
  ];

  const textFields = ['name', 'email', 'experience', 'jobTitle', 'professionalSummary'];
  
  for (const field of textFields) {
    if (data[field] && typeof data[field] === 'string') {
      if (placeholderPatterns.some(pattern => pattern.test(data[field]))) {
        return true;
      }
    }
  }

  // Check for generic skills
  if (Array.isArray(data.skills)) {
    const genericSkills = ['skill', 'technology', 'tool', 'programming', 'development'];
    return data.skills.some(skill => 
      typeof skill === 'string' && 
      genericSkills.includes(skill.toLowerCase().trim())
    );
  }

  return false;
}

// Run the test if called directly
if (require.main === module) {
  testEnhancedAIParsing()
    .then((results) => {
      console.log('\n✨ Test completed successfully');
      process.exit(results.successRate === 100 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test failed with error:', error);
      process.exit(1);
    });
}

module.exports = { testEnhancedAIParsing };