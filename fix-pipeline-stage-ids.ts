import { getFirestoreDb } from './src/config/firebase';

/**
 * Script to add IDs to pipeline stages that don't have them
 */
(async () => {
  const db = getFirestoreDb();
  
  console.log('=== FIXING PIPELINE STAGE IDS ===\n');
  
  // Get all pipelines
  const pipelinesSnapshot = await db.collection('pipelines').get();
  console.log(`Found ${pipelinesSnapshot.size} pipelines to check\n`);
  
  let updated = 0;
  let skipped = 0;
  
  for (const pipelineDoc of pipelinesSnapshot.docs) {
    const pipeline = pipelineDoc.data();
    const pipelineId = pipelineDoc.id;
    
    console.log(`\n📋 Pipeline: ${pipeline.name} (${pipelineId})`);
    
    if (!pipeline.stages || !Array.isArray(pipeline.stages)) {
      console.log('   ⚠ No stages found');
      skipped++;
      continue;
    }
    
    // Check if any stages are missing IDs
    const needsUpdate = pipeline.stages.some((stage: any) => !stage.id);
    
    if (!needsUpdate) {
      console.log('   ✓ All stages already have IDs');
      skipped++;
      continue;
    }
    
    // Add IDs to stages that don't have them
    const updatedStages = pipeline.stages.map((stage: any, index: number) => {
      if (stage.id) {
        console.log(`   ✓ Stage "${stage.name}" already has ID: ${stage.id}`);
        return stage;
      }
      
      const newId = `stage_${Date.now()}_${index}`;
      console.log(`   → Adding ID to stage "${stage.name}": ${newId}`);
      
      return {
        ...stage,
        id: newId,
      };
    });
    
    // Update the pipeline document
    await db.collection('pipelines').doc(pipelineId).update({
      stages: updatedStages,
      updatedAt: new Date(),
    });
    
    console.log(`   ✅ Pipeline updated with ${updatedStages.length} stages`);
    updated++;
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total: ${pipelinesSnapshot.size}`);
  
  process.exit(0);
})();
