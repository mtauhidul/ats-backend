import admin from "firebase-admin";
import * as path from "path";

const serviceAccount = require(
  path.join(__dirname, "..", "firebase_config.json")
);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function checkCandidates() {
  const candidates = await db.collection("candidates").get();

  console.log("=== ALL CANDIDATES ===\n");

  candidates.forEach((doc) => {
    const c = doc.data();
    console.log(`Candidate: ${c.firstName} ${c.lastName} (${doc.id})`);
    console.log(`  Status: ${c.status}`);
    console.log(`  JobIds: ${c.jobIds?.join(", ") || "none"}`);
    console.log(`  Global currentStage: ${c.currentStage}`);
    console.log(`  Global currentPipelineStageId: ${c.currentPipelineStageId}`);

    if (c.jobApplications && c.jobApplications.length > 0) {
      console.log(`  Job Applications:`);
      c.jobApplications.forEach((app: any) => {
        console.log(`    - Job: ${app.jobId}`);
        console.log(`      Status: ${app.status}`);
        console.log(`      Current Stage: ${app.currentStage}`);
        console.log(
          `      Applied: ${app.appliedAt?.toDate?.() || app.appliedAt}`
        );
      });
    } else {
      console.log(`  Job Applications: NONE`);
    }
    console.log("");
  });
}

checkCandidates().then(() => process.exit(0));
