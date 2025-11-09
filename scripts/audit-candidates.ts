import { getFirestoreDB } from '../src/config/firebase';

async function auditCandidates() {
  console.log('🔍 Auditing Candidates Module...\n');
  
  try {
    const db = getFirestoreDB();
    
    // Find all companies
    const companiesSnapshot = await db.collection('companies').get();
    console.log(`Found ${companiesSnapshot.size} companies\n`);
    
    let totalCandidates = 0;
    const allIssues: string[] = [];
    let allValidCount = 0;
    
    // Check default company first
    const defaultCompanyId = process.env.DEFAULT_COMPANY_ID || 'default-company';
    console.log(`📂 Checking company: ${defaultCompanyId}\n`);
    
    const snapshot = await db.collection(`companies/${defaultCompanyId}/candidates`).get();
    
    console.log(`📊 Total candidates: ${snapshot.size}\n`);
    
    if (snapshot.size === 0) {
      console.log('⚠️  No candidates found in database\n');
      process.exit(0);
    }
    
    const issues: string[] = [];
    let validCount = 0;
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const candidateIssues: string[] = [];
      
      console.log(`\n📄 Candidate ${index + 1}/${snapshot.size}: ${doc.id}`);
      console.log(`   Name: ${data.firstName} ${data.lastName}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Job IDs: ${data.jobIds?.length || 0} jobs`);
      console.log(`   Application IDs: ${data.applicationIds?.length || 0} applications`);
      
      // Check required fields
      if (!data.id || data.id !== doc.id) {
        candidateIssues.push('Missing or mismatched id field');
        console.log('   ❌ id field:', data.id);
      }
      
      if (!data.firstName) {
        candidateIssues.push('Missing firstName');
        console.log('   ❌ Missing firstName');
      }
      
      if (!data.lastName) {
        candidateIssues.push('Missing lastName');
        console.log('   ❌ Missing lastName');
      }
      
      if (!data.email) {
        candidateIssues.push('Missing email');
        console.log('   ❌ Missing email');
      }
      
      // Check status field
      const validStatuses = ['active', 'inactive', 'hired', 'rejected', 'withdrawn'];
      if (!data.status) {
        candidateIssues.push('Missing status');
        console.log('   ❌ Missing status');
      } else if (!validStatuses.includes(data.status)) {
        candidateIssues.push(`Invalid status: ${data.status}`);
        console.log(`   ⚠️  Unusual status: ${data.status}`);
      }
      
      // Check jobIds array
      if (!data.jobIds) {
        candidateIssues.push('Missing jobIds array');
        console.log('   ❌ Missing jobIds');
      } else if (!Array.isArray(data.jobIds)) {
        candidateIssues.push('jobIds is not an array');
        console.log('   ❌ jobIds is not an array:', typeof data.jobIds);
      } else if (data.jobIds.length === 0) {
        candidateIssues.push('jobIds array is empty');
        console.log('   ⚠️  jobIds array is empty');
      } else {
        // Check if jobIds contains strings or objects
        const hasObjects = data.jobIds.some((id: any) => typeof id === 'object');
        if (hasObjects) {
          candidateIssues.push('jobIds contains objects (should be string IDs)');
          console.log('   ❌ jobIds contains objects');
        }
      }
      
      // Check applicationIds array
      if (!data.applicationIds) {
        candidateIssues.push('Missing applicationIds array');
        console.log('   ❌ Missing applicationIds');
      } else if (!Array.isArray(data.applicationIds)) {
        candidateIssues.push('applicationIds is not an array');
        console.log('   ❌ applicationIds is not an array:', typeof data.applicationIds);
      } else if (data.applicationIds.length === 0) {
        candidateIssues.push('applicationIds array is empty');
        console.log('   ⚠️  applicationIds array is empty');
      }
      
      // Check jobApplications array structure
      if (data.jobApplications) {
        if (!Array.isArray(data.jobApplications)) {
          candidateIssues.push('jobApplications is not an array');
          console.log('   ❌ jobApplications is not an array:', typeof data.jobApplications);
        } else {
          console.log(`   📋 jobApplications: ${data.jobApplications.length} entries`);
          
          data.jobApplications.forEach((ja: any, idx: number) => {
            if (!ja.jobId) {
              candidateIssues.push(`jobApplications[${idx}] missing jobId`);
              console.log(`   ❌ jobApplications[${idx}] missing jobId`);
            }
            if (!ja.applicationId) {
              candidateIssues.push(`jobApplications[${idx}] missing applicationId`);
              console.log(`   ❌ jobApplications[${idx}] missing applicationId`);
            }
            if (!ja.status) {
              candidateIssues.push(`jobApplications[${idx}] missing status`);
              console.log(`   ❌ jobApplications[${idx}] missing status`);
            }
          });
        }
      } else {
        candidateIssues.push('Missing jobApplications array');
        console.log('   ⚠️  Missing jobApplications');
      }
      
      // Check parsed data structure
      if (data.skills) {
        console.log(`   🔧 Skills: ${Array.isArray(data.skills) ? data.skills.length : 'not an array'}`);
      }
      if (data.experience) {
        console.log(`   💼 Experience: ${Array.isArray(data.experience) ? data.experience.length : 'not an array'}`);
      }
      if (data.education) {
        console.log(`   🎓 Education: ${Array.isArray(data.education) ? data.education.length : 'not an array'}`);
      }
      
      // Check timestamps
      if (!data.createdAt) {
        candidateIssues.push('Missing createdAt');
        console.log('   ⚠️  Missing createdAt');
      } else if (typeof data.createdAt === 'object' && Object.keys(data.createdAt).length === 0) {
        candidateIssues.push('createdAt is empty object');
        console.log('   ❌ createdAt: {} (empty object)');
      }
      
      if (!data.updatedAt) {
        candidateIssues.push('Missing updatedAt');
        console.log('   ⚠️  Missing updatedAt');
      } else if (typeof data.updatedAt === 'object' && Object.keys(data.updatedAt).length === 0) {
        candidateIssues.push('updatedAt is empty object');
        console.log('   ❌ updatedAt: {} (empty object)');
      }
      
      if (candidateIssues.length > 0) {
        console.log(`   ⚠️  Issues found: ${candidateIssues.length}`);
        candidateIssues.forEach(issue => console.log(`      - ${issue}`));
        issues.push(...candidateIssues.map(i => `${doc.id}: ${i}`));
      } else {
        validCount++;
        console.log('   ✅ No issues');
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   Total candidates: ${snapshot.size}`);
    console.log(`   Valid candidates: ${validCount}`);
    console.log(`   Candidates with issues: ${snapshot.size - validCount}`);
    console.log(`   Total issues: ${issues.length}`);
    
    if (issues.length > 0) {
      console.log('\n❌ Issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log('\n✅ All candidates are valid!');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

auditCandidates();
