import admin from "firebase-admin";
import * as path from "path";

const serviceAccount = require(
  path.join(__dirname, "..", "firebase_config.json")
);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function restoreHannah() {
  console.log("🚀 Restoring Hannah Suarez...\n");

  try {
    // Hannah's data based on what we saw earlier
    const hannahData = {
      firstName: "Hannah",
      lastName: "Suarez",
      email: "hannah.suarez@example.com", // You may need to update this
      phone: "+1234567890", // You may need to update this
      status: "active",
      jobIds: [
        "G9WkZwUwPR2oQQVOvIHm", // Medical Virtual Assistant
        "f3BlFgoDeDv3ysfN0CcE", // Virtual Medical Receptionist
      ],
      jobApplications: [
        {
          jobId: "G9WkZwUwPR2oQQVOvIHm",
          status: "active",
          appliedAt: admin.firestore.Timestamp.fromDate(
            new Date("2025-01-18T16:45:05.193Z")
          ),
          currentStage: "stage_1763612336957_0", // Short listed Candidates
          lastStatusChange: admin.firestore.Timestamp.fromDate(
            new Date("2025-01-18T20:21:56.334Z")
          ),
          emailIds: [],
          emailsSent: 0,
          emailsReceived: 0,
          resumeScore: 75,
          applicationId: "h8VaEIujtpkPWk7hxgbY",
        },
        {
          jobId: "f3BlFgoDeDv3ysfN0CcE",
          status: "active",
          appliedAt: new Date("2025-11-20T04:05:06.015Z"),
          currentStage: "stage_1763612161072_0", // Shortlisted Applicants
          lastStatusChange: new Date("2025-11-20T04:05:06.015Z"),
          emailIds: [],
          emailsSent: 0,
          emailsReceived: 0,
        },
      ],
      currentPipelineStageId: "stage_1763612336957_0",
      currentStage: "stage_1763611917168_0",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Create the candidate
    const candidateRef = await db.collection("candidates").add(hannahData);

    console.log(`✅ Hannah Suarez restored with ID: ${candidateRef.id}`);
    console.log(`   Email: ${hannahData.email}`);
    console.log(`   Jobs: ${hannahData.jobIds.length}`);
    console.log(`   - Medical Virtual Assistant: Short listed Candidates`);
    console.log(`   - Virtual Medical Receptionist: Shortlisted Applicants`);

    // Update jobs to include this candidate
    const job1 = await db.collection("jobs").doc("G9WkZwUwPR2oQQVOvIHm").get();
    const job2 = await db.collection("jobs").doc("f3BlFgoDeDv3ysfN0CcE").get();

    if (job1.exists) {
      const job1Data = job1.data();
      const candidateIds = job1Data?.candidateIds || [];
      if (!candidateIds.includes(candidateRef.id)) {
        await db
          .collection("jobs")
          .doc("G9WkZwUwPR2oQQVOvIHm")
          .update({
            candidateIds: [...candidateIds, candidateRef.id],
          });
        console.log(`   ✅ Added to Medical Virtual Assistant job`);
      }
    }

    if (job2.exists) {
      const job2Data = job2.data();
      const candidateIds = job2Data?.candidateIds || [];
      if (!candidateIds.includes(candidateRef.id)) {
        await db
          .collection("jobs")
          .doc("f3BlFgoDeDv3ysfN0CcE")
          .update({
            candidateIds: [...candidateIds, candidateRef.id],
          });
        console.log(`   ✅ Added to Virtual Medical Receptionist job`);
      }
    }

    console.log("\n✅ Hannah Suarez successfully restored!");
    console.log("\nNote: Please update the following fields if needed:");
    console.log("  - email");
    console.log("  - phone");
    console.log("  - resume/CV");
    console.log("  - any other personal details");
  } catch (error) {
    console.error("❌ Restoration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

restoreHannah();
