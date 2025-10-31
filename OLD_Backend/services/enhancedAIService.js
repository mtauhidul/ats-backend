// services/enhancedAIService.js
// Advanced AI service with improved accuracy and error handling

const { OpenAI } = require("openai");
const logger = require("../utils/logger");
const {
  AI_TASK_CONFIGS,
  ENHANCED_PROMPTS,
  VALIDATION_SCHEMAS,
  PERFORMANCE_CONFIG,
} = require("../config/aiConfig");

class EnhancedAIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 60000, // 60 second timeout
      maxRetries: 3,
    });

    this.metrics = {
      totalRequests: 0,
      totalTokens: 0,
      averageLatency: 0,
      errorRate: 0,
    };
  }

  /**
   * Enhanced resume parsing with improved accuracy
   */
  async parseResume(resumeText, filename) {
    const startTime = Date.now();
    const config = AI_TASK_CONFIGS.RESUME_PARSING;
    const taskId = `parse_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    try {
      logger.info(`Starting enhanced resume parsing`, { taskId, filename });

      const systemPrompt = ENHANCED_PROMPTS.RESUME_PARSING.system;
      const userPrompt = ENHANCED_PROMPTS.RESUME_PARSING.user(resumeText);

      const requestOptions = {
        model: config.model.name,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: config.temperature,
        max_tokens: config.model.maxTokens,
        response_format: config.responseFormat,
        top_p: config.topP || 0.1,
        frequency_penalty: config.frequencyPenalty || 0.1,
        presence_penalty: config.presencePenalty || 0.1,
        // Enhanced parameters for maximum accuracy
      };

      const response = await this._makeAIRequest(requestOptions, taskId);
      const parsedResult = this._parseAndValidateResponse(
        response,
        VALIDATION_SCHEMAS.RESUME_PARSING,
        taskId
      );

      // Enhanced post-processing
      const enhancedResult = this._enhanceResumeData(parsedResult, filename);

      // Validate that we have meaningful data before returning
      if (!this._hasValidData(enhancedResult)) {
        throw new Error("Enhanced AI parsing returned invalid or empty data");
      }

      const latency = Date.now() - startTime;
      this._recordMetrics("resume_parsing", latency, response.usage);

      logger.info(`Resume parsing completed successfully`, {
        taskId,
        latency: `${latency}ms`,
        tokensUsed: response.usage?.total_tokens || 0,
      });

      return enhancedResult;
    } catch (error) {
      this._recordError("resume_parsing", error, taskId);
      logger.error(`Enhanced resume parsing failed`, {
        taskId,
        error: error.message,
      });
      throw new Error(`AI resume parsing failed: ${error.message}`);
    }
  }

  /**
   * Enhanced resume scoring with improved analysis depth
   */
  async scoreResume(resumeData, jobData) {
    const startTime = Date.now();
    const config = AI_TASK_CONFIGS.RESUME_SCORING;
    const analysisId = `score_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    try {
      logger.info(`Starting enhanced resume scoring`, {
        analysisId,
        candidate: resumeData.name,
        position: jobData.title,
      });

      const systemPrompt = ENHANCED_PROMPTS.RESUME_SCORING.system;
      const userPrompt = ENHANCED_PROMPTS.RESUME_SCORING.user(
        resumeData,
        jobData,
        analysisId
      );

      const requestOptions = {
        model: config.model.name,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: config.temperature,
        max_tokens: config.model.maxTokens,
        response_format: config.responseFormat,
        // timeout is set at client level, not request level
      };

      const response = await this._makeAIRequest(requestOptions, analysisId);
      const scoringResult = this._parseAndValidateResponse(
        response,
        VALIDATION_SCHEMAS.RESUME_SCORING,
        analysisId
      );

      // Enhanced post-processing with additional insights
      const enhancedScoring = this._enhanceScoringResult(
        scoringResult,
        resumeData,
        jobData
      );

      const latency = Date.now() - startTime;
      this._recordMetrics("resume_scoring", latency, response.usage);

      logger.info(`Resume scoring completed successfully`, {
        analysisId,
        finalScore: enhancedScoring.finalScore,
        latency: `${latency}ms`,
        tokensUsed: response.usage?.total_tokens || 0,
      });

      return enhancedScoring;
    } catch (error) {
      this._recordError("resume_scoring", error, analysisId);
      logger.error(`Enhanced resume scoring failed`, {
        analysisId,
        error: error.message,
      });
      throw new Error(`AI resume scoring failed: ${error.message}`);
    }
  }

  /**
   * Enhanced job requirement extraction
   */
  async extractJobRequirements(jobTitle, jobDescription) {
    const startTime = Date.now();
    const config = AI_TASK_CONFIGS.JOB_EXTRACTION;
    const extractionId = `extract_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    try {
      logger.info(`Starting enhanced job extraction`, {
        extractionId,
        jobTitle,
      });

      const systemPrompt = ENHANCED_PROMPTS.JOB_EXTRACTION.system;
      const userPrompt = ENHANCED_PROMPTS.JOB_EXTRACTION.user(
        jobTitle,
        jobDescription
      );

      const requestOptions = {
        model: config.model.name,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: config.temperature,
        max_tokens: config.model.maxTokens,
        response_format: config.responseFormat,
        // timeout is set at client level, not request level
      };

      const response = await this._makeAIRequest(requestOptions, extractionId);
      const extractedResult = JSON.parse(response.choices[0].message.content);

      // Enhanced post-processing
      const enhancedResult = this._enhanceJobExtraction(
        extractedResult,
        jobTitle
      );

      const latency = Date.now() - startTime;
      this._recordMetrics("job_extraction", latency, response.usage);

      logger.info(`Job extraction completed successfully`, {
        extractionId,
        latency: `${latency}ms`,
        tokensUsed: response.usage?.total_tokens || 0,
      });

      return enhancedResult;
    } catch (error) {
      this._recordError("job_extraction", error, extractionId);
      logger.error(`Enhanced job extraction failed`, {
        extractionId,
        error: error.message,
      });
      throw new Error(`AI job extraction failed: ${error.message}`);
    }
  }

  /**
   * Make AI request with enhanced error handling and retries
   */
  async _makeAIRequest(requestOptions, taskId, retryCount = 0) {
    try {
      this.metrics.totalRequests++;
      const response = await this.client.chat.completions.create(
        requestOptions
      );

      if (!response.choices || response.choices.length === 0) {
        throw new Error("No response choices received from AI");
      }

      return response;
    } catch (error) {
      if (
        retryCount < requestOptions.maxRetries &&
        this._isRetryableError(error)
      ) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        logger.warn(`AI request failed, retrying in ${delay}ms`, {
          taskId,
          retryCount: retryCount + 1,
          error: error.message,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this._makeAIRequest(requestOptions, taskId, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Parse and validate AI response with STRICT quality control - NO FALLBACKS
   */
  _parseAndValidateResponse(response, schema, taskId) {
    try {
      const content = response.choices[0].message.content;
      let parsedData;

      // Log raw AI response for debugging
      logger.info(`Processing AI response for ${taskId}`, { 
        contentLength: content.length,
        hasJSON: content.includes('{') && content.includes('}')
      });

      // STRICT JSON parsing - no fallbacks or auto-correction
      try {
        parsedData = JSON.parse(content);
      } catch (parseError) {
        logger.error(`AI returned invalid JSON for ${taskId}`, { 
          error: parseError.message,
          content: content.substring(0, 200) + '...'
        });
        throw new Error(`PARSING FAILED: AI returned malformed JSON - ${parseError.message}`);
      }

      // CRITICAL FIELD VALIDATION - fail immediately if missing
      if (schema.criticalFields) {
        for (const field of schema.criticalFields) {
          if (!parsedData.hasOwnProperty(field) || parsedData[field] === undefined || parsedData[field] === null) {
            throw new Error(`CRITICAL FIELD MISSING: ${field} - Resume parsing failed completely`);
          }
          
          // Validate critical field with strict rules
          if (schema.validators && schema.validators[field]) {
            if (!schema.validators[field](parsedData[field])) {
              throw new Error(`CRITICAL FIELD INVALID: ${field} = "${parsedData[field]}" - Does not meet quality standards`);
            }
          }
        }
      }

      // STRICT FIELD VALIDATION - no auto-correction or defaults
      if (schema.validators) {
        for (const [field, validator] of Object.entries(schema.validators)) {
          if (parsedData.hasOwnProperty(field) && parsedData[field] !== undefined && parsedData[field] !== null) {
            if (!validator(parsedData[field])) {
              logger.error(`VALIDATION FAILED for ${field}`, { 
                taskId, 
                value: parsedData[field],
                type: typeof parsedData[field]
              });
              throw new Error(`FIELD VALIDATION FAILED: ${field} contains invalid data "${parsedData[field]}" - Resume parsing failed`);
            }
          }
        }
      }

      // COMPREHENSIVE QUALITY CHECKS
      if (schema.qualityChecks) {
        // Check minimum data completeness
        if (!schema.qualityChecks.dataCompleteness(parsedData)) {
          throw new Error(`INSUFFICIENT DATA QUALITY: Extracted data does not meet minimum completeness threshold`);
        }

        // Check for AI-generated placeholder data
        if (!schema.qualityChecks.noPlaceholderData(parsedData)) {
          throw new Error(`PLACEHOLDER DATA DETECTED: AI returned generic or template information instead of real data`);
        }

        // Check internal data consistency
        if (!schema.qualityChecks.dataConsistency(parsedData)) {
          throw new Error(`DATA INCONSISTENCY: Extracted information contains logical contradictions`);
        }
      }

      // Calculate and log data quality score
      const qualityScore = this._calculateDataQuality(parsedData);
      const extractedFieldCount = Object.keys(parsedData).filter(key => 
        parsedData[key] !== null && parsedData[key] !== undefined && 
        parsedData[key] !== "" && (!Array.isArray(parsedData[key]) || parsedData[key].length > 0)
      ).length;

      logger.info(`HIGH-QUALITY AI parsing successful`, {
        taskId,
        qualityScore,
        extractedFields: extractedFieldCount,
        hasName: !!parsedData.name,
        hasEmail: !!parsedData.email,
        skillsCount: Array.isArray(parsedData.skills) ? parsedData.skills.length : 0,
        experienceDetected: !!parsedData.experience
      });

      // Final validation - ensure quality threshold
      if (qualityScore < 60) {
        throw new Error(`DATA QUALITY TOO LOW: Quality score ${qualityScore}/100 - Resume parsing failed`);
      }

      return parsedData;
      
    } catch (error) {
      logger.error(`AI parsing failed - NO FALLBACK AVAILABLE`, {
        taskId,
        error: error.message,
        failure_type: 'strict_validation'
      });
      throw new Error(`Resume parsing failed: ${error.message}`);
    }
  }

  /**
   * Calculate comprehensive data quality score for parsed resume
   */
  _calculateDataQuality(data) {
    let score = 0;
    const maxScore = 100;
    
    // Weighted scoring for different data types
    const fieldWeights = {
      name: 20,          // Critical identification
      email: 15,         // Contact method
      skills: 20,        // Core competencies
      experience: 15,    // Work background
      phone: 10,         // Additional contact
      jobTitle: 10,      // Professional identity
      education: 8,      // Background
      location: 5,       // Geographic info
      linkedIn: 3,       // Professional network
      workHistory: 8,    // Detailed experience
      certifications: 5, // Additional qualifications
      languages: 3       // International capability
    };

    for (const [field, weight] of Object.entries(fieldWeights)) {
      if (data[field] && data[field] !== null && data[field] !== "") {
        if (Array.isArray(data[field])) {
          // Array fields get full score if non-empty
          if (data[field].length > 0) {
            score += weight;
          }
        } else if (typeof data[field] === 'string') {
          // String fields get full score if meaningful content
          if (data[field].trim().length > 2) {
            score += weight;
          }
        } else {
          // Other types get full score if present
          score += weight;
        }
      }
    }

    // Bonus points for comprehensive skill extraction
    if (Array.isArray(data.skills) && data.skills.length >= 5) {
      score += Math.min(10, data.skills.length - 4); // Up to 10 bonus points
    }

    // Bonus for work history detail
    if (Array.isArray(data.workHistory) && data.workHistory.length > 0) {
      score += 5;
    }

    return Math.min(maxScore, score);
  }

  /**
   * Enhanced resume data post-processing
   */
  _enhanceResumeData(parsedData, filename) {
    // Add metadata
    parsedData.originalFilename = filename;
    parsedData.parsingTimestamp = new Date().toISOString();
    parsedData.parsingMethod = "enhanced_ai_v2";

    // NOTE: resumeText is handled in the main parse-resume.js file
    // to ensure it always contains the original extracted text

    // Enhanced skill processing
    if (parsedData.skills) {
      parsedData.skills = this._processSkills(parsedData.skills);
      parsedData.skillCategories = this._categorizeSkills(parsedData.skills);
    }

    // Enhanced experience processing
    if (parsedData.experience) {
      parsedData.experienceYears = this._extractNumericExperience(
        parsedData.experience
      );
      parsedData.seniorityLevel = this._determineSeniorityLevel(
        parsedData.experienceYears
      );
    }

    // Enhanced education processing
    if (parsedData.education) {
      parsedData.educationLevel = this._determineEducationLevel(
        parsedData.education
      );
    }

    return parsedData;
  }

  /**
   * Enhanced scoring result post-processing
   */
  _enhanceScoringResult(scoringResult, resumeData, jobData) {
    // Add metadata
    scoringResult.analysisTimestamp = new Date().toISOString();
    scoringResult.analysisMethod = "enhanced_ai_v2";
    scoringResult.jobId = jobData.id;
    scoringResult.candidateId = resumeData.id || resumeData.name;

    // Calculate confidence scores
    scoringResult.confidenceScore =
      this._calculateConfidenceScore(scoringResult);

    // Add detailed skill analysis
    scoringResult.skillAnalysis = this._generateSkillAnalysis(
      resumeData.skills || [],
      jobData.requiredSkills || [],
      jobData.preferredSkills || []
    );

    // Add interview recommendations
    scoringResult.interviewFocus =
      this._generateInterviewRecommendations(scoringResult);

    // Add risk assessment
    scoringResult.riskFactors = this._assessRiskFactors(
      scoringResult,
      resumeData,
      jobData
    );

    return scoringResult;
  }

  /**
   * Enhanced job extraction post-processing
   */
  _enhanceJobExtraction(extractedResult, jobTitle) {
    extractedResult.extractionTimestamp = new Date().toISOString();
    extractedResult.extractionMethod = "enhanced_ai_v2";
    extractedResult.title = jobTitle;

    // Categorize and prioritize skills
    if (extractedResult.requiredSkills) {
      extractedResult.skillPriority = this._prioritizeSkills(
        extractedResult.requiredSkills
      );
    }

    // Determine role level
    extractedResult.roleLevel = this._determineRoleLevel(
      jobTitle,
      extractedResult.experience
    );

    // Add skill categories
    const allSkills = [
      ...(extractedResult.requiredSkills || []),
      ...(extractedResult.preferredSkills || []),
    ];
    extractedResult.skillCategories = this._categorizeSkills(allSkills);

    return extractedResult;
  }

  // Helper methods for enhanced processing
  _processSkills(skills) {
    return skills
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 1)
      .filter((skill, index, array) => array.indexOf(skill) === index); // Remove duplicates
  }

  _categorizeSkills(skills) {
    const categories = {
      technical: [],
      soft: [],
      tools: [],
      languages: [],
      frameworks: [],
    };

    const techPatterns =
      /programming|development|software|code|algorithm|database|api/i;
    const toolPatterns =
      /adobe|microsoft|google|aws|docker|kubernetes|jenkins/i;
    const languagePatterns =
      /javascript|python|java|c\+\+|c#|ruby|php|go|rust/i;
    const frameworkPatterns =
      /react|angular|vue|django|flask|spring|express|laravel/i;
    const softPatterns =
      /communication|leadership|teamwork|management|problem.solving|creativity/i;

    skills.forEach((skill) => {
      if (languagePatterns.test(skill)) categories.languages.push(skill);
      else if (frameworkPatterns.test(skill)) categories.frameworks.push(skill);
      else if (toolPatterns.test(skill)) categories.tools.push(skill);
      else if (techPatterns.test(skill)) categories.technical.push(skill);
      else if (softPatterns.test(skill)) categories.soft.push(skill);
      else categories.technical.push(skill); // Default to technical
    });

    return categories;
  }

  _extractNumericExperience(experienceStr) {
    const match = experienceStr.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
    return match ? parseFloat(match[1]) : 0;
  }

  _determineSeniorityLevel(years) {
    if (years < 2) return "Junior";
    if (years < 5) return "Mid-level";
    if (years < 8) return "Senior";
    return "Lead/Principal";
  }

  _determineEducationLevel(education) {
    if (/phd|doctorate|doctoral/i.test(education)) return "Doctorate";
    if (/master|mba|ms|ma/i.test(education)) return "Masters";
    if (/bachelor|bs|ba|degree/i.test(education)) return "Bachelors";
    if (/associate|aa|as/i.test(education)) return "Associate";
    return "Other";
  }

  _calculateConfidenceScore(scoringResult) {
    // Calculate based on score consistency and data completeness
    const scores = Object.values(scoringResult.componentScores);
    const variance = this._calculateVariance(scores);
    const completeness =
      (scoringResult.matchedSkills?.length || 0) +
      (scoringResult.missingSkills?.length || 0);

    let confidence = 100 - variance * 2; // Lower variance = higher confidence
    confidence = Math.max(50, Math.min(100, confidence)); // Clamp between 50-100

    return Math.round(confidence);
  }

  _calculateVariance(numbers) {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map((num) => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  }

  _generateSkillAnalysis(candidateSkills, requiredSkills, preferredSkills) {
    const matched = candidateSkills.filter(
      (skill) =>
        requiredSkills.some((req) =>
          req.toLowerCase().includes(skill.toLowerCase())
        ) ||
        preferredSkills.some((pref) =>
          pref.toLowerCase().includes(skill.toLowerCase())
        )
    );

    const missing = requiredSkills.filter(
      (skill) =>
        !candidateSkills.some((cand) =>
          cand.toLowerCase().includes(skill.toLowerCase())
        )
    );

    const bonus = candidateSkills.filter(
      (skill) =>
        !requiredSkills.some((req) =>
          req.toLowerCase().includes(skill.toLowerCase())
        ) &&
        !preferredSkills.some((pref) =>
          pref.toLowerCase().includes(skill.toLowerCase())
        )
    );

    return { matched, missing, bonus };
  }

  _generateInterviewRecommendations(scoringResult) {
    const recommendations = [];

    if (scoringResult.componentScores.skillScore < 70) {
      recommendations.push("Focus on technical assessment and skill gaps");
    }
    if (scoringResult.componentScores.experienceScore < 60) {
      recommendations.push("Explore past project experiences in detail");
    }
    if (scoringResult.finalScore > 85) {
      recommendations.push("Assess cultural fit and long-term goals");
    }

    return recommendations;
  }

  _assessRiskFactors(scoringResult, resumeData, jobData) {
    const risks = [];

    if (scoringResult.finalScore > 95) {
      risks.push({
        type: "overqualification",
        severity: "medium",
        description: "Candidate may be overqualified",
      });
    }

    if (scoringResult.componentScores.experienceScore < 50) {
      risks.push({
        type: "experience_gap",
        severity: "high",
        description: "Significant experience shortfall",
      });
    }

    return risks;
  }

  _prioritizeSkills(skills) {
    // Simple prioritization based on common high-value skills
    const highPriority = [
      "leadership",
      "management",
      "architecture",
      "security",
      "ai",
      "machine learning",
    ];
    const priorities = { high: [], medium: [], low: [] };

    skills.forEach((skill) => {
      if (highPriority.some((hp) => skill.toLowerCase().includes(hp))) {
        priorities.high.push(skill);
      } else {
        priorities.medium.push(skill);
      }
    });

    return priorities;
  }

  _determineRoleLevel(title, experience) {
    const titleLower = title.toLowerCase();
    if (/senior|lead|principal|staff|architect/i.test(titleLower))
      return "Senior";
    if (/junior|entry|associate|intern/i.test(titleLower)) return "Junior";
    return "Mid-level";
  }

  _isRetryableError(error) {
    // Determine if error is worth retrying
    const retryableErrors = [
      "rate_limit",
      "timeout",
      "connection",
      "server_error",
    ];
    return retryableErrors.some((type) =>
      error.message.toLowerCase().includes(type)
    );
  }

  _getDefaultValue(field, schema) {
    // Return sensible defaults for failed validations
    const defaults = {
      name: null, // Changed from "Unknown" to null to avoid placeholder values
      email: null,
      skills: [],
      experience: null, // Changed from "Not specified" to null
      resumeText: null, // Added resumeText default
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
      feedback: "Analysis unavailable",
    };

    return defaults[field] || null;
  }

  _recordMetrics(operation, latency, usage) {
    if (PERFORMANCE_CONFIG.enableMetrics) {
      this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2;
      this.metrics.totalTokens += usage?.total_tokens || 0;

      logger.info(`AI metrics recorded`, {
        operation,
        latency: `${latency}ms`,
        tokens: usage?.total_tokens || 0,
        totalRequests: this.metrics.totalRequests,
      });
    }
  }

  _recordError(operation, error, taskId) {
    this.metrics.errorRate =
      (this.metrics.errorRate * this.metrics.totalRequests + 1) /
      (this.metrics.totalRequests + 1);

    logger.error(`AI operation failed`, {
      operation,
      taskId,
      error: error.message,
      errorRate: `${(this.metrics.errorRate * 100).toFixed(2)}%`,
    });
  }

  /**
   * STRICT validation that parsed resume data contains high-quality, meaningful information
   */
  _hasValidData(data) {
    logger.info('Performing strict data validation', {
      dataKeys: Object.keys(data),
      name: data.name,
      skillsLength: Array.isArray(data.skills) ? data.skills.length : 0,
      hasEmail: !!data.email,
      hasExperience: !!data.experience
    });

    // MANDATORY FIELDS - parsing fails if any are missing or invalid
    const validations = {
      name: {
        check: () => {
          if (!data.name || typeof data.name !== 'string') return false;
          const trimmed = data.name.trim();
          
          // Must be real name, not placeholder
          const forbiddenNames = [
            'unknown', 'candidate', 'applicant', 'not provided', 'n/a', 
            'name', 'resume', 'cv', 'john doe', 'jane doe', 'not specified'
          ];
          if (forbiddenNames.some(forbidden => trimmed.toLowerCase().includes(forbidden))) {
            logger.error('Invalid placeholder name detected', { name: trimmed });
            return false;
          }
          
          // Must have at least 2 words (first + last name)
          const words = trimmed.split(/\s+/);
          if (words.length < 2 || trimmed.length < 3) {
            logger.error('Name too short or incomplete', { name: trimmed, wordCount: words.length });
            return false;
          }
          
          return true;
        },
        error: 'Name is missing or invalid'
      },

      skills: {
        check: () => {
          if (!Array.isArray(data.skills) || data.skills.length < 3) {
            logger.error('Insufficient skills extracted', { 
              isArray: Array.isArray(data.skills), 
              length: data.skills?.length 
            });
            return false;
          }

          // Check each skill is meaningful
          for (const skill of data.skills) {
            if (!skill || typeof skill !== 'string' || skill.trim().length < 2) {
              logger.error('Invalid skill found', { skill });
              return false;
            }
            
            // Reject generic/placeholder skills
            const genericSkills = [
              'skill', 'technology', 'tool', 'software', 'programming',
              'coding', 'development', 'experience', 'knowledge', 'familiar',
              'not specified', 'various', 'multiple'
            ];
            if (genericSkills.includes(skill.toLowerCase().trim())) {
              logger.error('Generic placeholder skill detected', { skill });
              return false;
            }
          }

          // Check for skill diversity
          const uniqueSkills = [...new Set(data.skills.map(s => s.toLowerCase().trim()))];
          if (uniqueSkills.length < Math.max(3, data.skills.length * 0.7)) {
            logger.error('Insufficient skill diversity', { 
              total: data.skills.length, 
              unique: uniqueSkills.length 
            });
            return false;
          }

          return true;
        },
        error: 'Skills array is missing, insufficient, or contains invalid data'
      },

      experience: {
        check: () => {
          if (!data.experience || typeof data.experience !== 'string') {
            logger.error('Experience missing or invalid type', { 
              hasExperience: !!data.experience, 
              type: typeof data.experience 
            });
            return false;
          }

          const trimmed = data.experience.trim();
          
          // Must be descriptive, not placeholder
          const forbiddenExperience = [
            'not specified', 'unknown', 'n/a', 'experience', 
            'work experience', 'professional experience', 'years',
            'not provided', 'not available', 'not mentioned'
          ];
          
          if (forbiddenExperience.some(forbidden => trimmed.toLowerCase() === forbidden)) {
            logger.error('Placeholder experience detected', { experience: trimmed });
            return false;
          }
          
          if (trimmed.length < 5) {
            logger.error('Experience description too short', { 
              experience: trimmed, 
              length: trimmed.length 
            });
            return false;
          }

          return true;
        },
        error: 'Experience description is missing or invalid'
      }
    };

    // Run all mandatory validations
    for (const [field, validation] of Object.entries(validations)) {
      if (!validation.check()) {
        logger.error(`MANDATORY FIELD VALIDATION FAILED: ${field}`, { 
          error: validation.error,
          value: data[field]
        });
        return false;
      }
    }

    // OPTIONAL BUT RECOMMENDED FIELDS
    const recommendedFields = {
      email: data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email),
      jobTitle: data.jobTitle && data.jobTitle.trim().length > 2,
      location: data.location && data.location.trim().length > 2
    };

    const validRecommended = Object.values(recommendedFields).filter(Boolean).length;
    
    logger.info('Data validation summary', {
      mandatoryFieldsPassed: 3, // name, skills, experience
      recommendedFieldsPassed: validRecommended,
      totalFieldsExtracted: Object.keys(data).length,
      qualityScore: this._calculateDataQuality(data)
    });

    // All mandatory validations passed
    return true;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

module.exports = EnhancedAIService;
