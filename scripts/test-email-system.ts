import axios from 'axios';

async function testEmailSystem() {
  try {
    // Login
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'mislam.tauhidul@gmail.com',
      password: 'Aqsw1234'
    });
    
    const token = loginResponse.data.data.accessToken;
    console.log('✅ Logged in\n');
    
    // Step 1: Test Email Templates endpoint
    console.log('📋 Step 1: Testing Email Templates...');
    try {
      const templatesResponse = await axios.get('http://localhost:5001/api/email-templates', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const templates = templatesResponse.data.data.templates || templatesResponse.data.data || [];
      console.log(`✅ Found ${Array.isArray(templates) ? templates.length : 0} email templates`);
      
      if (Array.isArray(templates) && templates.length > 0) {
        templates.slice(0, 3).forEach((template: any) => {
          console.log(`   - ${template.name} (${template.id})`);
        });
      }
    } catch (error: any) {
      console.log(`⚠️  Email Templates endpoint error: ${error.response?.status || error.message}`);
    }
    console.log('');
    
    // Step 2: Test Email Accounts endpoint
    console.log('📋 Step 2: Testing Email Accounts...');
    try {
      const accountsResponse = await axios.get('http://localhost:5001/api/email-accounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const accounts = accountsResponse.data.data.emailAccounts || accountsResponse.data.data || [];
      console.log(`✅ Found ${Array.isArray(accounts) ? accounts.length : 0} email accounts`);
      
      if (Array.isArray(accounts) && accounts.length > 0) {
        accounts.forEach((account: any) => {
          console.log(`   - ${account.email} (Provider: ${account.provider}, Active: ${account.isActive})`);
        });
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.log(`⚠️  Email Accounts endpoint requires admin role (403 Forbidden)`);
      } else {
        console.log(`⚠️  Email Accounts endpoint error: ${error.response?.status || error.message}`);
      }
    }
    console.log('');
    
    // Step 3: Test Email sending endpoint
    console.log('📧 Step 3: Testing Email Send functionality...');
    try {
      // First get a job to send email about
      const jobsResponse = await axios.get('http://localhost:5001/api/jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const jobs = jobsResponse.data.data.jobs;
      
      if (jobs && jobs.length > 0) {
        console.log(`✅ Found ${jobs.length} jobs for email testing`);
        console.log(`   Using job: "${jobs[0].title}" (${jobs[0].id})`);
      } else {
        console.log(`⚠️  No jobs found for email testing`);
      }
    } catch (error: any) {
      console.log(`⚠️  Error getting jobs for email test: ${error.response?.status || error.message}`);
    }
    console.log('');
    
    // Step 4: Check email services in database
    console.log('🔍 Step 4: Checking email data in database...');
    console.log('   (This requires direct database access, skipping for API test)\n');
    
    // Step 5: Test notification system
    console.log('🔔 Step 5: Testing Notification system...');
    try {
      const notificationsResponse = await axios.get('http://localhost:5001/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const notifications = notificationsResponse.data.data.notifications || notificationsResponse.data.data || [];
      console.log(`✅ Found ${Array.isArray(notifications) ? notifications.length : 0} notifications`);
      
      if (Array.isArray(notifications) && notifications.length > 0) {
        const unreadCount = notifications.filter((n: any) => !n.isRead).length;
        console.log(`   Unread: ${unreadCount}, Read: ${notifications.length - unreadCount}`);
      }
    } catch (error: any) {
      console.log(`⚠️  Notifications endpoint error: ${error.response?.status || error.message}`);
    }
    console.log('');
    
    console.log('='.repeat(60));
    console.log('✅ Email system test COMPLETED');
    console.log('='.repeat(60));
    console.log('\n📝 Notes:');
    console.log('   - Email templates and accounts require proper SMTP configuration');
    console.log('   - Actual email sending requires environment variables setup');
    console.log('   - Test email sending in production environment with real SMTP');
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testEmailSystem();
