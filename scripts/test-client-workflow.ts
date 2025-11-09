import axios from 'axios';

async function testClientWorkflow() {
  try {
    // Login
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'mislam.tauhidul@gmail.com',
      password: 'Aqsw1234'
    });
    
    const token = loginResponse.data.data.accessToken;
    console.log('✅ Logged in\n');
    
    // Step 1: List all clients
    console.log('📋 Step 1: Listing all clients...');
    const clientsResponse = await axios.get('http://localhost:5001/api/clients', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const clients = clientsResponse.data.data.clients;
    console.log(`✅ Found ${clients.length} clients`);
    
    if (clients.length > 0) {
      const client = clients[0];
      console.log(`   First client: ${client.companyName} (${client.id})\n`);
    }
    
    // Step 2: Create a new client
    console.log('➕ Step 2: Creating new client...');
    const newClientData = {
      companyName: `Test Company ${Date.now()}`,
      email: 'contact@testcompany.com',
      phone: '+1234567890',
      industry: 'technology', // lowercase enum value
      companySize: '51-200',
      website: 'https://testcompany.com',
      description: 'A test company for audit purposes',
      address: {
        street: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        postalCode: '94105'
      },
      contacts: [
        {
          name: 'John Smith',
          email: 'john@testcompany.com',
          phone: '+1234567890',
          position: 'HR Manager',
          isPrimary: true
        },
        {
          name: 'Jane Doe',
          email: 'jane@testcompany.com',
          phone: '+0987654321',
          position: 'Recruiter',
          isPrimary: false
        }
      ],
      status: 'active'
    };
    
    const createResponse = await axios.post(
      'http://localhost:5001/api/clients',
      newClientData,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const newClient = createResponse.data.data;
    console.log(`✅ Client created: ${newClient.companyName}`);
    console.log(`   ID: ${newClient.id}`);
    console.log(`   Contacts: ${newClient.contacts?.length || 0}\n`);
    
    // Step 3: Get client details
    console.log('🔍 Step 3: Fetching client details...');
    const clientDetailResponse = await axios.get(
      `http://localhost:5001/api/clients/${newClient.id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const clientDetail = clientDetailResponse.data.data;
    console.log(`✅ Client details retrieved`);
    console.log(`   Company: ${clientDetail.companyName}`);
    console.log(`   Industry: ${clientDetail.industry}`);
    console.log(`   Website: ${clientDetail.website}`);
    console.log(`   Status: ${clientDetail.status}`);
    console.log(`   Contacts: ${clientDetail.contacts?.length || 0}`);
    
    if (clientDetail.contacts && clientDetail.contacts.length > 0) {
      clientDetail.contacts.forEach((contact: any, idx: number) => {
        console.log(`      [${idx}] ${contact.name} (${contact.position}) - Primary: ${contact.isPrimary}`);
      });
    }
    console.log('');
    
    // Step 4: Update client
    console.log('✏️  Step 4: Updating client...');
    const updateData = {
      industry: 'consulting', // lowercase enum value
      description: 'Updated description from audit script',
      companySize: '201-500'
    };
    
    await axios.patch(
      `http://localhost:5001/api/clients/${newClient.id}`,
      updateData,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    console.log('✅ Client updated successfully\n');
    
    // Step 5: Verify update
    console.log('🔍 Step 5: Verifying update...');
    const verifyResponse = await axios.get(
      `http://localhost:5001/api/clients/${newClient.id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const verifiedClient = verifyResponse.data.data;
    console.log(`✅ Update verified`);
    console.log(`   Industry: ${verifiedClient.industry}`);
    console.log(`   Description: ${verifiedClient.description}`);
    console.log(`   Contacts: ${verifiedClient.contacts?.length || 0}\n`);
    
    // Step 6: Test client with jobs
    console.log('🔗 Step 6: Testing client with jobs...');
    const jobsResponse = await axios.get(
      `http://localhost:5001/api/jobs?clientId=${newClient.id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const clientJobs = jobsResponse.data.data.jobs;
    console.log(`✅ Found ${clientJobs.length} jobs for this client\n`);
    
    // Step 7: Test filtering clients by status
    console.log('🔍 Step 7: Testing status filter...');
    const activeClientsResponse = await axios.get(
      'http://localhost:5001/api/clients?status=active',
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const activeClients = activeClientsResponse.data.data.clients;
    console.log(`✅ Found ${activeClients.length} active clients\n`);
    
    // Step 8: Delete client
    console.log('🗑️  Step 8: Deleting test client...');
    await axios.delete(
      `http://localhost:5001/api/clients/${newClient.id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    console.log('✅ Client deleted successfully\n');
    
    console.log('='.repeat(60));
    console.log('✅ Client workflow test PASSED!');
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

testClientWorkflow();
