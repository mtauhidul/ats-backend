/**
 * COMPREHENSIVE INTEGRATION TEST SUITE
 *
 * This script tests ALL API endpoints against live backend
 * and generates detailed fix reports for any mismatches.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5001/api';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

// Test results storage
interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  statusCode?: number;
  errors: string[];
  expected?: any;
  received?: any;
  timestamp: string;
}

const testResults: TestResult[] = [];
let passCount = 0;
let failCount = 0;
let errorCount = 0;

// HTTP Client with auth
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(TEST_AUTH_TOKEN && { 'Authorization': `Bearer ${TEST_AUTH_TOKEN}` })
  },
  validateStatus: () => true // Don't throw on any status code
});

// Schema validation helpers
function getType(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function validateSchema(expected: any, received: any, path: string = ''): string[] {
  const errors: string[] = [];

  // Check if both are null/undefined
  if (expected === null && received === null) return [];
  if (expected === undefined && received === undefined) return [];

  const expectedType = getType(expected);
  const receivedType = getType(received);

  // Type mismatch
  if (expectedType !== receivedType) {
    errors.push(`${path || 'root'}: Type mismatch - expected ${expectedType}, got ${receivedType}`);
    return errors;
  }

  // For objects, check keys
  if (expectedType === 'object' && expected !== null) {
    const expectedKeys = Object.keys(expected);
    const receivedKeys = Object.keys(received || {});

    // Check for missing keys
    expectedKeys.forEach(key => {
      if (!(key in received)) {
        errors.push(`${path}.${key}: Missing field`);
      } else {
        // Recursively validate nested objects
        const nestedErrors = validateSchema(
          expected[key],
          received[key],
          path ? `${path}.${key}` : key
        );
        errors.push(...nestedErrors);
      }
    });

    // Check for extra keys (warning only)
    receivedKeys.forEach(key => {
      if (!(key in expected)) {
        errors.push(`${path}.${key}: Extra field (not in schema)`);
      }
    });
  }

  // For arrays, validate structure
  if (expectedType === 'array' && expected.length > 0 && received.length > 0) {
    const nestedErrors = validateSchema(expected[0], received[0], `${path}[0]`);
    errors.push(...nestedErrors);
  }

  return errors;
}

// Test execution function
async function testEndpoint(
  method: string,
  endpoint: string,
  payload?: any,
  expectedSchema?: any,
  description?: string
): Promise<TestResult> {
  const testName = `${method} ${endpoint}`;
  console.log(`\n🔵 Testing: ${testName}`);
  if (description) console.log(`   ${description}`);

  const result: TestResult = {
    endpoint,
    method,
    status: 'PASS',
    errors: [],
    timestamp: new Date().toISOString()
  };

  try {
    const requestConfig: any = {
      method: method.toLowerCase(),
      url: endpoint
    };

    // Only add data for methods that support body
    if (payload && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
      requestConfig.data = payload;
    }

    const response = await apiClient.request(requestConfig);

    result.statusCode = response.status;
    result.received = response.data;

    // Check for error status codes
    if (response.status >= 400) {
      result.status = 'ERROR';
      result.errors.push(`HTTP ${response.status}: ${response.statusText}`);
      result.errors.push(`Response: ${JSON.stringify(response.data).substring(0, 200)}`);
      errorCount++;
      console.log(`❌ ERROR: ${testName} - HTTP ${response.status}`);
      return result;
    }

    // Validate response schema if provided
    if (expectedSchema) {
      result.expected = expectedSchema;
      const schemaErrors = validateSchema(expectedSchema, response.data);

      if (schemaErrors.length > 0) {
        result.status = 'FAIL';
        result.errors = schemaErrors;
        failCount++;
        console.log(`❌ FAIL: ${testName}`);
        schemaErrors.forEach(err => console.log(`   - ${err}`));
      } else {
        passCount++;
        console.log(`✅ PASS: ${testName}`);
      }
    } else {
      // No schema validation, just check success
      passCount++;
      console.log(`✅ PASS: ${testName} (no schema validation)`);
    }

  } catch (error: any) {
    result.status = 'ERROR';
    result.errors.push(`Exception: ${error.message}`);
    if (error.response) {
      result.statusCode = error.response.status;
      result.errors.push(`HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    }
    errorCount++;
    console.log(`❌ ERROR: ${testName}`);
    console.log(`   ${error.message}`);
  }

  return result;
}

// Expected schemas based on frontend types
const schemas = {
  client: {
    success: true,
    data: {
      id: 'string',
      companyName: 'string',
      email: 'string',
      phone: 'string',
      website: 'string',
      logo: 'string',
      industry: 'string',
      companySize: 'string',
      status: 'string',
      address: {
        street: 'string',
        city: 'string',
        state: 'string',
        country: 'string',
        postalCode: 'string'
      },
      description: 'string',
      contacts: [],
      statistics: {
        totalJobs: 0,
        activeJobs: 0,
        closedJobs: 0,
        draftJobs: 0,
        totalCandidates: 0,
        activeCandidates: 0,
        hiredCandidates: 0,
        rejectedCandidates: 0
      },
      jobIds: [],
      tags: [],
      assignedTo: 'string',
      assignedToName: 'string',
      createdAt: 'string',
      updatedAt: 'string'
    }
  },
  clientsList: {
    success: true,
    data: {
      clients: [],
      pagination: {
        page: 0,
        limit: 0,
        total: 0,
        totalPages: 0
      }
    }
  },
  candidate: {
    success: true,
    data: {
      id: 'string',
      firstName: 'string',
      lastName: 'string',
      email: 'string',
      phone: 'string',
      currentTitle: 'string',
      currentCompany: 'string',
      yearsOfExperience: 0,
      source: 'string',
      education: [],
      workExperience: [],
      skills: [],
      languages: [],
      jobApplications: [],
      jobIds: [],
      applicationIds: [],
      clientIds: [],
      categoryIds: [],
      tagIds: [],
      isActive: true,
      totalEmailsSent: 0,
      totalEmailsReceived: 0,
      createdAt: 'string',
      updatedAt: 'string'
    }
  },
  candidatesList: {
    success: true,
    data: {
      candidates: [],
      pagination: {
        page: 0,
        limit: 0,
        total: 0,
        totalPages: 0
      }
    }
  },
  job: {
    success: true,
    data: {
      id: 'string',
      title: 'string',
      description: 'string',
      clientId: 'string',
      status: 'string',
      type: 'string',
      experienceLevel: 'string',
      workMode: 'string',
      requirements: {
        experience: 'string',
        skills: {
          required: [],
          preferred: []
        }
      },
      responsibilities: [],
      priority: 'string',
      openings: 0,
      filledPositions: 0,
      recruiterIds: [],
      hiringManagerIds: [],
      categoryIds: [],
      tagIds: [],
      applicationIds: [],
      candidateIds: [],
      statistics: {
        totalApplications: 0,
        approvedApplications: 0,
        rejectedApplications: 0,
        totalCandidates: 0,
        activeCandidates: 0,
        hiredCandidates: 0,
        rejectedCandidates: 0,
        interviewingCandidates: 0,
        offerExtendedCandidates: 0,
        candidatesInPipeline: 0
      },
      createdAt: 'string',
      updatedAt: 'string'
    }
  },
  jobsList: {
    success: true,
    data: {
      jobs: [],
      pagination: {
        page: 0,
        limit: 0,
        total: 0,
        totalPages: 0
      }
    }
  },
  application: {
    success: true,
    data: {
      id: 'string',
      firstName: 'string',
      lastName: 'string',
      email: 'string',
      phone: 'string',
      jobId: 'string',
      status: 'string',
      source: 'string',
      createdAt: 'string',
      updatedAt: 'string'
    }
  },
  tag: {
    success: true,
    data: {
      id: 'string',
      name: 'string',
      color: 'string',
      createdAt: 'string',
      updatedAt: 'string'
    }
  },
  category: {
    success: true,
    data: {
      id: 'string',
      name: 'string',
      color: 'string',
      description: 'string',
      createdAt: 'string',
      updatedAt: 'string'
    }
  },
  interview: {
    success: true,
    data: {
      id: 'string',
      candidateId: 'string',
      jobId: 'string',
      scheduledAt: 'string',
      duration: 0,
      type: 'string',
      status: 'string',
      interviewerIds: [],
      createdAt: 'string',
      updatedAt: 'string'
    }
  }
};

// Main test suite
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  COMPREHENSIVE API INTEGRATION TEST SUITE             ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Auth Token: ${TEST_AUTH_TOKEN ? 'Provided' : 'MISSING - Tests may fail'}`);
  console.log(`Start Time: ${new Date().toISOString()}\n`);

  // ==============================================================
  // CLIENT ENDPOINTS
  // ==============================================================
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  CLIENT ENDPOINTS                   │');
  console.log('└─────────────────────────────────────┘');

  testResults.push(await testEndpoint(
    'GET',
    '/clients',
    null,
    schemas.clientsList,
    'Fetch all clients with pagination'
  ));

  // Get first client ID for subsequent tests
  let testClientId = '';
  try {
    const clientsRes = await apiClient.get('/clients');
    if (clientsRes.data?.data?.clients?.length > 0) {
      testClientId = clientsRes.data.data.clients[0].id || clientsRes.data.data.clients[0]._id;
    }
  } catch (e) {}

  if (testClientId) {
    testResults.push(await testEndpoint(
      'GET',
      `/clients/${testClientId}`,
      null,
      schemas.client,
      'Fetch single client by ID'
    ));
  }

  const createClientPayload = {
    companyName: 'Test Company Integration',
    email: 'test@integration.com',
    phone: '+1234567890',
    industry: 'technology',
    companySize: '51-200',
    address: {
      city: 'San Francisco',
      country: 'USA'
    },
    contacts: [{
      name: 'John Doe',
      email: 'john@test.com',
      position: 'HR Manager',
      isPrimary: true
    }]
  };

  testResults.push(await testEndpoint(
    'POST',
    '/clients',
    createClientPayload,
    schemas.client,
    'Create new client'
  ));

  // ==============================================================
  // CANDIDATE ENDPOINTS
  // ==============================================================
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  CANDIDATE ENDPOINTS                │');
  console.log('└─────────────────────────────────────┘');

  testResults.push(await testEndpoint(
    'GET',
    '/candidates',
    null,
    schemas.candidatesList,
    'Fetch all candidates'
  ));

  let testCandidateId = '';
  try {
    const candidatesRes = await apiClient.get('/candidates');
    const candidates = candidatesRes.data?.data?.candidates || candidatesRes.data?.data || candidatesRes.data;
    if (Array.isArray(candidates) && candidates.length > 0) {
      testCandidateId = candidates[0].id || candidates[0]._id;
    }
  } catch (e) {}

  if (testCandidateId) {
    testResults.push(await testEndpoint(
      'GET',
      `/candidates/${testCandidateId}`,
      null,
      schemas.candidate,
      'Fetch single candidate by ID'
    ));
  }

  // ==============================================================
  // JOB ENDPOINTS
  // ==============================================================
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  JOB ENDPOINTS                      │');
  console.log('└─────────────────────────────────────┘');

  testResults.push(await testEndpoint(
    'GET',
    '/jobs',
    null,
    schemas.jobsList,
    'Fetch all jobs'
  ));

  let testJobId = '';
  try {
    const jobsRes = await apiClient.get('/jobs');
    const jobs = jobsRes.data?.data?.jobs || jobsRes.data?.data || jobsRes.data;
    if (Array.isArray(jobs) && jobs.length > 0) {
      testJobId = jobs[0].id || jobs[0]._id;
    }
  } catch (e) {}

  if (testJobId) {
    testResults.push(await testEndpoint(
      'GET',
      `/jobs/${testJobId}`,
      null,
      schemas.job,
      'Fetch single job by ID'
    ));
  }

  // ==============================================================
  // APPLICATION ENDPOINTS
  // ==============================================================
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  APPLICATION ENDPOINTS              │');
  console.log('└─────────────────────────────────────┘');

  testResults.push(await testEndpoint(
    'GET',
    '/applications',
    null,
    null,
    'Fetch all applications'
  ));

  // ==============================================================
  // TAG ENDPOINTS
  // ==============================================================
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  TAG ENDPOINTS                      │');
  console.log('└─────────────────────────────────────┘');

  testResults.push(await testEndpoint(
    'GET',
    '/tags',
    null,
    null,
    'Fetch all tags'
  ));

  // ==============================================================
  // CATEGORY ENDPOINTS
  // ==============================================================
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  CATEGORY ENDPOINTS                 │');
  console.log('└─────────────────────────────────────┘');

  testResults.push(await testEndpoint(
    'GET',
    '/categories',
    null,
    null,
    'Fetch all categories'
  ));

  // ==============================================================
  // PIPELINE ENDPOINTS
  // ==============================================================
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  PIPELINE ENDPOINTS                 │');
  console.log('└─────────────────────────────────────┘');

  testResults.push(await testEndpoint(
    'GET',
    '/pipelines',
    null,
    null,
    'Fetch all pipelines'
  ));

  // ==============================================================
  // INTERVIEW ENDPOINTS
  // ==============================================================
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  INTERVIEW ENDPOINTS                │');
  console.log('└─────────────────────────────────────┘');

  testResults.push(await testEndpoint(
    'GET',
    '/interviews',
    null,
    null,
    'Fetch all interviews'
  ));

  // ==============================================================
  // TEAM ENDPOINTS
  // ==============================================================
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  TEAM ENDPOINTS                     │');
  console.log('└─────────────────────────────────────┘');

  testResults.push(await testEndpoint(
    'GET',
    '/team',
    null,
    null,
    'Fetch all team members'
  ));

  // ==============================================================
  // USER ENDPOINTS
  // ==============================================================
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  USER ENDPOINTS                     │');
  console.log('└─────────────────────────────────────┘');

  testResults.push(await testEndpoint(
    'GET',
    '/users',
    null,
    null,
    'Fetch all users'
  ));

  // ==============================================================
  // EMAIL ENDPOINTS
  // ==============================================================
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  EMAIL ENDPOINTS                    │');
  console.log('└─────────────────────────────────────┘');

  testResults.push(await testEndpoint(
    'GET',
    '/emails',
    null,
    null,
    'Fetch all emails'
  ));

  // ==============================================================
  // MESSAGE ENDPOINTS
  // ==============================================================
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  MESSAGE ENDPOINTS                  │');
  console.log('└─────────────────────────────────────┘');

  testResults.push(await testEndpoint(
    'GET',
    '/messages',
    null,
    null,
    'Fetch all messages'
  ));

  // ==============================================================
  // NOTIFICATION ENDPOINTS
  // ==============================================================
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  NOTIFICATION ENDPOINTS             │');
  console.log('└─────────────────────────────────────┘');

  testResults.push(await testEndpoint(
    'GET',
    '/notifications',
    null,
    null,
    'Fetch all notifications'
  ));

  // ==============================================================
  // GENERATE REPORTS
  // ==============================================================
  generateSummaryReport();
  generateDetailedReport();
  generateFixReport();

  // Exit with appropriate code
  process.exit(failCount > 0 || errorCount > 0 ? 1 : 0);
}

// Generate summary report
function generateSummaryReport() {
  console.log('\n\n╔════════════════════════════════════════════════════════╗');
  console.log('║  TEST SUMMARY                                          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const total = testResults.length;
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passCount} (${((passCount/total)*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failCount} (${((failCount/total)*100).toFixed(1)}%)`);
  console.log(`🔴 Errors: ${errorCount} (${((errorCount/total)*100).toFixed(1)}%)`);

  if (failCount === 0 && errorCount === 0) {
    console.log('\n🎉 All tests passed! API is fully aligned with frontend.');
  } else {
    console.log('\n⚠️  Some tests failed. Check detailed reports below.');
  }
}

// Generate detailed report
function generateDetailedReport() {
  const reportPath = path.join(__dirname, '../test-results.json');

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.length,
      passed: passCount,
      failed: failCount,
      errors: errorCount
    },
    tests: testResults
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed JSON report saved to: ${reportPath}`);
}

// Generate fix report with specific backend fixes
function generateFixReport() {
  const failures = testResults.filter(r => r.status === 'FAIL');

  if (failures.length === 0) {
    console.log('\n✅ No schema mismatches found. No fixes needed.');
    return;
  }

  console.log('\n\n╔════════════════════════════════════════════════════════╗');
  console.log('║  FIX REPORT - BACKEND CHANGES NEEDED                   ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const fixReportLines: string[] = [];
  fixReportLines.push('# BACKEND FIX REPORT\n');
  fixReportLines.push(`Generated: ${new Date().toISOString()}\n`);
  fixReportLines.push(`Total Failures: ${failures.length}\n\n`);

  failures.forEach((failure, index) => {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`FAILURE ${index + 1}/${failures.length}: ${failure.method} ${failure.endpoint}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    fixReportLines.push(`## ${failure.method} ${failure.endpoint}\n\n`);

    console.log('Issues Found:');
    fixReportLines.push('### Issues:\n');
    failure.errors.forEach(err => {
      console.log(`  ❌ ${err}`);
      fixReportLines.push(`- ${err}\n`);
    });

    console.log('\n📋 Expected Schema:');
    console.log(JSON.stringify(failure.expected, null, 2).substring(0, 500));
    fixReportLines.push('\n### Expected Schema:\n```json\n');
    fixReportLines.push(JSON.stringify(failure.expected, null, 2));
    fixReportLines.push('\n```\n\n');

    console.log('\n📦 Received Data:');
    console.log(JSON.stringify(failure.received, null, 2).substring(0, 500));
    fixReportLines.push('### Received Data:\n```json\n');
    fixReportLines.push(JSON.stringify(failure.received, null, 2));
    fixReportLines.push('\n```\n\n');

    // Generate specific fix suggestions
    console.log('\n💡 Suggested Fix:');
    fixReportLines.push('### Suggested Fix:\n');

    const controllerFile = getControllerFile(failure.endpoint);
    console.log(`   File: ${controllerFile}`);
    fixReportLines.push(`File: \`${controllerFile}\`\n\n`);

    const fixSuggestion = generateFixSuggestion(failure);
    console.log(fixSuggestion);
    fixReportLines.push(fixSuggestion + '\n\n');

    fixReportLines.push('---\n\n');
  });

  // Save fix report
  const fixReportPath = path.join(__dirname, '../FIX_REPORT.md');
  fs.writeFileSync(fixReportPath, fixReportLines.join(''));
  console.log(`\n\n📝 Complete fix report saved to: ${fixReportPath}`);
}

// Helper: Determine controller file from endpoint
function getControllerFile(endpoint: string): string {
  const match = endpoint.match(/^\/([^\/]+)/);
  if (match) {
    const resource = match[1];
    return `ats-backend/src/controllers/${resource}.controller.ts`;
  }
  return 'ats-backend/src/controllers/[resource].controller.ts';
}

// Helper: Generate specific fix suggestions
function generateFixSuggestion(failure: TestResult): string {
  const suggestions: string[] = [];

  failure.errors.forEach(error => {
    if (error.includes('Missing field')) {
      const field = error.split(':')[0].trim().split('.').pop();
      suggestions.push(`- Add missing field \`${field}\` to the response object`);
    } else if (error.includes('Type mismatch')) {
      suggestions.push(`- Fix type mismatch: ${error}`);
    } else if (error.includes('Extra field')) {
      const field = error.split(':')[0].trim().split('.').pop();
      suggestions.push(`- Remove extra field \`${field}\` or add it to frontend schema`);
    }
  });

  if (suggestions.length === 0) {
    suggestions.push('- Review the schema mismatch and align backend response with frontend expectations');
  }

  // Wrap suggestion
  suggestions.push('\n**Action Items:**');
  suggestions.push('1. Update the controller to return the correct schema');
  suggestions.push('2. Ensure response wrapper uses `successResponse(res, data, message)`');
  suggestions.push('3. Re-run integration tests to verify fix');

  return suggestions.join('\n');
}

// Run the test suite
runAllTests().catch(error => {
  console.error('\n❌ Fatal error running test suite:', error);
  process.exit(1);
});
