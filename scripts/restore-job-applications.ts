import admin from "firebase-admin";
import * as path from "path";

const serviceAccount = require(
  path.join(__dirname, "..", "firebase_config.json")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function restoreOriginalData() {
  console.log("🚀 Restoring original jobApplications data...\n");

  // Hannah: Missing currentStage in first job, 'new' in second
  await db
    .collection("candidates")
    .doc("8JwsYDHEXCfrSxon5URP")
    .update({
      jobApplications: [
        {
          lastStatusChange: admin.firestore.Timestamp.fromDate(
            new Date("2025-01-18T20:21:56.334Z")
          ),
          emailIds: [],
          resumeScore: 75,
          appliedAt: admin.firestore.Timestamp.fromDate(
            new Date("2025-01-18T16:45:05.193Z")
          ),
          jobId: "G9WkZwUwPR2oQQVOvIHm",
          emailsSent: 0,
          status: "active",
          emailsReceived: 0,
          applicationId: "h8VaEIujtpkPWk7hxgbY",
          // Missing currentStage - should use candidate.currentPipelineStageId (stage_1763612336957_0)
        },
        {
          jobId: "f3BlFgoDeDv3ysfN0CcE",
          status: "active",
          appliedAt: "2025-11-20T04:05:06.015Z",
          currentStage: "new",
          lastStatusChange: "2025-11-20T04:05:06.015Z",
          emailIds: [],
          emailsSent: 0,
          emailsReceived: 0,
        },
      ],
    });
  console.log("✅ Restored Hannah Suarez");

  // Pettrus: Get doc and update
  const pettrusSnapshot = await db
    .collection("candidates")
    .where("firstName", "==", "Pettrus")
    .limit(1)
    .get();

  if (!pettrusSnapshot.empty) {
    const pettrusDoc = pettrusSnapshot.docs[0];
    const pettrusData = pettrusDoc.data();

    await pettrusDoc.ref.update({
      jobApplications: [
        {
          jobId: "f3BlFgoDeDv3ysfN0CcE",
          status: "active",
          currentStage: "Move to Candidate Pool",
          appliedAt:
            pettrusData.jobApplications?.[0]?.appliedAt ||
            new Date().toISOString(),
          lastStatusChange:
            pettrusData.jobApplications?.[0]?.lastStatusChange ||
            new Date().toISOString(),
          emailIds: [],
          emailsSent: 0,
          emailsReceived: 0,
        },
        {
          jobId: "G9WkZwUwPR2oQQVOvIHm",
          status: "active",
          currentStage: "new",
          appliedAt:
            pettrusData.jobApplications?.[1]?.appliedAt ||
            new Date().toISOString(),
          lastStatusChange:
            pettrusData.jobApplications?.[1]?.lastStatusChange ||
            new Date().toISOString(),
          emailIds: [],
          emailsSent: 0,
          emailsReceived: 0,
        },
      ],
    });
    console.log("✅ Restored Pettrus Ortega");
  }

  // Jhanella
  const jhanellaSnapshot = await db
    .collection("candidates")
    .where("firstName", "==", "Jhanella")
    .limit(1)
    .get();

  if (!jhanellaSnapshot.empty) {
    const jhanellaDoc = jhanellaSnapshot.docs[0];
    const jhanellaData = jhanellaDoc.data();

    await jhanellaDoc.ref.update({
      jobApplications: [
        {
          jobId: "f3BlFgoDeDv3ysfN0CcE",
          status: "active",
          currentStage: "Move to Candidate Pool",
          appliedAt:
            jhanellaData.jobApplications?.[0]?.appliedAt ||
            new Date().toISOString(),
          lastStatusChange:
            jhanellaData.jobApplications?.[0]?.lastStatusChange ||
            new Date().toISOString(),
          emailIds: [],
          emailsSent: 0,
          emailsReceived: 0,
        },
      ],
    });
    console.log("✅ Restored Jhanella Arabit");
  }

  // Josilyn
  const josilynSnapshot = await db
    .collection("candidates")
    .where("firstName", "==", "Josilyn")
    .limit(1)
    .get();

  if (!josilynSnapshot.empty) {
    const josilynDoc = josilynSnapshot.docs[0];
    const josilynData = josilynDoc.data();

    await josilynDoc.ref.update({
      jobApplications: [
        {
          jobId: "f3BlFgoDeDv3ysfN0CcE",
          status: "active",
          currentStage: "Offer Extended",
          appliedAt:
            josilynData.jobApplications?.[0]?.appliedAt ||
            new Date().toISOString(),
          lastStatusChange:
            josilynData.jobApplications?.[0]?.lastStatusChange ||
            new Date().toISOString(),
          emailIds: [],
          emailsSent: 0,
          emailsReceived: 0,
        },
      ],
    });
    console.log("✅ Restored Josilyn Zamora");
  }

  console.log("\n✅ Restoration complete!");
  process.exit(0);
}

restoreOriginalData().catch((error) => {
  console.error("❌ Restoration failed:", error);
  process.exit(1);
});
