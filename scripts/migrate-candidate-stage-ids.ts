import admin from "firebase-admin";
import * as path from "path";

// Initialize Firebase Admin
const serviceAccount = require(
  path.join(__dirname, "..", "firebase_config.json")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateCandidateStageIds() {
  console.log("🚀 Starting candidate stage ID migration...\n");

  try {
    // Get all jobs
    const jobsSnapshot = await db.collection("jobs").get();
    const jobs = jobsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    console.log(`📋 Found ${jobs.length} jobs\n`);

    // Get all pipelines
    const pipelinesSnapshot = await db.collection("pipelines").get();
    const pipelines = pipelinesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    console.log(`📋 Found ${pipelines.length} pipelines\n`);

    // Get all candidates
    const candidatesSnapshot = await db.collection("candidates").get();
    const candidates = candidatesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    console.log(`📋 Found ${candidates.length} candidates\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each candidate
    for (const candidate of candidates) {
      try {
        const candidateId = candidate.id;
        const currentStageId =
          candidate.currentPipelineStageId || candidate.currentStage;

        if (!currentStageId || typeof currentStageId !== "string") {
          console.log(
            `⏭️  Skipping ${candidate.firstName} ${candidate.lastName} - No stage ID`
          );
          skippedCount++;
          continue;
        }

        // Get the candidate's primary job
        const jobIds = candidate.jobIds || [];
        if (jobIds.length === 0) {
          console.log(
            `⏭️  Skipping ${candidate.firstName} ${candidate.lastName} - No jobs`
          );
          skippedCount++;
          continue;
        }

        // Get first job ID
        const firstJobId =
          typeof jobIds[0] === "string" ? jobIds[0] : jobIds[0]?.id;
        const job = jobs.find((j) => j.id === firstJobId);

        if (!job || !job.pipelineId) {
          console.log(
            `⏭️  Skipping ${candidate.firstName} ${candidate.lastName} - Job not found or no pipeline`
          );
          skippedCount++;
          continue;
        }

        // Get the job's pipeline
        const pipeline = pipelines.find((p) => p.id === job.pipelineId);

        if (!pipeline || !pipeline.stages || pipeline.stages.length === 0) {
          console.log(
            `⏭️  Skipping ${candidate.firstName} ${candidate.lastName} - Pipeline not found or no stages`
          );
          skippedCount++;
          continue;
        }

        // Check if current stage ID already matches the pipeline
        const currentStageExists = pipeline.stages.some(
          (s: any) => s.id === currentStageId
        );

        if (currentStageExists) {
          console.log(
            `✅ ${candidate.firstName} ${candidate.lastName} - Stage ID already correct`
          );
          skippedCount++;
          continue;
        }

        // Extract index from old stage ID: stage_1763585843289_6 -> 6
        let newStageId = null;

        if (currentStageId.includes("stage_") && currentStageId.includes("_")) {
          const parts = currentStageId.split("_");
          const stageIndex = parseInt(parts[parts.length - 1]);

          if (!isNaN(stageIndex) && stageIndex < pipeline.stages.length) {
            // Get the stage at the same index in the new pipeline
            newStageId = pipeline.stages[stageIndex].id;
            console.log(`🔄 ${candidate.firstName} ${candidate.lastName}:`);
            console.log(`   Old: ${currentStageId} (index ${stageIndex})`);
            console.log(
              `   New: ${newStageId} (${pipeline.stages[stageIndex].name})`
            );
          }
        } else {
          // If it's a stage name, try to find matching stage
          const matchedStage = pipeline.stages.find(
            (s: any) => s.name?.toLowerCase() === currentStageId.toLowerCase()
          );
          if (matchedStage) {
            newStageId = matchedStage.id;
            console.log(`🔄 ${candidate.firstName} ${candidate.lastName}:`);
            console.log(`   Old: ${currentStageId} (stage name)`);
            console.log(`   New: ${newStageId} (${matchedStage.name})`);
          }
        }

        if (newStageId) {
          // Update candidate document
          const updateData: any = {
            currentPipelineStageId: newStageId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          // CRITICAL: Also update the jobApplication.currentStage for this specific job
          const jobApplications = candidate.jobApplications || [];
          const updatedJobApplications = jobApplications.map((app: any) => {
            const appJobId = app.jobId?.id || app.jobId?._id || app.jobId;
            if (appJobId === firstJobId) {
              return {
                ...app,
                currentStage: newStageId, // Update to new stage ID
                lastStatusChange: admin.firestore.FieldValue.serverTimestamp(),
              };
            }
            return app;
          });

          if (updatedJobApplications.length > 0) {
            updateData.jobApplications = updatedJobApplications;
          }

          await db.collection("candidates").doc(candidateId).update(updateData);

          migratedCount++;
        } else {
          console.log(
            `⚠️  Could not migrate ${candidate.firstName} ${candidate.lastName} - No matching stage found`
          );
          skippedCount++;
        }
      } catch (error) {
        console.error(
          `❌ Error migrating ${candidate.firstName} ${candidate.lastName}:`,
          error
        );
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Migration Summary:");
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log("=".repeat(50));
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

migrateCandidateStageIds();
