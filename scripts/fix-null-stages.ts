import admin from "firebase-admin";
import * as path from "path";

const serviceAccount = require(
  path.join(__dirname, "..", "firebase_config.json")
);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function fixNullStages() {
  console.log("🚀 Fixing candidates with null/invalid stages...\n");

  try {
    // Get all jobs and pipelines
    const jobsSnapshot = await db.collection("jobs").get();
    const jobs = jobsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const pipelinesSnapshot = await db.collection("pipelines").get();
    const pipelines = pipelinesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Create jobId -> pipelineId map
    const jobToPipeline = new Map();
    jobs.forEach((job: any) => {
      if (job.pipelineId) {
        const pipeline = pipelines.find((p: any) => p.id === job.pipelineId);
        if (pipeline) {
          jobToPipeline.set(job.id, pipeline);
        }
      }
    });

    // Get all candidates
    const candidatesSnapshot = await db.collection("candidates").get();
    const candidates = candidatesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    let fixedCount = 0;
    let skippedCount = 0;

    for (const candidate of candidates) {
      const jobApplications = candidate.jobApplications || [];
      let needsUpdate = false;

      const updatedJobApplications = jobApplications.map((app: any) => {
        const jobId = typeof app.jobId === "string" ? app.jobId : app.jobId?.id;

        // Check if currentStage is null, undefined, or "new"
        if (!app.currentStage || app.currentStage === "new") {
          const pipeline = jobToPipeline.get(jobId);

          if (pipeline && pipeline.stages && pipeline.stages.length > 0) {
            const firstStageId = pipeline.stages[0].id;
            const job = jobs.find((j: any) => j.id === jobId);

            console.log(`📝 ${candidate.firstName} ${candidate.lastName}`);
            console.log(`   Job: ${job?.title || jobId}`);
            console.log(
              `   Setting to first stage: ${pipeline.stages[0].name} (${firstStageId})`
            );

            needsUpdate = true;
            return {
              ...app,
              currentStage: firstStageId,
              lastStatusChange: new Date().toISOString(),
            };
          } else {
            console.log(`⚠️  ${candidate.firstName} ${candidate.lastName}`);
            console.log(`   Job: ${jobId} has no pipeline - keeping null`);
          }
        }

        return app;
      });

      if (needsUpdate) {
        await db.collection("candidates").doc(candidate.id).update({
          jobApplications: updatedJobApplications,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        fixedCount++;
        console.log(`✅ Updated\n`);
      } else {
        skippedCount++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Fix Summary:");
    console.log(`   ✅ Fixed: ${fixedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log("=".repeat(50));
  } catch (error) {
    console.error("❌ Fix failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

fixNullStages();
