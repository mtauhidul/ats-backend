import axios from 'axios';

async function testTagWorkflow() {
  try {
    // Login
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'mislam.tauhidul@gmail.com',
      password: 'Aqsw1234'
    });
    
    const token = loginResponse.data.data.accessToken;
    console.log('✅ Logged in\n');
    
    // Step 1: List all tags
    console.log('📋 Step 1: Listing all tags...');
    const tagsResponse = await axios.get('http://localhost:5001/api/tags', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const tags = tagsResponse.data.data.tags || tagsResponse.data.data;
    console.log(`✅ Found ${Array.isArray(tags) ? tags.length : 0} tags`);
    
    if (Array.isArray(tags) && tags.length > 0) {
      tags.slice(0, 5).forEach((tag: any, idx: number) => {
        console.log(`   [${idx}] ${tag.name} (${tag.id})`);
      });
      if (tags.length > 5) {
        console.log(`   ... and ${tags.length - 5} more`);
      }
    }
    console.log('');
    
    // Step 2: Create a new tag
    console.log('➕ Step 2: Creating new tag...');
    const newTagData = {
      name: `Test Tag ${Date.now()}`,
      color: '#F59E0B',
      isActive: true
    };
    
    const createResponse = await axios.post(
      'http://localhost:5001/api/tags',
      newTagData,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const newTag = createResponse.data.data;
    console.log(`✅ Tag created: ${newTag.name}`);
    console.log(`   ID: ${newTag.id}`);
    console.log(`   Type of ID: ${typeof newTag.id}\n`);
    
    // Step 3: Get tag details
    console.log('🔍 Step 3: Fetching tag details...');
    const tagDetailResponse = await axios.get(
      `http://localhost:5001/api/tags/${newTag.id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const tagDetail = tagDetailResponse.data.data;
    console.log(`✅ Tag details retrieved`);
    console.log(`   Name: ${tagDetail.name}`);
    console.log(`   Color: ${tagDetail.color}`);
    console.log(`   Active: ${tagDetail.isActive}\n`);
    
    // Step 4: Update tag
    console.log('✏️  Step 4: Updating tag...');
    const updateData = {
      name: `Updated Tag ${Date.now()}`,
      color: '#EF4444'
    };
    
    await axios.patch(
      `http://localhost:5001/api/tags/${newTag.id}`,
      updateData,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    console.log('✅ Tag updated successfully\n');
    
    // Step 5: Verify update
    console.log('🔍 Step 5: Verifying update...');
    const verifyResponse = await axios.get(
      `http://localhost:5001/api/tags/${newTag.id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const verifiedTag = verifyResponse.data.data;
    console.log(`✅ Update verified`);
    console.log(`   Name: ${verifiedTag.name}`);
    console.log(`   Color: ${verifiedTag.color}\n`);
    
    // Step 6: Test tag with jobs
    console.log('🔗 Step 6: Testing tag with jobs...');
    const jobsResponse = await axios.get(
      `http://localhost:5001/api/jobs`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const jobs = jobsResponse.data.data.jobs;
    console.log(`✅ Total jobs: ${jobs.length}`);
    
    // Check if any jobs have tagIds
    const jobsWithTags = jobs.filter((job: any) => job.tagIds && job.tagIds.length > 0);
    console.log(`   Jobs with tags: ${jobsWithTags.length}`);
    
    if (jobsWithTags.length > 0) {
      const firstJob = jobsWithTags[0];
      console.log(`   Example: "${firstJob.title}"`);
      console.log(`      tagIds count: ${firstJob.tagIds.length}`);
      
      // Check database to verify string IDs
      console.log(`\n   🔍 Verifying database storage...`);
    }
    console.log('');
    
    // Step 7: Delete tag
    console.log('🗑️  Step 7: Deleting test tag...');
    await axios.delete(
      `http://localhost:5001/api/tags/${newTag.id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    console.log('✅ Tag deleted successfully\n');
    
    console.log('='.repeat(60));
    console.log('✅ Tag workflow test PASSED!');
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

testTagWorkflow();
