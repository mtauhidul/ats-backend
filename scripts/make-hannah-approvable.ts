import admin from "firebase-admin";
import * as path from "path";

const serviceAccount = require(
  path.join(__dirname, "..", "firebase_config.json")
);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function makeHannahApprovable() {
  console.log("🔍 Checking Hannah's applications...\n");

  try {
    // Find Hannah's applications
    const appsSnapshot = await db
      .collection("applications")
      .where("firstName", "==", "Hannah")
      .where("lastName", "==", "Suarez")
      .get();

    console.log(`Found ${appsSnapshot.size} application(s)\n`);

    if (appsSnapshot.empty) {
      console.log("✅ No applications found - Hannah can apply fresh");
      process.exit(0);
      return;
    }

    // Update each application to pending status
    for (const doc of appsSnapshot.docs) {
      const data = doc.data();
      console.log(`📝 Application ID: ${doc.id}`);
      console.log(`   Current Status: ${data.status}`);
      console.log(`   Job ID: ${data.targetJobId || data.jobId}`);
      console.log(`   Email: ${data.email}`);

      // Reset to pending so it can be approved again
      await doc.ref.update({
        status: "pending",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`   ✅ Status updated to: pending\n`);
    }

    console.log("✅ All Hannah's applications are now approvable!");
  } catch (error) {
    console.error("❌ Failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

makeHannahApprovable();
