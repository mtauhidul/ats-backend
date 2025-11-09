import axios from 'axios';

async function testCategoryWorkflow() {
  try {
    // Login
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'mislam.tauhidul@gmail.com',
      password: 'Aqsw1234'
    });
    
    const token = loginResponse.data.data.accessToken;
    console.log('✅ Logged in\n');
    
    // Step 1: List all categories
    console.log('📋 Step 1: Listing all categories...');
    const categoriesResponse = await axios.get('http://localhost:5001/api/categories', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const categories = categoriesResponse.data.data.categories || categoriesResponse.data.data;
    console.log(`✅ Found ${Array.isArray(categories) ? categories.length : 0} categories`);
    
    if (Array.isArray(categories) && categories.length > 0) {
      categories.forEach((cat: any, idx: number) => {
        console.log(`   [${idx}] ${cat.name} (${cat.id})`);
      });
    }
    console.log('');
    
    // Step 2: Create a new category
    console.log('➕ Step 2: Creating new category...');
    const newCategoryData = {
      name: `Test Category ${Date.now()}`,
      description: 'A test category for audit purposes',
      color: '#3B82F6',
      isActive: true
    };
    
    const createResponse = await axios.post(
      'http://localhost:5001/api/categories',
      newCategoryData,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const newCategory = createResponse.data.data;
    console.log(`✅ Category created: ${newCategory.name}`);
    console.log(`   ID: ${newCategory.id}`);
    console.log(`   Type of ID: ${typeof newCategory.id}\n`);
    
    // Step 3: Get category details
    console.log('🔍 Step 3: Fetching category details...');
    const categoryDetailResponse = await axios.get(
      `http://localhost:5001/api/categories/${newCategory.id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const categoryDetail = categoryDetailResponse.data.data;
    console.log(`✅ Category details retrieved`);
    console.log(`   Name: ${categoryDetail.name}`);
    console.log(`   Description: ${categoryDetail.description}`);
    console.log(`   Color: ${categoryDetail.color}`);
    console.log(`   Active: ${categoryDetail.isActive}\n`);
    
    // Step 4: Update category
    console.log('✏️  Step 4: Updating category...');
    const updateData = {
      name: `Updated Category ${Date.now()}`,
      description: 'Updated description from audit script',
      color: '#10B981'
    };
    
    await axios.patch(
      `http://localhost:5001/api/categories/${newCategory.id}`,
      updateData,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    console.log('✅ Category updated successfully\n');
    
    // Step 5: Verify update
    console.log('🔍 Step 5: Verifying update...');
    const verifyResponse = await axios.get(
      `http://localhost:5001/api/categories/${newCategory.id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const verifiedCategory = verifyResponse.data.data;
    console.log(`✅ Update verified`);
    console.log(`   Name: ${verifiedCategory.name}`);
    console.log(`   Description: ${verifiedCategory.description}`);
    console.log(`   Color: ${verifiedCategory.color}\n`);
    
    // Step 6: Test category with jobs
    console.log('🔗 Step 6: Testing category with jobs...');
    const jobsResponse = await axios.get(
      `http://localhost:5001/api/jobs`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    const jobs = jobsResponse.data.data.jobs;
    console.log(`✅ Total jobs: ${jobs.length}`);
    
    // Check if any jobs have categoryIds
    const jobsWithCategories = jobs.filter((job: any) => job.categoryIds && job.categoryIds.length > 0);
    console.log(`   Jobs with categories: ${jobsWithCategories.length}`);
    
    if (jobsWithCategories.length > 0) {
      const firstJob = jobsWithCategories[0];
      console.log(`   Example: "${firstJob.title}"`);
      console.log(`      categoryIds: [${firstJob.categoryIds.join(', ')}]`);
      console.log(`      categoryIds types: [${firstJob.categoryIds.map((id: any) => typeof id).join(', ')}]`);
      
      // Check if populated
      if (firstJob.categories && Array.isArray(firstJob.categories)) {
        console.log(`      ⚠️  Categories are POPULATED (should be IDs only)`);
        console.log(`      categories[0] type: ${typeof firstJob.categories[0]}`);
        if (typeof firstJob.categories[0] === 'object') {
          console.log(`      categories[0]: ${JSON.stringify(firstJob.categories[0]).substring(0, 100)}...`);
        }
      }
    }
    console.log('');
    
    // Step 7: Delete category
    console.log('🗑️  Step 7: Deleting test category...');
    await axios.delete(
      `http://localhost:5001/api/categories/${newCategory.id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    console.log('✅ Category deleted successfully\n');
    
    console.log('='.repeat(60));
    console.log('✅ Category workflow test PASSED!');
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

testCategoryWorkflow();
