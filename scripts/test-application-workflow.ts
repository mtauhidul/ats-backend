import axios from 'axios';

async function testApplicationWorkflow() {
  try {
    // Login
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'mislam.tauhidul@gmail.com',
      password: 'Aqsw1234'
    });
    
    const token = loginResponse.data.data.accessToken;
    console.log('✅ Logged in\n');
    
    // Get first job
    const jobsResponse = await axios.get('http://localhost:5001/api/jobs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const job = jobsResponse.data.data.jobs[0];
    if (!job) {
      console.log('❌ No jobs found. Please create a job first.');
      process.exit(1);
    }
    
    console.log(`📋 Using job: ${job.title} (ID: ${job.id})\n`);
    
    // Step 1: Create application (pending status)
    console.log('📝 Step 1: Creating application...');
    const applicationData = {
      firstName: 'John',
      lastName: 'Doe',
      email: `test-${Date.now()}@example.com`, // Unique email
      phone: '+1234567890',
      jobId: job.id,
      source: 'manual',
      resumeUrl: 'https://example.com/resume.pdf',
      resumeOriginalName: 'john-doe-resume.pdf',
      coverLetter: 'I am very interested in this position.',
      parsedData: {
        summary: 'Experienced developer',
        skills: ['JavaScript', 'React', 'Node.js'],
        experience: [
          {
            company: 'Tech Corp',
            position: 'Senior Developer',
            startDate: '2020-01-01',
            endDate: '2024-01-01',
            description: 'Built web applications'
          }
        ],
        education: [
          {
            institution: 'University',
            degree: 'Bachelor of Science',
            field: 'Computer Science',
            graduationDate: '2019-05-01'
          }
        ]
      }
    };
    
    const appResponse = await axios.post('http://localhost:5001/api/applications', applicationData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const application = appResponse.data.data;
    console.log(`✅ Application created: ${application.id}`);
    console.log(`   Status: ${application.status}`);
    console.log(`   Job ID: ${application.jobId || 'null'}`);
    console.log(`   Candidate ID: ${application.candidateId || 'null'}`);
    
    // Step 2: Get application details
    console.log('\n📖 Step 2: Fetching application details...');
    const appDetailResponse = await axios.get(`http://localhost:5001/api/applications/${application.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const appDetail = appDetailResponse.data.data;
    console.log(`✅ Application retrieved`);
    console.log(`   Name: ${appDetail.firstName} ${appDetail.lastName}`);
    console.log(`   Email: ${appDetail.email}`);
    console.log(`   Status: ${appDetail.status}`);
    
    // Step 3: Approve application (creates candidate)
    console.log('\n✅ Step 3: Approving application...');
    const approveResponse = await axios.post(
      `http://localhost:5001/api/applications/${application.id}/approve`,
      { jobId: job.id },
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const approvedData = approveResponse.data.data;
    console.log(`✅ Application approved`);
    console.log(`   Candidate ID: ${approvedData.candidateId}`);
    console.log(`   Application status: ${approvedData.application?.status || 'unknown'}`);
    
    // Step 4: Verify candidate was created
    console.log('\n🔍 Step 4: Verifying candidate creation...');
    const candidateResponse = await axios.get(
      `http://localhost:5001/api/candidates/${approvedData.candidateId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const candidate = candidateResponse.data.data;
    console.log(`✅ Candidate verified`);
    console.log(`   Name: ${candidate.firstName} ${candidate.lastName}`);
    console.log(`   Job IDs: ${candidate.jobIds?.join(', ') || 'none'}`);
    console.log(`   Application IDs: ${candidate.applicationIds?.join(', ') || 'none'}`);
    console.log(`   Status: ${candidate.status}`);
    console.log(`   AI Score: ${candidate.aiScore || 'N/A'}`);
    
    // Step 5: Check application list
    console.log('\n📋 Step 5: Listing all applications...');
    const appsListResponse = await axios.get('http://localhost:5001/api/applications', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const appsList = appsListResponse.data.data.applications;
    console.log(`✅ Found ${appsList.length} applications`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Application workflow test PASSED!');
    console.log('='.repeat(60));
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.response?.data?.errors) {
      console.error('Validation errors:', error.response.data.errors);
    }
    process.exit(1);
  }
}

testApplicationWorkflow();
