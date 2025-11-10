import { getFirestoreDb } from './src/config/firebase';

(async () => {
  const db = getFirestoreDb();
  
  const pipelines = await db.collection('pipelines').limit(1).get();
  
  if (pipelines.empty) {
    console.log('No pipelines found');
    return;
  }
  
  const doc = pipelines.docs[0];
  const data = doc.data();
  
  console.log('=== PIPELINE DOCUMENT ===');
  console.log('ID:', doc.id);
  console.log('\nFull Data:');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('\n=== STAGES ===');
  if (data.stages && Array.isArray(data.stages)) {
    data.stages.forEach((stage: any, index: number) => {
      console.log(`\nStage ${index + 1}:`);
      console.log('  id:', stage.id);
      console.log('  _id:', stage._id);
      console.log('  name:', stage.name);
      console.log('  order:', stage.order);
      console.log('  color:', stage.color);
    });
  }
  
  process.exit(0);
})();
