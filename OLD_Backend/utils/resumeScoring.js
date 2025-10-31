// utils/resumeScoring.js
const logger = require("./logger");
const { OpenAI } = require("openai");

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Import enhanced AI service for improved scoring accuracy
const EnhancedAIService = require("../services/enhancedAIService");
const enhancedAI = new EnhancedAIService();

/**
 * Score a candidate's resume against a job with enhanced accuracy
 * @param {Object} resumeData - The parsed resume data
 * @param {Object} jobData - The job data
 * @returns {Promise<Object>} The scoring results
 */
const scoreResume = async (resumeData, jobData) => {
  try {
    if (!resumeData || !jobData) {
      throw new Error("Missing resume data or job data");
    }

    logger.info(
      `Starting enhanced scoring for candidate: ${resumeData.name} against job: ${jobData.title}`
    );

    // Try enhanced AI service first for better accuracy
    try {
      const enhancedResult = await enhancedAI.scoreResume(resumeData, jobData);
      logger.info(
        `Enhanced AI scoring successful for ${resumeData.name}: ${enhancedResult.finalScore}%`
      );
      return enhancedResult;
    } catch (enhancedError) {
      logger.warn(
        `Enhanced AI scoring failed, falling back to original method`,
        {
          candidate: resumeData.name,
          error: enhancedError.message,
        }
      );
    }

    // Fallback to improved original method
    const result = await getAIScore(resumeData, jobData);

    // Log the scoring result
    logger.info(`Resume score for ${resumeData.name}: ${result.finalScore}%`);

    return result;
  } catch (error) {
    logger.error(`Error scoring resume: ${error.message}`, error);
    // Return a default score object with zero values in case of error
    return {
      finalScore: 0,
      componentScores: {
        skillScore: 0,
        experienceScore: 0,
        educationScore: 0,
        jobTitleScore: 0,
        certScore: 0,
      },
      matchedSkills: [],
      missingSkills: [],
      feedback: "Error during scoring: " + error.message,
    };
  }
};

/**
 * Use OpenAI to score a resume against a job
 * @param {Object} resumeData - The parsed resume data
 * @param {Object} jobData - The job data
 * @returns {Promise<Object>} The AI scoring results
 */
const getAIScore = async (resumeData, jobData) => {
  try {
    const prompt = buildScoringPrompt(resumeData, jobData);

    logger.info(
      `Scoring ${resumeData.name} for ${
        jobData.title
      } - Required skills: ${JSON.stringify(jobData.requiredSkills)}`
    );

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert resume scoring system. You will evaluate how well a candidate's 
          profile matches a job description. You will break down the scoring based on skills, 
          experience, education, job title similarity, and certifications. Your analysis should be 
          objective, data-driven, and highly accurate.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);

    logger.info(
      `AI Score Result for ${resumeData.name}: ${result.finalScore}% for ${jobData.title}`
    );
    logger.info(
      `Component breakdown: Skills=${result.componentScores?.skillScore}%, Experience=${result.componentScores?.experienceScore}%, Education=${result.componentScores?.educationScore}%`
    );

    // Ensure all required fields are present
    return {
      finalScore: result.finalScore || 0,
      componentScores: {
        skillScore: result.componentScores?.skillScore || 0,
        experienceScore: result.componentScores?.experienceScore || 0,
        educationScore: result.componentScores?.educationScore || 0,
        jobTitleScore: result.componentScores?.jobTitleScore || 0,
        certScore: result.componentScores?.certScore || 0,
      },
      matchedSkills: result.matchedSkills || [],
      missingSkills: result.missingSkills || [],
      feedback: result.feedback || "No feedback provided",
    };
  } catch (error) {
    logger.error(`Error in AI scoring: ${error.message}`, error);
    throw new Error(`AI scoring failed: ${error.message}`);
  }
};

/**
 * Build a prompt for the OpenAI scoring system
 * @param {Object} resumeData - The parsed resume data
 * @param {Object} jobData - The job data
 * @returns {string} The prompt for OpenAI
 */
const buildScoringPrompt = (resumeData, jobData) => {
  const timestamp = new Date().toISOString();
  const jobId = jobData.id || `job_${Date.now()}`;

  return `
Please analyze how well this candidate matches the job requirements, and provide a score based on the following criteria:

## Job Analysis Request ID: ${jobId}
## Analysis Timestamp: ${timestamp}

## Job Details:
- Title: ${jobData.title}
- Required Skills: ${JSON.stringify(jobData.requiredSkills || [])}
- Preferred Skills: ${JSON.stringify(jobData.preferredSkills || [])}
- Minimum Experience: ${jobData.experience || "Not specified"}
- Required Education: ${jobData.education || "Not specified"}

## Candidate Resume:
- Name: ${resumeData.name}
- Skills: ${JSON.stringify(resumeData.skills || [])}
- Experience: ${resumeData.experience || "Not specified"}
- Education: ${resumeData.education || "Not specified"}
- Job Title: ${resumeData.jobTitle || "Not specified"}

IMPORTANT: Analyze this specific job-candidate pairing independently. Consider the exact skill matches, experience relevance, and education alignment for THIS PARTICULAR JOB.

Scoring Criteria:
1. Skill Match (40%): Compare required and preferred skills
2. Job Title Relevance (20%): Match previous roles to target role
3. Years of Experience (20%): Check if they meet minimum experience
4. Education Match (10%): Compare required degree or certification
5. Bonus/Certifications (10%): Check for other relevant qualifications

Provide your assessment as a JSON object with the following structure:
{
  "finalScore": number, // 0-100 overall match percentage
  "componentScores": {
    "skillScore": number, // 0-100 for skill match
    "experienceScore": number, // 0-100 for experience match
    "educationScore": number, // 0-100 for education match
    "jobTitleScore": number, // 0-100 for job title relevance
    "certScore": number // 0-100 for certifications/bonus
  },
  "matchedSkills": string[], // List of skills that matched
  "missingSkills": string[], // List of required skills that were missing
  "feedback": string // Brief explanation of the score and areas for improvement
}`;
};

/**
 * Extract job requirements from job title and description with enhanced accuracy
 * @param {string} jobTitle - The job title
 * @param {string} jobDescription - The job description
 * @returns {Promise<Object>} The extracted job requirements
 */
const extractJobRequirements = async (jobTitle, jobDescription) => {
  try {
    if (!jobTitle || !jobDescription) {
      throw new Error("Missing job title or description");
    }

    logger.info(`Starting enhanced job extraction for: ${jobTitle}`);

    // Try enhanced AI service first for better accuracy
    try {
      const enhancedResult = await enhancedAI.extractJobRequirements(
        jobTitle,
        jobDescription
      );
      logger.info(`Enhanced job extraction successful for ${jobTitle}`);
      return enhancedResult;
    } catch (enhancedError) {
      logger.warn(
        `Enhanced job extraction failed, falling back to original method`,
        {
          jobTitle,
          error: enhancedError.message,
        }
      );
    }

    // Fallback to improved original method
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a senior talent acquisition strategist with expertise in job analysis. Extract comprehensive hiring criteria with high precision.

          EXTRACTION REQUIREMENTS:
          - Must-have skills: Non-negotiable technical and soft skills
          - Nice-to-have skills: Preferred but not required qualifications  
          - Hidden requirements: Skills implied from job context
          - Experience level: Minimum years and relevant background
          - Education requirements: Degree level, field of study, alternatives
          - Certifications: Professional credentials and licenses

          ANALYSIS DEPTH:
          - Identify skills mentioned explicitly and contextually
          - Distinguish between different seniority levels
          - Extract domain-specific knowledge requirements
          - Note any unique or specialized qualifications
          
          OUTPUT QUALITY:
          - Comprehensive skill extraction from entire job description
          - Clear categorization of required vs. preferred
          - Accurate experience level interpretation`,
        },
        {
          role: "user",
          content: `
          Analyze this job posting for comprehensive requirement extraction:

          JOB TITLE: ${jobTitle}
          
          JOB DESCRIPTION:
          ${jobDescription}
          
          Extract and categorize:
          1. Required skills (must-have technical and soft skills)
          2. Preferred skills (nice-to-have qualifications)
          3. Minimum years of experience and type
          4. Required education level and field
          5. Required certifications and licenses
          6. Any implied or contextual requirements
          
          Format as JSON:
          {
            "requiredSkills": string[],
            "preferredSkills": string[],
            "experience": string,
            "education": string,
            "certifications": string[]
          }
          
          Be thorough - extract skills mentioned throughout the entire description.`,
        },
      ],
      temperature: 0.2, // Lower temperature for better accuracy
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Enhanced validation and processing
    const processedResult = {
      title: jobTitle,
      requiredSkills: (result.requiredSkills || []).filter(
        (skill) => skill && skill.trim().length > 0
      ),
      preferredSkills: (result.preferredSkills || []).filter(
        (skill) => skill && skill.trim().length > 0
      ),
      experience: result.experience || "",
      education: result.education || "",
      certifications: (result.certifications || []).filter(
        (cert) => cert && cert.trim().length > 0
      ),
      extractionTimestamp: new Date().toISOString(),
      extractionMethod: "enhanced_ai_v2",
    };

    logger.info(`Job extraction completed for ${jobTitle}`, {
      requiredSkills: processedResult.requiredSkills.length,
      preferredSkills: processedResult.preferredSkills.length,
    });

    return processedResult;
  } catch (error) {
    logger.error(`Error extracting job requirements: ${error.message}`, error);
    // Return a basic object with the job title
    return {
      title: jobTitle || "Unknown Position",
      requiredSkills: [],
      preferredSkills: [],
      experience: "",
      education: "",
      certifications: [],
      extractionTimestamp: new Date().toISOString(),
      extractionMethod: "fallback",
    };
  }
};

module.exports = {
  scoreResume,
  extractJobRequirements,
};
