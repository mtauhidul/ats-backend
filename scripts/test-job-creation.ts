import axios from 'axios';

async function testJobCreation() {
  try {
    // Login first
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'mislam.tauhidul@gmail.com',
      password: 'Aqsw1234'
    });
    
    const token = loginResponse.data.data.accessToken;
    console.log('✅ Logged in\n');
    
    // Test 1: Create job with string IDs (correct)
    console.log('📝 Test 1: Creating job with string IDs...');
    const job1Data = {
      title: 'Backend Developer (Test 1)',
      clientId: 'ogcoPMu2vRRgGOyxt0H1',
      categoryIds: ['BNubZTYgFsGgm0ow0Bx9'],
      description: 'Test job with correct string IDs',
      requirements: ['Node.js', 'TypeScript'],
      responsibilities: ['Build APIs'],
      location: 'Remote',
      locationType: 'remote',
      jobType: 'full_time',
      experienceLevel: 'mid',
      skills: ['Node.js'],
      tagIds: [],
      status: 'draft',
      openings: 1,
      priority: 'medium',
      recruiterIds: []
    };
    
    const job1Response = await axios.post('http://localhost:5001/api/jobs', job1Data, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Job 1 created:', job1Response.data.data.id);
    
    // Test 2: Create job with object IDs (incorrect - should be sanitized)
    console.log('\n📝 Test 2: Creating job with OBJECT IDs (should be sanitized)...');
    const job2Data = {
      title: 'Frontend Developer (Test 2)',
      clientId: {
        id: 'ogcoPMu2vRRgGOyxt0H1',
        _id: 'ogcoPMu2vRRgGOyxt0H1',
        companyName: 'TechCorp Solutions'
      },
      categoryIds: [
        {
          id: 'BNubZTYgFsGgm0ow0Bx9',
          name: 'Web'
        },
        {
          id: '6M4YiLEmMTuHlm4Yby89',
          name: 'UI'
        }
      ],
      description: 'Test job with object IDs',
      requirements: ['React'],
      responsibilities: ['Build UI'],
      location: 'Remote',
      locationType: 'remote',
      jobType: 'full_time',
      experienceLevel: 'mid',
      skills: ['React'],
      tagIds: [],
      status: 'draft',
      openings: 1,
      priority: 'medium',
      recruiterIds: []
    };
    
    const job2Response = await axios.post('http://localhost:5001/api/jobs', job2Data, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Job 2 created:', job2Response.data.data.id);
    
    // Verify in database
    console.log('\n🔍 Verifying database storage...');
    const { getFirestoreDB } = await import('../src/config/firebase');
    const db = getFirestoreDB();
    
    const job1Doc = await db.doc(`companies/default-company/jobs/${job1Response.data.data.id}`).get();
    const job2Doc = await db.doc(`companies/default-company/jobs/${job2Response.data.data.id}`).get();
    
    const job1Data_stored = job1Doc.data();
    const job2Data_stored = job2Doc.data();
    
    console.log('\n📊 Job 1 (created with strings):');
    console.log('   clientId type:', typeof job1Data_stored?.clientId);
    console.log('   categoryIds[0] type:', typeof job1Data_stored?.categoryIds?.[0]);
    
    console.log('\n📊 Job 2 (created with objects, SHOULD be sanitized):');
    console.log('   clientId type:', typeof job2Data_stored?.clientId);
    console.log('   clientId value:', job2Data_stored?.clientId);
    console.log('   categoryIds[0] type:', typeof job2Data_stored?.categoryIds?.[0]);
    console.log('   categoryIds[0] value:', job2Data_stored?.categoryIds?.[0]);
    
    if (typeof job2Data_stored?.clientId === 'string' && typeof job2Data_stored?.categoryIds?.[0] === 'string') {
      console.log('\n✅ SUCCESS: Job 2 was properly sanitized!');
    } else {
      console.log('\n❌ FAILED: Job 2 was NOT sanitized properly');
    }
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testJobCreation();
