import axios from 'axios';

async function testDashboard() {
  try {
    // First login
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'mislam.tauhidul@gmail.com',
      password: 'Aqsw1234'
    });
    
    const token = loginResponse.data.data.accessToken;
    console.log('✅ Login successful');
    console.log('Token:', token.substring(0, 20) + '...\n');
    
    // Test dashboard analytics
    const analyticsResponse = await axios.get(
      'http://localhost:5001/api/applications/analytics/dashboard?days=90',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('📊 Dashboard Analytics:');
    console.log('Status:', analyticsResponse.status);
    console.log('Data length:', analyticsResponse.data.data?.length || 0);
    console.log('Sample data:', JSON.stringify(analyticsResponse.data.data?.slice(0, 3), null, 2));
    
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testDashboard();
