import { getFirestoreDB } from '../src/config/firebase';

async function auditApplications() {
  console.log('🔍 Auditing Applications Module...\n');
  
  try {
    const db = getFirestoreDB();
    const snapshot = await db.collection('applications').get();
    
    console.log(`📊 Total applications: ${snapshot.size}\n`);
    
    if (snapshot.size === 0) {
      console.log('⚠️  No applications found in database\n');
      process.exit(0);
    }
    
    const issues: string[] = [];
    let validCount = 0;
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const appIssues: string[] = [];
      
      console.log(`\n📄 Application ${index + 1}/${snapshot.size}: ${doc.id}`);
      console.log(`   Candidate ID: ${data.candidateId}`);
      console.log(`   Job ID: ${data.jobId}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Source: ${data.source}`);
      
      // Check required fields
      if (!data.id || data.id !== doc.id) {
        appIssues.push('Missing or mismatched id field');
        console.log('   ❌ id field:', data.id);
      }
      
      if (!data.candidateId) {
        appIssues.push('Missing candidateId');
        console.log('   ❌ Missing candidateId');
      }
      
      if (!data.jobId) {
        appIssues.push('Missing jobId');
        console.log('   ❌ Missing jobId');
      }
      
      // Check status field
      const validStatuses = ['pending', 'reviewed', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn'];
      if (!data.status) {
        appIssues.push('Missing status');
        console.log('   ❌ Missing status');
      } else if (!validStatuses.includes(data.status)) {
        appIssues.push(`Invalid status: ${data.status}`);
        console.log(`   ⚠️  Unusual status: ${data.status}`);
      }
      
      // Check source field
      const validSources = ['manual', 'direct_apply', 'email_automation', 'job_board', 'referral', 'linkedin'];
      if (!data.source) {
        appIssues.push('Missing source');
        console.log('   ❌ Missing source');
      } else if (!validSources.includes(data.source)) {
        appIssues.push(`Invalid source: ${data.source}`);
        console.log(`   ⚠️  Unusual source: ${data.source}`);
      }
      
      // Check date fields
      if (!data.appliedAt && !data.createdAt) {
        appIssues.push('Missing both appliedAt and createdAt');
        console.log('   ❌ Missing date fields');
      } else {
        if (data.appliedAt) {
          if (typeof data.appliedAt === 'object' && Object.keys(data.appliedAt).length === 0) {
            appIssues.push('appliedAt is empty object');
            console.log('   ❌ appliedAt: {} (empty object)');
          } else {
            console.log('   ✅ appliedAt:', typeof data.appliedAt === 'object' ? new Date(data.appliedAt._seconds * 1000).toISOString() : data.appliedAt);
          }
        }
        if (data.createdAt) {
          if (typeof data.createdAt === 'object' && Object.keys(data.createdAt).length === 0) {
            appIssues.push('createdAt is empty object');
            console.log('   ❌ createdAt: {} (empty object)');
          } else {
            console.log('   ✅ createdAt:', typeof data.createdAt === 'object' ? new Date(data.createdAt._seconds * 1000).toISOString() : data.createdAt);
          }
        }
      }
      
      // Check updatedAt
      if (!data.updatedAt) {
        appIssues.push('Missing updatedAt');
        console.log('   ⚠️  Missing updatedAt');
      } else if (typeof data.updatedAt === 'object' && Object.keys(data.updatedAt).length === 0) {
        appIssues.push('updatedAt is empty object');
        console.log('   ❌ updatedAt: {} (empty object)');
      }
      
      // Check for object pollution in IDs
      if (typeof data.candidateId === 'object') {
        appIssues.push('candidateId is object (should be string)');
        console.log('   ❌ candidateId is object:', JSON.stringify(data.candidateId).substring(0, 100));
      }
      
      if (typeof data.jobId === 'object') {
        appIssues.push('jobId is object (should be string)');
        console.log('   ❌ jobId is object:', JSON.stringify(data.jobId).substring(0, 100));
      }
      
      // Check for resume field
      if (data.resume) {
        console.log('   📎 Resume:', typeof data.resume === 'object' ? 'Object with fields' : data.resume);
      }
      
      if (appIssues.length > 0) {
        console.log(`   ⚠️  Issues found: ${appIssues.length}`);
        appIssues.forEach(issue => console.log(`      - ${issue}`));
        issues.push(...appIssues.map(i => `${doc.id}: ${i}`));
      } else {
        validCount++;
        console.log('   ✅ No issues');
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   Total applications: ${snapshot.size}`);
    console.log(`   Valid applications: ${validCount}`);
    console.log(`   Applications with issues: ${snapshot.size - validCount}`);
    console.log(`   Total issues: ${issues.length}`);
    
    if (issues.length > 0) {
      console.log('\n❌ Issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log('\n✅ All applications are valid!');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

auditApplications();
