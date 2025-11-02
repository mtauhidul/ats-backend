/**
 * API Endpoint Testing Script
 * Tests all major endpoints to verify Firestore integration
 */

import axios from 'axios';
import { config } from '../src/config';

const API_URL = `http://localhost:${config.port}/api`;
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  statusCode?: number;
  message?: string;
  error?: string;
}

const results: TestResult[] = [];

// Test authentication token (you'll need to get a real one from Clerk)
let authToken = process.env.TEST_AUTH_TOKEN || '';

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function addResult(result: TestResult) {
  results.push(result);
  const statusColor = result.status === 'PASS' ? 'green' : result.status === 'FAIL' ? 'red' : 'yellow';
  log(statusColor, `${result.status} - ${result.method} ${result.endpoint} ${result.message || ''}`);
}

async function testEndpoint(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  requiresAuth = true
): Promise<TestResult> {
  try {
    const headers: any = { 'Content-Type': 'application/json' };
    if (requiresAuth && authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await axios({
      method,
      url: `${API_URL}${endpoint}`,
      data,
      headers,
      validateStatus: () => true, // Don't throw on any status
    });

    const isSuccess = response.status >= 200 && response.status < 300;
    return {
      endpoint,
      method,
      status: isSuccess ? 'PASS' : 'FAIL',
      statusCode: response.status,
      message: `Status: ${response.status}`,
    };
  } catch (error: any) {
    return {
      endpoint,
      method,
      status: 'FAIL',
      error: error.message,
    };
  }
}

async function runTests() {
  log('blue', '\n╔═══════════════════════════════════════════════════════════╗');
  log('blue', '║          ATS API Endpoint Testing Suite                  ║');
  log('blue', '╚═══════════════════════════════════════════════════════════╝\n');

  // Check if server is running
  try {
    await axios.get(`http://localhost:${config.port}/health`);
    log('green', '✅ Server is running\n');
  } catch (error) {
    log('red', '❌ Server is not running. Please start it with: npm run dev');
    process.exit(1);
  }

  // Test public endpoints (no auth required)
  log('yellow', '\n📋 Testing Public Endpoints:\n');
  addResult(await testEndpoint('GET', '/health', undefined, false));
  addResult(await testEndpoint('GET', '', undefined, false));

  // Test authentication endpoints
  log('yellow', '\n🔐 Testing Authentication Endpoints:\n');
  addResult(await testEndpoint('POST', '/auth/webhook', { type: 'user.created' }, false));

  if (!authToken) {
    log('yellow', '\n⚠️  No TEST_AUTH_TOKEN found in .env. Skipping authenticated endpoints.');
    log('yellow', '   To test authenticated endpoints, add a valid Clerk JWT token to .env:\n');
    log('yellow', '   TEST_AUTH_TOKEN=your-token-here\n');
  } else {
    // Test User endpoints
    log('yellow', '\n👤 Testing User Endpoints:\n');
    addResult(await testEndpoint('GET', '/users/me'));
    addResult(await testEndpoint('GET', '/users'));

    // Test Candidate endpoints
    log('yellow', '\n👥 Testing Candidate Endpoints:\n');
    addResult(await testEndpoint('GET', '/candidates'));
    addResult(await testEndpoint('GET', '/candidates/stats'));

    // Test Job endpoints
    log('yellow', '\n💼 Testing Job Endpoints:\n');
    addResult(await testEndpoint('GET', '/jobs'));
    addResult(await testEndpoint('GET', '/jobs/stats'));

    // Test Application endpoints
    log('yellow', '\n📄 Testing Application Endpoints:\n');
    addResult(await testEndpoint('GET', '/applications'));
    addResult(await testEndpoint('GET', '/applications/stats'));

    // Test Client endpoints
    log('yellow', '\n🏢 Testing Client Endpoints:\n');
    addResult(await testEndpoint('GET', '/clients'));
    addResult(await testEndpoint('GET', '/clients/stats'));

    // Test Pipeline endpoints
    log('yellow', '\n🔄 Testing Pipeline Endpoints:\n');
    addResult(await testEndpoint('GET', '/pipelines'));

    // Test Category endpoints
    log('yellow', '\n📂 Testing Category Endpoints:\n');
    addResult(await testEndpoint('GET', '/categories'));

    // Test Tag endpoints
    log('yellow', '\n🏷️  Testing Tag Endpoints:\n');
    addResult(await testEndpoint('GET', '/tags'));

    // Test Interview endpoints
    log('yellow', '\n📅 Testing Interview Endpoints:\n');
    addResult(await testEndpoint('GET', '/interviews'));

    // Test Email endpoints
    log('yellow', '\n📧 Testing Email Endpoints:\n');
    addResult(await testEndpoint('GET', '/emails'));

    // Test Notification endpoints
    log('yellow', '\n🔔 Testing Notification Endpoints:\n');
    addResult(await testEndpoint('GET', '/notifications'));

    // Test Message endpoints
    log('yellow', '\n💬 Testing Message Endpoints:\n');
    addResult(await testEndpoint('GET', '/messages'));

    // Test Team Member endpoints
    log('yellow', '\n👥 Testing Team Member Endpoints:\n');
    addResult(await testEndpoint('GET', '/team'));

    // Test Email Account endpoints
    log('yellow', '\n📬 Testing Email Account Endpoints:\n');
    addResult(await testEndpoint('GET', '/email-accounts'));

    // Test Email Template endpoints
    log('yellow', '\n📝 Testing Email Template Endpoints:\n');
    addResult(await testEndpoint('GET', '/email-templates'));

    // Test Activity endpoints
    log('yellow', '\n📊 Testing Activity Endpoints:\n');
    addResult(await testEndpoint('GET', '/activity/me'));

    // Test Settings endpoints
    log('yellow', '\n⚙️  Testing Settings Endpoints:\n');
    addResult(await testEndpoint('GET', '/settings/system'));
  }

  // Print summary
  log('blue', '\n╔═══════════════════════════════════════════════════════════╗');
  log('blue', '║                    Test Summary                           ║');
  log('blue', '╚═══════════════════════════════════════════════════════════╝\n');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const total = results.length;

  log('green', `✅ Passed: ${passed}/${total}`);
  if (failed > 0) log('red', `❌ Failed: ${failed}/${total}`);
  if (skipped > 0) log('yellow', `⏭️  Skipped: ${skipped}/${total}`);

  if (failed > 0) {
    log('red', '\n❌ Failed Tests:');
    results
      .filter((r) => r.status === 'FAIL')
      .forEach((r) => {
        console.log(`   ${r.method} ${r.endpoint} - ${r.error || r.message}`);
      });
  }

  log('blue', '\n═══════════════════════════════════════════════════════════\n');

  const successRate = ((passed / total) * 100).toFixed(1);
  log('blue', `Success Rate: ${successRate}%\n`);

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  log('red', `\n❌ Test suite failed: ${error.message}`);
  process.exit(1);
});
