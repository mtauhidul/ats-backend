/**
 * Firestore CRUD Operations Test
 * Simple test to verify Firestore connection and basic operations
 */

import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:5001';

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

async function testFirestoreConnection() {
  log('blue', '\n╔═══════════════════════════════════════════════════════════╗');
  log('blue', '║           Firestore Connection Test                      ║');
  log('blue', '╚═══════════════════════════════════════════════════════════╝\n');

  const tests = [
    {
      name: 'Health Check',
      method: 'GET',
      url: `${BASE_URL}/health`,
      description: 'Verify server is running',
    },
    {
      name: 'API Root',
      method: 'GET',
      url: `${BASE_URL}/api`,
      description: 'Verify API is accessible',
    },
    {
      name: 'Jobs List (Public)',
      method: 'GET',
      url: `${BASE_URL}/api/jobs`,
      description: 'Verify Firestore read operations',
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      log('yellow', `\n🧪 Test: ${test.name}`);
      log('cyan', `   ${test.description}`);
      log('cyan', `   → ${test.method} ${test.url}`);

      const response = await axios({
        method: test.method as 'GET' | 'POST',
        url: test.url,
        timeout: 5000,
        validateStatus: () => true, // Don't throw on any status
      });

      if (response.status === 200) {
        log('green', `   ✅ Status: ${response.status} - SUCCESS`);
        
        if (response.data) {
          if (test.name === 'Jobs List (Public)') {
            const jobCount = Array.isArray(response.data.data) ? response.data.data.length : 0;
            log('green', `   📊 Found ${jobCount} job(s) in Firestore`);
          }
        }
        
        passed++;
      } else {
        log('red', `   ❌ Status: ${response.status} - FAILED`);
        log('red', `   Error: ${response.data?.message || 'Unknown error'}`);
        failed++;
      }
    } catch (error: any) {
      log('red', `   ❌ FAILED - ${error.message}`);
      failed++;
    }
  }

  // Summary
  log('blue', '\n╔═══════════════════════════════════════════════════════════╗');
  log('blue', '║                    Test Summary                          ║');
  log('blue', '╚═══════════════════════════════════════════════════════════╝\n');
  
  log('cyan', `Total Tests: ${tests.length}`);
  log('green', `Passed: ${passed}/${tests.length}`);
  
  if (failed > 0) {
    log('red', `Failed: ${failed}/${tests.length}`);
  }
  
  log('cyan', `Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%\n`);

  if (passed === tests.length) {
    log('blue', '╔═══════════════════════════════════════════════════════════╗');
    log('blue', '║                 All Tests Passed! 🎉                     ║');
    log('blue', '╚═══════════════════════════════════════════════════════════╝\n');
    log('green', '✅ Server is running');
    log('green', '✅ API is responding');
    log('green', '✅ Firestore connection is working');
    log('green', '✅ Database read operations are functional\n');
    
    log('yellow', '📝 Note: For full CRUD testing, you need:');
    log('yellow', '   1. Valid authentication token (Clerk JWT)');
    log('yellow', '   2. Run tests against authenticated endpoints');
    log('yellow', '   3. Use frontend UI or Postman for manual testing\n');
    
    process.exit(0);
  } else {
    log('red', '\n⚠️  Some tests failed. Please check the errors above.\n');
    process.exit(1);
  }
}

// Run tests
log('blue', '\n🚀 Starting Firestore connection tests...\n');
testFirestoreConnection().catch((error) => {
  log('red', `\n❌ Unexpected error: ${error.message}`);
  log('red', `Stack: ${error.stack}\n`);
  process.exit(1);
});
