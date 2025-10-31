// api/score-resume.js

const express = require("express");
const router = express.Router();
const cors = require("cors");
const {
  scoreResume,
  extractJobRequirements,
} = require("../utils/resumeScoring");
const logger = require("../utils/logger");

// Enable CORS for the router
router.use(cors());

/**
 * Score a resume against a job
 * POST /api/resume/score
 */
router.post("/score", async (req, res, next) => {
  try {
    const { resumeData, jobData } = req.body;

    if (!resumeData) {
      return res.status(400).json({
        success: false,
        error: "Resume data is required",
      });
    }

    if (!jobData) {
      return res.status(400).json({
        success: false,
        error: "Job data is required",
      });
    }

    logger.info(
      `Scoring resume for candidate: ${resumeData.name} against job: ${jobData.title}`
    );

    // Get the score
    const scoreResult = await scoreResume(resumeData, jobData);

    return res.json({
      success: true,
      data: scoreResult,
    });
  } catch (error) {
    logger.error("Error scoring resume:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to score resume",
      details: error.message,
    });
  }
});

/**
 * Extract job requirements from job description
 * POST /api/resume/extract-job
 */
router.post("/extract-job", async (req, res, next) => {
  try {
    const { jobTitle, jobDescription } = req.body;

    if (!jobTitle || !jobDescription) {
      return res.status(400).json({
        success: false,
        error: "Job title and description are required",
      });
    }

    logger.info(`Extracting requirements for job: ${jobTitle}`);

    // Extract the job requirements
    const jobRequirements = await extractJobRequirements(
      jobTitle,
      jobDescription
    );

    return res.json({
      success: true,
      data: jobRequirements,
    });
  } catch (error) {
    logger.error("Error extracting job requirements:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to extract job requirements",
      details: error.message,
    });
  }
});

module.exports = router;
