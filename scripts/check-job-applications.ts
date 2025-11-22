import admin from "firebase-admin";
import * as path from "path";

const serviceAccount = require(
  path.join(__dirname, "..", "firebase_config.json")
);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function checkData() {
  const candidates = await db.collection("candidates").get();

  console.log("Current jobApplications data:\n");

  for (const doc of candidates.docs) {
    const data = doc.data();
    console.log(`${data.firstName} ${data.lastName}:`);
    console.log(`  currentPipelineStageId: ${data.currentPipelineStageId}`);

    if (data.jobApplications && data.jobApplications.length > 0) {
      data.jobApplications.forEach((app: any) => {
        console.log(`  Job ${app.jobId}:`);
        console.log(`    currentStage: ${app.currentStage}`);
        console.log(`    status: ${app.status}`);
      });
    } else {
      console.log("  No jobApplications");
    }
    console.log("");
  }

  process.exit(0);
}

checkData().catch((err) => {
  console.error(err);
  process.exit(1);
});
