import axios from 'axios';

async function testLoginAPI() {
  try {
    const email = 'mislamtauhidul@gmail.com';
    const password = 'Aqsw1234';
    
    console.log('\n🧪 Testing Login API Endpoint');
    console.log('================================');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('URL: http://localhost:5001/api/auth/login\n');
    
    const response = await axios.post('http://localhost:5001/api/auth/login', {
      email,
      password
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on any status
    });
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200) {
      console.log('\n✅ Login successful!');
    } else {
      console.log('\n❌ Login failed!');
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testLoginAPI();
