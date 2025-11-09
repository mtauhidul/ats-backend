import axios from 'axios';

async function testJobsModule() {
  try {
    // Login first
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'mislam.tauhidul@gmail.com',
      password: 'Aqsw1234'
    });
    
    const token = loginResponse.data.data.accessToken;
    console.log('✅ Logged in\n');
    
    // Get jobs
    console.log('📋 Fetching jobs...');
    const jobsResponse = await axios.get('http://localhost:5001/api/jobs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Total jobs:', jobsResponse.data.data?.jobs?.length || 0);
    
    if (jobsResponse.data.data?.jobs?.length > 0) {
      const job = jobsResponse.data.data.jobs[0];
      console.log('\nFirst job:');
      console.log('- ID:', job.id);
      console.log('- Title:', job.title);
      console.log('- Client ID:', job.clientId);
      console.log('- Client ID Type:', typeof job.clientId);
      console.log('- Status:', job.status);
      console.log('- Created At:', job.createdAt);
      console.log('- Category IDs:', job.categoryIds);
    }
    
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testJobsModule();
