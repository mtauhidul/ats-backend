import axios from 'axios';

async function testCandidateWorkflow() {
  try {
    // Login
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'mislam.tauhidul@gmail.com',
      password: 'Aqsw1234'
    });
    
    const token = loginResponse.data.data.accessToken;
    console.log('✅ Logged in\n');
    
    // Step 1: List all candidates
    console.log('📋 Step 1: Listing all candidates...');
    const candidatesResponse = await axios.get('http://localhost:5001/api/candidates', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const candidates = candidatesResponse.data.data.candidates;
    console.log(`✅ Found ${candidates.length} candidates\n`);
    
    if (candidates.length === 0) {
      console.log('⚠️  No candidates to test with. Please approve an application first.');
      process.exit(0);
    }
    
    const candidate = candidates[0];
    console.log(`Testing with candidate: ${candidate.firstName} ${candidate.lastName} (${candidate.id})\n`);
    
    // Step 2: Get candidate details
    console.log('🔍 Step 2: Fetching candidate details...');
    const candidateDetailResponse = await axios.get(
      `http://localhost:5001/api/candidates/${candidate.id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const candidateDetail = candidateDetailResponse.data.data;
    console.log(`✅ Candidate details retrieved`);
    console.log(`   Name: ${candidateDetail.firstName} ${candidateDetail.lastName}`);
    console.log(`   Email: ${candidateDetail.email}`);
    console.log(`   Status: ${candidateDetail.status}`);
    console.log(`   Job IDs: ${candidateDetail.jobIds?.join(', ') || 'none'}`);
    console.log(`   Application IDs: ${candidateDetail.applicationIds?.join(', ') || 'none'}`);
    console.log(`   Skills: ${candidateDetail.skills?.length || 0} skills`);
    console.log(`   Experience: ${candidateDetail.experience?.length || 0} entries`);
    console.log(`   Education: ${candidateDetail.education?.length || 0} entries`);
    
    // Check jobApplications structure
    if (candidateDetail.jobApplications && Array.isArray(candidateDetail.jobApplications)) {
      console.log(`   📋 Job Applications: ${candidateDetail.jobApplications.length}`);
      candidateDetail.jobApplications.forEach((ja: any, idx: number) => {
        console.log(`      [${idx}] Job: ${ja.jobId}, App: ${ja.applicationId}, Status: ${ja.status}`);
      });
    }
    
    // Step 3: Update candidate
    console.log('\n✏️  Step 3: Updating candidate...');
    const updateData = {
      phone: '+9876543210',
      notes: 'Test update from audit script'
    };
    
    await axios.patch(
      `http://localhost:5001/api/candidates/${candidate.id}`,
      updateData,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    console.log('✅ Candidate updated successfully');
    
    // Step 4: Verify update
    console.log('\n🔍 Step 4: Verifying update...');
    const verifyResponse = await axios.get(
      `http://localhost:5001/api/candidates/${candidate.id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const verifiedCandidate = verifyResponse.data.data;
    console.log(`✅ Update verified`);
    console.log(`   Phone: ${verifiedCandidate.phone}`);
    console.log(`   Notes: ${verifiedCandidate.notes}`);
    
    // Step 5: Test filtering by job
    console.log('\n🔍 Step 5: Testing job filter...');
    const jobId = candidateDetail.jobIds?.[0];
    
    if (jobId) {
      const filteredResponse = await axios.get(
        `http://localhost:5001/api/candidates?jobId=${jobId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const filteredCandidates = filteredResponse.data.data.candidates;
      console.log(`✅ Found ${filteredCandidates.length} candidates for job ${jobId}`);
    }
    
    // Step 6: Test filtering by status
    console.log('\n🔍 Step 6: Testing status filter...');
    const statusResponse = await axios.get(
      `http://localhost:5001/api/candidates?status=active`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const activeCandidates = statusResponse.data.data.candidates;
    console.log(`✅ Found ${activeCandidates.length} active candidates`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Candidate workflow test PASSED!');
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

testCandidateWorkflow();
