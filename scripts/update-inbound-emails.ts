import mongoose from "mongoose";
import dotenv from "dotenv";
import { Email } from "../src/models";
import { Candidate } from "../src/models";
import { Application } from "../src/models";

// Load environment first
dotenv.config();

/**
 * Update existing inbound emails to link them to applications and jobs
 * Run this script once to fix emails that were synced before the update
 */

const updateInboundEmails = async () => {
  try {
    console.log("Connecting to database...");
    
    // Get all inbound emails without jobId
    const emails = await Email.find({
      direction: "inbound",
      candidateId: { $exists: true },
      jobId: { $exists: false },
    });

    console.log(`Found ${emails.length} inbound emails without job links`);

    for (const email of emails) {
      try {
        const candidate = await Candidate.findById(email.candidateId);
        
        if (candidate) {
          // Find the most recent application
          const latestApplication = await Application.findOne({
            candidateId: candidate._id,
          })
            .sort({ createdAt: -1 })
            .populate("jobId");

          if (latestApplication) {
            email.applicationId = latestApplication._id as any;
            email.jobId = latestApplication.jobId?._id || latestApplication.jobId;
            
            await email.save();
            console.log(
              `✓ Updated email ${email._id} - linked to job ${email.jobId}`
            );
          } else {
            console.log(
              `⚠ Email ${email._id} - no application found for candidate`
            );
          }
        }
      } catch (error) {
        console.error(`✗ Error updating email ${email._id}:`, error);
      }
    }

    console.log("\nUpdate completed!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

// Run if executed directly
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ats";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    return updateInboundEmails();
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });
