import { getFirestoreDB } from '../src/config/firebase';

async function checkRawJob() {
  try {
    const db = getFirestoreDB();
    
    // Find all companies
    const companiesSnapshot = await db.collection('companies').get();
    console.log(`\nFound ${companiesSnapshot.size} companies\n`);
    
    for (const companyDoc of companiesSnapshot.docs) {
      console.log(`\n🏢 Company: ${companyDoc.id}`);
      
      // Get jobs for this company
      const jobsSnapshot = await db.collection(`companies/${companyDoc.id}/jobs`).get();
      console.log(`   Jobs: ${jobsSnapshot.size}\n`);
      
      jobsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        console.log('   📄 Job:', doc.id);
        console.log('      Title:', data.title);
        console.log('      clientId type:', typeof data.clientId);
        if (typeof data.clientId === 'string') {
          console.log('      clientId value:', data.clientId);
        } else {
          console.log('      clientId value:', JSON.stringify(data.clientId).substring(0, 150));
        }
        console.log('      categoryIds[0] type:', typeof data.categoryIds?.[0]);
        if (data.categoryIds && data.categoryIds.length > 0) {
          if (typeof data.categoryIds[0] === 'string') {
            console.log('      categoryIds[0] value:', data.categoryIds[0]);
          } else {
            console.log('      categoryIds[0] value:', JSON.stringify(data.categoryIds[0]).substring(0, 150));
          }
        }
        console.log('      createdAt:', data.createdAt);
        console.log('      updatedAt:', data.updatedAt);
        console.log('      id field:', data.id);
        console.log('');
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRawJob();
