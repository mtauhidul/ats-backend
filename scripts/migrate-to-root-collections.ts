import { getFirestoreDb } from '../src/config/firebase';

/**
 * Migrate data from companies/default-company/* to root collections
 */
async function migrateToRootCollections() {
  const db = getFirestoreDb();
  const companyId = 'default-company';
  
  console.log('🔄 Starting migration to root collections...\n');

  try {
    // Migrate Jobs
    console.log('📋 Migrating jobs...');
    const oldJobsRef = db.collection(`companies/${companyId}/jobs`);
    const jobsSnapshot = await oldJobsRef.get();
    
    if (!jobsSnapshot.empty) {
      const batch = db.batch();
      let jobCount = 0;
      
      jobsSnapshot.docs.forEach((doc: any) => {
        const newJobRef = db.collection('jobs').doc(doc.id);
        batch.set(newJobRef, doc.data());
        jobCount++;
      });
      
      await batch.commit();
      console.log(`✅ Migrated ${jobCount} jobs to /jobs`);
    } else {
      console.log('ℹ️  No jobs to migrate');
    }

    // Migrate Candidates
    console.log('\n👥 Migrating candidates...');
    const oldCandidatesRef = db.collection(`companies/${companyId}/candidates`);
    const candidatesSnapshot = await oldCandidatesRef.get();
    
    if (!candidatesSnapshot.empty) {
      const batch = db.batch();
      let candidateCount = 0;
      
      candidatesSnapshot.docs.forEach((doc: any) => {
        const newCandidateRef = db.collection('candidates').doc(doc.id);
        batch.set(newCandidateRef, doc.data());
        candidateCount++;
      });
      
      await batch.commit();
      console.log(`✅ Migrated ${candidateCount} candidates to /candidates`);
    } else {
      console.log('ℹ️  No candidates to migrate');
    }

    // Migrate Applications (if any exist in old location)
    console.log('\n📝 Checking applications...');
    const oldApplicationsRef = db.collection(`companies/${companyId}/applications`);
    const applicationsSnapshot = await oldApplicationsRef.get();
    
    if (!applicationsSnapshot.empty) {
      const batch = db.batch();
      let applicationCount = 0;
      
      applicationsSnapshot.docs.forEach((doc: any) => {
        const newApplicationRef = db.collection('applications').doc(doc.id);
        batch.set(newApplicationRef, doc.data());
        applicationCount++;
      });
      
      await batch.commit();
      console.log(`✅ Migrated ${applicationCount} applications to /applications`);
    } else {
      console.log('ℹ️  No applications to migrate (or already at root)');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n⚠️  Note: Old data still exists in companies/default-company/*');
    console.log('   You can delete it manually after verifying the migration.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateToRootCollections()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
