import admin from "firebase-admin";
import * as path from "path";

// Initialize Firebase Admin
const serviceAccount = require(
  path.join(__dirname, "..", "firebase_config.json")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function fixJobApplications() {
  console.log("🚀 Starting jobApplications fix...\n");

  try {
    // Get all jobs
    const jobsSnapshot = await db.collection("jobs").get();
    const jobs = jobsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];
    console.log(`📋 Found ${jobs.length} jobs\n`);

    // Create job to pipeline map
    const jobToPipelineMap = new Map<string, string>();
    jobs.forEach((job) => {
      if (job.pipelineId) {
        jobToPipelineMap.set(job.id, job.pipelineId);
      }
    });

    // Get all pipelines
    const pipelinesSnapshot = await db.collection("pipelines").get();
    const pipelines = pipelinesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];
    console.log(`📋 Found ${pipelines.length} pipelines\n`);

    // Create pipeline map
    const pipelineMap = new Map<string, any>();
    pipelines.forEach((pipeline) => {
      pipelineMap.set(pipeline.id, pipeline);
    });

    // Get all candidates
    const candidatesSnapshot = await db.collection("candidates").get();
    const candidates = candidatesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];
    console.log(`📋 Found ${candidates.length} candidates\n`);

    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each candidate
    for (const candidate of candidates) {
      try {
        const candidateId = candidate.id;
        const candidateName = `${candidate.firstName} ${candidate.lastName}`;

        const jobApplications = candidate.jobApplications || [];

        if (jobApplications.length === 0) {
          console.log(`⏭️  Skipping ${candidateName} - No job applications`);
          skippedCount++;
          continue;
        }

        let needsUpdate = false;
        const updatedJobApplications = jobApplications.map((app: any) => {
          const jobId = app.jobId?.id || app.jobId?._id || app.jobId;
          const pipelineId = jobToPipelineMap.get(jobId);

          if (!pipelineId) {
            console.log(`   ⚠️  Job ${jobId} has no pipeline`);
            return app;
          }

          const pipeline = pipelineMap.get(pipelineId);
          if (!pipeline || !pipeline.stages || pipeline.stages.length === 0) {
            console.log(
              `   ⚠️  Pipeline ${pipelineId} not found or has no stages`
            );
            return app;
          }

          const currentStage = app.currentStage;
          let newStageId = currentStage;
          let updateReason = "";

          // Check if currentStage is missing, use candidate's global currentPipelineStageId
          if (!currentStage) {
            // Try to use the candidate's currentPipelineStageId if it matches this job
            const globalStageId =
              candidate.currentPipelineStageId || candidate.currentStage;

            if (globalStageId && globalStageId.startsWith("stage_")) {
              // Try to match by exact ID or by index
              const stageExists = pipeline.stages.some(
                (s: any) => s.id === globalStageId
              );
              if (stageExists) {
                newStageId = globalStageId;
                updateReason = `missing currentStage, used global stage ID`;
              } else {
                // Try to match by index
                const parts = globalStageId.split("_");
                const stageIndex = parseInt(parts[parts.length - 1]);
                if (!isNaN(stageIndex) && stageIndex < pipeline.stages.length) {
                  newStageId = pipeline.stages[stageIndex].id;
                  updateReason = `missing currentStage, matched global stage by index ${stageIndex}`;
                } else {
                  newStageId = pipeline.stages[0].id;
                  updateReason = "missing currentStage, set to first stage";
                }
              }
            } else {
              newStageId = pipeline.stages[0].id;
              updateReason = "missing currentStage, set to first stage";
            }
            needsUpdate = true;
          }
          // Check if currentStage is a stage name (not a valid stage ID format)
          else if (!currentStage.startsWith("stage_")) {
            // Try to find stage by name (case-insensitive, fuzzy match)
            const stageName = currentStage.toLowerCase().trim();

            // Try exact match first
            let matchedStage = pipeline.stages.find(
              (s: any) => s.name?.toLowerCase().trim() === stageName
            );

            // Try partial match
            if (!matchedStage) {
              matchedStage = pipeline.stages.find(
                (s: any) =>
                  s.name?.toLowerCase().includes(stageName) ||
                  stageName.includes(s.name?.toLowerCase())
              );
            }

            if (matchedStage) {
              newStageId = matchedStage.id;
              updateReason = `matched stage name "${currentStage}" to "${matchedStage.name}"`;
            } else {
              newStageId = pipeline.stages[0].id;
              updateReason = `could not match stage name "${currentStage}", set to first stage`;
            }
            needsUpdate = true;
          }
          // Check if currentStage exists in the pipeline
          else {
            const stageExists = pipeline.stages.some(
              (s: any) => s.id === currentStage
            );
            if (!stageExists) {
              // Try to match by index
              const parts = currentStage.split("_");
              const stageIndex = parseInt(parts[parts.length - 1]);

              if (!isNaN(stageIndex) && stageIndex < pipeline.stages.length) {
                newStageId = pipeline.stages[stageIndex].id;
                updateReason = `stage ID mismatch, matched by index ${stageIndex}`;
                needsUpdate = true;
              } else {
                // Fallback to first stage
                newStageId = pipeline.stages[0].id;
                updateReason = `stage not found in pipeline, set to first stage`;
                needsUpdate = true;
              }
            }
          }

          if (updateReason) {
            const job = jobs.find((j) => j.id === jobId);
            const stageName =
              pipeline.stages.find((s: any) => s.id === newStageId)?.name ||
              "Unknown";
            console.log(`   📝 ${candidateName} - Job: ${job?.title || jobId}`);
            console.log(`      Reason: ${updateReason}`);
            console.log(`      New stage: ${newStageId} (${stageName})`);
          }

          return {
            ...app,
            currentStage: newStageId,
            lastStatusChange: new Date().toISOString(),
          };
        });

        if (needsUpdate) {
          await db.collection("candidates").doc(candidateId).update({
            jobApplications: updatedJobApplications,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(`✅ ${candidateName} - Fixed jobApplications\n`);
          fixedCount++;
        } else {
          console.log(
            `✅ ${candidateName} - All jobApplications already correct`
          );
          skippedCount++;
        }
      } catch (error) {
        console.error(
          `❌ Error fixing ${candidate.firstName} ${candidate.lastName}:`,
          error
        );
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Fix Summary:");
    console.log(`   ✅ Fixed: ${fixedCount}`);
    console.log(`   ⏭️  Skipped (already correct): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log("=".repeat(50));
  } catch (error) {
    console.error("❌ Fix failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

fixJobApplications();
