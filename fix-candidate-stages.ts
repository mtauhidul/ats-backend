import { getFirestoreDb } from './src/config/firebase';

/**
 * Script to fix candidates that don't have currentPipelineStageId set
 * Assigns them to the first stage of their job's pipeline
 */
(async () => {
  const db = getFirestoreDb();
  
  console.log('=== FIXING CANDIDATE PIPELINE STAGES ===\n');
  
  // Get all candidates
  const candidatesSnapshot = await db.collection('candidates').get();
  console.log(`Found ${candidatesSnapshot.size} candidates to check\n`);
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const candidateDoc of candidatesSnapshot.docs) {
    const candidate = candidateDoc.data();
    const candidateId = candidateDoc.id;
    
    // Skip if already has currentPipelineStageId
    if (candidate.currentPipelineStageId) {
      console.log(`✓ Candidate ${candidateId} (${candidate.firstName} ${candidate.lastName}) already has stage ID`);
      skipped++;
      continue;
    }
    
    // Get the first job this candidate is assigned to
    const jobIds = candidate.jobIds || [];
    if (jobIds.length === 0) {
      console.log(`⚠ Candidate ${candidateId} has no jobs assigned`);
      skipped++;
      continue;
    }
    
    const firstJobId = jobIds[0];
    console.log(`\n🔧 Fixing candidate ${candidateId} (${candidate.firstName} ${candidate.lastName})`);
    console.log(`   Job ID: ${firstJobId}`);
    
    try {
      // Get the job's pipeline
      const pipelinesSnapshot = await db.collection('pipelines')
        .where('jobId', '==', firstJobId)
        .limit(1)
        .get();
      
      if (pipelinesSnapshot.empty) {
        console.log(`   ⚠ No pipeline found for job ${firstJobId}`);
        skipped++;
        continue;
      }
      
      const pipeline = pipelinesSnapshot.docs[0].data();
      const stages = pipeline.stages || [];
      
      if (stages.length === 0) {
        console.log(`   ⚠ Pipeline has no stages`);
        skipped++;
        continue;
      }
      
      // Sort stages by order and get the first one
      const sortedStages = stages.sort((a: any, b: any) => a.order - b.order);
      const firstStage = sortedStages[0];
      const firstStageId = firstStage.id || firstStage._id;
      const firstStageName = firstStage.name;
      
      console.log(`   → Assigning to first stage: "${firstStageName}" (${firstStageId})`);
      
      // Update candidate document
      const updateData: any = {
        currentPipelineStageId: firstStageId,
        updatedAt: new Date(),
      };
      
      // Also update jobApplications if it exists
      if (candidate.jobApplications && Array.isArray(candidate.jobApplications)) {
        updateData.jobApplications = candidate.jobApplications.map((app: any) => ({
          ...app,
          currentStage: firstStageName,
        }));
      }
      
      await db.collection('candidates').doc(candidateId).update(updateData);
      
      console.log(`   ✅ Updated successfully`);
      updated++;
      
    } catch (error) {
      console.error(`   ❌ Error updating candidate ${candidateId}:`, error);
      errors++;
    }
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${candidatesSnapshot.size}`);
  
  process.exit(0);
})();
