import admin from "firebase-admin";
import * as path from "path";

const serviceAccount = require(
  path.join(__dirname, "..", "firebase_config.json")
);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function checkPipelines() {
  const jobs = await db.collection("jobs").get();
  const pipelines = await db.collection("pipelines").get();

  console.log("Jobs and their pipelines:\n");

  jobs.forEach((jobDoc) => {
    const job = jobDoc.data();
    console.log(`Job: ${job.title} (${jobDoc.id})`);
    console.log(`  pipelineId in job: ${job.pipelineId}`);

    const pipeline = pipelines.docs.find((p) => p.id === job.pipelineId);
    if (pipeline) {
      const pData = pipeline.data();
      console.log(`  ✅ Pipeline found: ${pData.name}`);
      console.log(`  Pipeline's jobId field: ${pData.jobId}`);
      console.log(`  Stages count: ${pData.stages?.length || 0}`);
      if (pData.stages && pData.stages.length > 0) {
        console.log(
          `  First stage: ${pData.stages[0].name} (${pData.stages[0].id})`
        );
      }
    } else {
      console.log(`  ❌ Pipeline NOT FOUND`);
    }
    console.log("");
  });

  console.log("\n=== All Pipelines ===");
  pipelines.forEach((pDoc) => {
    const p = pDoc.data();
    console.log(`Pipeline: ${p.name} (${pDoc.id})`);
    console.log(`  jobId: ${p.jobId}`);
    console.log(`  stages: ${p.stages?.length || 0}`);
  });
}

checkPipelines().then(() => process.exit(0));
