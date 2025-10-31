// services/resumeScoringService.js

const axios = require("axios");
const logger = require("../utils/logger");
const { db } = require("./firebaseService");

/**
 * Score a candidate's resume against a job
 * @param {Object} candidateData - The candidate data
 * @param {string} jobId - The job ID to score against
 * @returns {Promise<Object>} - The scoring result
 */
const scoreCandidateResume = async (candidateData, jobId) => {
  try {
    // Get the job data
    const jobData = await getJobData(jobId);

    if (!jobData) {
      logger.warn(`Job with ID ${jobId} not found, skipping scoring`);
      return null;
    }

    // Prepare resume data for scoring
    const resumeData = {
      name: candidateData.name || "",
      skills: candidateData.skills || [],
      experience: candidateData.experience || "",
      education: candidateData.education || "",
      jobTitle: candidateData.jobTitle || "",
    };

    // Call the scoring API
    const response = await axios.post(
      `${process.env.API_BASE_URL || "http://localhost:3001"}/api/resume/score`,
      {
        resumeData,
        jobData,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.API_KEY || "",
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to score resume");
    }

    const scoreResult = response.data.data;

    // Add some metadata to the score
    const scoringMetadata = {
      jobId,
      jobTitle: jobData.title,
      scoredAt: new Date().toISOString(),
    };

    return {
      ...scoreResult,
      metadata: scoringMetadata,
    };
  } catch (error) {
    logger.error(`Error scoring resume: ${error.message}`, error);
    return null;
  }
};

/**
 * Get job data from Firestore
 * @param {string} jobId - The job ID
 * @returns {Promise<Object|null>} - The job data or null
 */
const getJobData = async (jobId) => {
  try {
    const jobRef = db.collection("jobs").doc(jobId);
    const jobSnapshot = await jobRef.get();

    if (!jobSnapshot.exists) {
      logger.warn(`Job with ID ${jobId} does not exist`);
      return null;
    }

    const jobData = jobSnapshot.data();

    // Extract skill requirements
    const requiredSkills = jobData.requiredSkills || [];
    const preferredSkills = jobData.preferredSkills || [];

    // Extract other job requirements
    return {
      id: jobId,
      title: jobData.title || "",
      requiredSkills,
      preferredSkills,
      experience: jobData.experience || "",
      education: jobData.education || "",
      certifications: jobData.certifications || [],
    };
  } catch (error) {
    logger.error(`Error fetching job data: ${error.message}`, error);
    return null;
  }
};

/**
 * Save the score result to the candidate document
 * @param {string} candidateId - The candidate ID
 * @param {Object} scoreResult - The score result
 * @returns {Promise<boolean>} - Success status
 */
const saveCandidateScore = async (candidateId, scoreResult) => {
  try {
    if (!candidateId || !scoreResult) {
      logger.warn("Missing candidateId or scoreResult, skipping save");
      return false;
    }

    const candidateRef = db.collection("candidates").doc(candidateId);

    // Create a history entry
    const historyEntry = {
      date: new Date().toISOString(),
      note: `Resume scored against job "${scoreResult.metadata.jobTitle}" with a match of ${scoreResult.finalScore}%`,
    };

    // Update the candidate document
    await candidateRef.update({
      resumeScore: scoreResult.finalScore,
      resumeScoringDetails: scoreResult,
      history: historyEntry, // Use arrayUnion to append to the history array
      updatedAt: new Date().toISOString(),
    });

    logger.info(
      `Score saved for candidate ${candidateId}: ${scoreResult.finalScore}%`
    );
    return true;
  } catch (error) {
    logger.error(`Error saving candidate score: ${error.message}`, error);
    return false;
  }
};

/**
 * Process a candidate's resume for scoring
 * @param {Object} candidateData - The candidate data
 * @param {string} jobId - The job ID to score against
 * @returns {Promise<Object|null>} - The scoring result or null
 */
const processResumeScoring = async (candidateData, jobId) => {
  try {
    if (!candidateData || !jobId) {
      logger.warn("Missing candidateData or jobId, skipping scoring");
      return null;
    }

    logger.info(
      `Processing resume scoring for ${candidateData.name} against job ${jobId}`
    );

    // Score the resume
    const scoreResult = await scoreCandidateResume(candidateData, jobId);

    if (!scoreResult) {
      logger.warn(`Failed to score resume for ${candidateData.id}`);
      return null;
    }

    // Save the score to the candidate document
    if (candidateData.id) {
      await saveCandidateScore(candidateData.id, scoreResult);
    }

    return scoreResult;
  } catch (error) {
    logger.error(`Error in resume scoring process: ${error.message}`, error);
    return null;
  }
};

module.exports = {
  scoreCandidateResume,
  saveCandidateScore,
  processResumeScoring,
  getJobData,
};
