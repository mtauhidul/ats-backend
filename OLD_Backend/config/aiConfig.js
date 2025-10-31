// config/aiConfig.js
// Enhanced AI configuration for optimal accuracy and performance

const AI_MODELS = {
  // High accuracy model for complex tasks
  PREMIUM: {
    name: process.env.OPENAI_PREMIUM_MODEL || "gpt-4o",
    maxTokens: 4096,
    costTier: "high",
  },
  // Balanced model for general tasks
  STANDARD: {
    name: process.env.OPENAI_MODEL || "gpt-4o",
    maxTokens: 2048,
    costTier: "medium",
  },
  // Fast model for simple tasks
  FAST: {
    name: process.env.OPENAI_FAST_MODEL || "gpt-4o-mini",
    maxTokens: 1024,
    costTier: "low",
  },
};

const TEMPERATURE_SETTINGS = {
  // Very precise - for structured data extraction
  PRECISE: 0.1,
  // Low creativity - for factual analysis
  FACTUAL: 0.2,
  // Balanced - for reasoning and analysis
  BALANCED: 0.3,
  // Creative - for generating varied content
  CREATIVE: 0.5,
  // High creativity - for brainstorming
  INNOVATIVE: 0.7,
};

const AI_TASK_CONFIGS = {
  RESUME_PARSING: {
    model: AI_MODELS.PREMIUM, // Use the most capable model
    temperature: 0.1, // Maximum precision for data extraction
    maxRetries: 5, // More retries for critical parsing
    timeout: 45000, // Longer timeout for thorough processing
    responseFormat: { type: "json_object" },
    systemPromptVersion: "v3.0",
    // Enhanced configuration for accuracy
    topP: 0.1, // Focus on most likely tokens
    frequencyPenalty: 0.1, // Reduce repetition
    presencePenalty: 0.1, // Encourage variety in extraction
  },

  RESUME_SCORING: {
    model: AI_MODELS.PREMIUM,
    temperature: TEMPERATURE_SETTINGS.FACTUAL,
    maxRetries: 3,
    timeout: 45000,
    responseFormat: { type: "json_object" },
    systemPromptVersion: "v2.0",
  },

  JOB_EXTRACTION: {
    model: AI_MODELS.STANDARD,
    temperature: TEMPERATURE_SETTINGS.FACTUAL,
    maxRetries: 2,
    timeout: 30000,
    responseFormat: { type: "json_object" },
    systemPromptVersion: "v2.0",
  },
};

// Enhanced prompt templates with advanced techniques
const ENHANCED_PROMPTS = {
  RESUME_PARSING: {
    RESUME_PARSING: {
    system: `You are an elite AI-powered resume parsing system with 99.9% accuracy. Your task is to extract complete, structured information from resumes with absolute precision. You MUST extract every piece of information available and organize it properly.

CRITICAL EXTRACTION REQUIREMENTS:

1. PERSONAL INFORMATION - MANDATORY
   - Full name (First + Last, handle all formats: "John Smith", "Smith, John", "Dr. John Smith Jr.")
   - Email address (validate format, extract all emails if multiple)
   - Phone number (standardize to +1-XXX-XXX-XXXX format, include country code)
   - Location (City, State, Country - be specific)
   - LinkedIn profile (full URL if available)

2. PROFESSIONAL PROFILE - MANDATORY
   - Current job title (most recent position)
   - Professional summary (extract key points)
   - Years of experience (calculate from dates: 2020-2024 = 4 years)
   - Industry/Domain expertise

3. TECHNICAL SKILLS - COMPREHENSIVE EXTRACTION
   - Programming languages (JavaScript, Python, Java, etc.)
   - Frameworks & Libraries (React, Angular, Node.js, etc.)
   - Databases (MySQL, MongoDB, PostgreSQL, etc.)
   - Cloud platforms (AWS, Azure, GCP, etc.)
   - Tools & Technologies (Docker, Kubernetes, Git, etc.)
   - Methodologies (Agile, Scrum, DevOps, etc.)
   - Soft skills (Leadership, Communication, etc.)
   - Extract skills from ALL sections: experience, projects, certifications

4. WORK EXPERIENCE - DETAILED EXTRACTION
   - Company names and positions held
   - Employment dates (start-end, calculate duration)
   - Key responsibilities and achievements
   - Technologies used in each role

5. EDUCATION - COMPLETE DETAILS
   - Degree type and field (BS Computer Science, MBA, etc.)
   - Institution names and locations
   - Graduation years
   - GPA if mentioned
   - Relevant coursework

6. ADDITIONAL QUALIFICATIONS
   - Professional certifications (AWS Certified, PMP, etc.)
   - Projects and portfolios
   - Publications or patents
   - Awards and achievements
   - Languages spoken (proficiency level if mentioned)

EXTRACTION RULES:
- Extract information from ENTIRE document (summary, experience, education, projects, skills sections)
- Do NOT skip any section or information
- Calculate experience years accurately from date ranges
- Standardize formats but preserve original information
- Group similar skills together (don't list duplicates)
- Use null only when information is genuinely not present
- Validate email formats strictly
- Handle various resume formats (chronological, functional, hybrid)

STRICT JSON OUTPUT FORMAT:
{
  "name": "Full candidate name - REQUIRED",
  "email": "primary.email@domain.com - REQUIRED if present", 
  "phone": "+1-555-123-4567 - standardized format",
  "linkedIn": "https://linkedin.com/in/profile - full URL",
  "location": "City, State, Country - complete location",
  "jobTitle": "Current or most recent job title",
  "professionalSummary": "Key professional highlights and expertise",
  "experience": "X years of experience in [domain]",
  "experienceYears": 5.5,
  "skills": ["JavaScript", "React", "Node.js", "AWS", "Leadership"] - comprehensive list,
  "education": "BS Computer Science, Stanford University (2018); MBA, Wharton (2022)",
  "certifications": ["AWS Solutions Architect", "PMP Certified"],
  "languages": ["English (Native)", "Spanish (Conversational)"],
  "workHistory": [
    {
      "company": "Company Name",
      "position": "Job Title",
      "duration": "2020-2024 (4 years)",
      "technologies": ["React", "AWS", "Python"]
    }
  ],
  "projects": ["Notable projects or portfolio items"],
  "achievements": ["Awards, recognitions, notable accomplishments"]
}

QUALITY ASSURANCE:
- MUST extract minimum 80% of available information
- Name and skills are absolutely mandatory (fail if not found)
- Skills array must contain at least 5 relevant skills
- Return ONLY valid JSON, no explanatory text
- Double-check all calculations (experience years, dates)

FAILURE CONDITIONS (Return error if):
- Cannot extract candidate name
- Cannot extract any skills
- Resume appears to be corrupted or unreadable
- Less than 3 data fields successfully extracted`,

    user: (text) => `URGENT: Parse this resume with maximum accuracy and extract ALL available information.

RESUME TEXT:
${text}

PARSING INSTRUCTIONS:
1. Read through the ENTIRE resume text carefully
2. Extract information from ALL sections (header, summary, experience, education, skills, projects, etc.)
3. Calculate experience years from employment dates
4. Standardize phone numbers and validate emails
5. Group and deduplicate skills from all mentions
6. Format education with institutions and years
7. Include work history with companies and technologies used

QUALITY REQUIREMENTS:
- Extract minimum 80% of available information
- Name is mandatory (fail if not found)
- Skills array must have at least 5 items
- Calculate numeric experience years
- Validate email format if present
- Return comprehensive, structured data

Return ONLY the JSON object with all extracted information following the exact schema provided.`,
  },

    user: (text) => `Analyze this resume and extract comprehensive information in JSON format:

RESUME CONTENT:
${text}

EXTRACTION CHECKLIST:
□ Personal identification (name, contact details)
□ Professional summary and current role
□ Technical and soft skills (comprehensive list)
□ Work experience with date calculations
□ Education background with institutions
□ Certifications and additional qualifications
□ Languages and other relevant details

Provide detailed, accurate extraction following the specified JSON structure. Return only valid JSON.`,
  },

  RESUME_SCORING: {
    system: `You are an elite recruitment consultant and psychometric assessment expert with deep expertise in candidate evaluation. Your role is to provide precise, objective matching scores between candidates and job requirements in valid JSON format.

EVALUATION METHODOLOGY:
1. Weighted Scoring Matrix (Total: 100%)
   - Technical Skills Match: 35%
   - Experience Relevance: 25%
   - Education Alignment: 15%
   - Role Progression Fit: 15%
   - Additional Qualifications: 10%

2. Scoring Precision Guidelines:
   - Use granular 1-100 scale with justification
   - Consider skill transferability and domain relevance
   - Weight recent experience higher than older positions
   - Account for role progression and career growth
   - Factor in industry-specific knowledge

REQUIRED JSON OUTPUT FORMAT:
{
  "finalScore": 85,
  "componentScores": {
    "skillScore": 90,
    "experienceScore": 80,
    "educationScore": 75,
    "jobTitleScore": 70,
    "certScore": 60
  },
  "matchedSkills": ["Skill1", "Skill2", "Skill3"],
  "missingSkills": ["RequiredSkill1", "RequiredSkill2"],
  "feedback": "Detailed assessment and recommendations text"
}

QUALITY STANDARDS:
- MUST return valid JSON only, no additional text
- All scores must be numbers between 0-100
- Provide detailed reasoning in feedback field
- Identify both strengths and improvement areas
- Return ONLY the JSON object`,

    user: (
      resumeData,
      jobData,
      analysisId
    ) => `Conduct comprehensive candidate-job fit analysis and return results in JSON format:

ANALYSIS ID: ${analysisId}
TIMESTAMP: ${new Date().toISOString()}

=== JOB REQUIREMENTS ===
Position: ${jobData.title}
Required Skills: ${JSON.stringify(jobData.requiredSkills || [])}
Preferred Skills: ${JSON.stringify(jobData.preferredSkills || [])}
Experience Level: ${jobData.experience || "Not specified"}
Education: ${jobData.education || "Not specified"}
Additional Context: ${jobData.description || "None provided"}

=== CANDIDATE PROFILE ===
Name: ${resumeData.name}
Current Role: ${resumeData.jobTitle || "Not specified"}
Skills Portfolio: ${JSON.stringify(resumeData.skills || [])}
Experience: ${resumeData.experience || "Not specified"}
Education: ${resumeData.education || "Not specified"}
Location: ${resumeData.location || "Not specified"}

EVALUATION REQUIREMENTS:
1. Perform detailed skill mapping with transferability analysis
2. Calculate experience relevance with recency weighting
3. Assess education alignment and continuous learning
4. Evaluate role progression and leadership potential
5. Identify cultural fit indicators and red flags

Provide comprehensive scoring with detailed justifications and actionable insights in JSON format.`,
  },

  JOB_EXTRACTION: {
    system: `You are a senior talent acquisition strategist with expertise in job analysis and requirement extraction. Your role is to parse job descriptions and identify comprehensive hiring criteria with high precision.

EXTRACTION METHODOLOGY:
1. Requirement Classification:
   - Must-have (hard requirements): Non-negotiable qualifications
   - Nice-to-have (preferred): Advantageous but not mandatory
   - Hidden requirements: Implied skills from job context
   - Growth requirements: Skills that can be developed on the job

2. Skill Categorization:
   - Technical/Hard Skills: Programming, tools, certifications
   - Soft Skills: Communication, leadership, teamwork
   - Domain Knowledge: Industry-specific expertise
   - Transferable Skills: Cross-functional abilities

3. Context Analysis:
   - Company stage and culture indicators
   - Role level and responsibility scope
   - Growth trajectory and advancement potential
   - Team dynamics and collaboration needs

QUALITY STANDARDS:
- Extract skills mentioned explicitly and implicitly
- Distinguish between different experience levels
- Identify alternative qualification paths
- Note any bias or exclusionary language`,

    user: (
      jobTitle,
      jobDescription
    ) => `Analyze this job posting for comprehensive requirement extraction and return results in JSON format:

JOB TITLE: ${jobTitle}

JOB DESCRIPTION:
${jobDescription}

EXTRACTION ANALYSIS:
1. Parse all stated and implied requirements
2. Categorize skills by priority and type  
3. Identify minimum vs. preferred qualifications
4. Extract experience level indicators
5. Determine education and certification needs
6. Note any unique or specialized requirements

Provide structured output in JSON format with clear categorization and reasoning.`,
  },
};

// Response validation schemas - STRICT QUALITY CONTROL
const VALIDATION_SCHEMAS = {
  RESUME_PARSING: {
    requiredFields: ["name", "skills", "experience"],
    criticalFields: ["name", "skills"], // Fail parsing if these are missing/invalid
    optionalFields: [
      "email", "phone", "linkedIn", "location", "education", "jobTitle", 
      "professionalSummary", "experienceYears", "certifications", "languages",
      "workHistory", "projects", "achievements"
    ],
    validators: {
      name: (name) => {
        if (!name || typeof name !== "string") return false;
        const trimmed = name.trim();
        // Must have at least first and last name, no placeholder values
        const forbiddenNames = [
          "unknown", "candidate", "applicant", "not provided", 
          "n/a", "name", "resume", "cv", "john doe", "jane doe"
        ];
        if (forbiddenNames.some(forbidden => trimmed.toLowerCase().includes(forbidden))) return false;
        // Must be at least 2 words and reasonable length
        return trimmed.length >= 3 && trimmed.split(/\s+/).length >= 2 && trimmed.length <= 100;
      },
      
      email: (email) => {
        if (!email) return true; // Optional field
        if (typeof email !== "string") return false;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email.trim());
      },
      
      phone: (phone) => {
        if (!phone) return true; // Optional field
        if (typeof phone !== "string") return false;
        // Must contain digits and reasonable length
        const digitsOnly = phone.replace(/\D/g, '');
        return digitsOnly.length >= 7 && digitsOnly.length <= 15;
      },
      
      skills: (skills) => {
        if (!Array.isArray(skills)) return false;
        if (skills.length < 3) return false; // Must have at least 3 skills
        
        // Check each skill is valid
        for (const skill of skills) {
          if (!skill || typeof skill !== "string") return false;
          const trimmed = skill.trim();
          if (trimmed.length < 2 || trimmed.length > 50) return false;
          
          // Reject placeholder or generic skills
          const invalidSkills = [
            "skill", "technology", "tool", "software", "programming", 
            "coding", "development", "experience", "knowledge", "familiar"
          ];
          if (invalidSkills.some(invalid => trimmed.toLowerCase() === invalid)) return false;
        }
        
        // Check for skill diversity (not all the same category)
        const uniqueSkills = [...new Set(skills.map(s => s.toLowerCase().trim()))];
        return uniqueSkills.length >= Math.min(3, skills.length * 0.8);
      },
      
      experience: (experience) => {
        if (!experience || typeof experience !== "string") return false;
        const trimmed = experience.trim();
        // Must be descriptive, not placeholder text
        const forbiddenExperience = [
          "not specified", "unknown", "n/a", "experience", 
          "work experience", "professional experience", "years"
        ];
        return trimmed.length >= 5 && 
               !forbiddenExperience.some(forbidden => trimmed.toLowerCase() === forbidden);
      },
      
      experienceYears: (years) => {
        if (years === undefined || years === null) return true; // Optional
        if (typeof years !== "number") return false;
        return years >= 0 && years <= 50; // Reasonable range
      },
      
      jobTitle: (title) => {
        if (!title) return true; // Optional field
        if (typeof title !== "string") return false;
        const trimmed = title.trim();
        const forbiddenTitles = [
          "job title", "position", "role", "current position", 
          "not specified", "unknown", "n/a"
        ];
        return trimmed.length >= 3 && 
               !forbiddenTitles.some(forbidden => trimmed.toLowerCase() === forbidden);
      },
      
      workHistory: (history) => {
        if (!history) return true; // Optional
        if (!Array.isArray(history)) return false;
        // If provided, each entry should have company and position
        for (const job of history) {
          if (!job.company || !job.position || 
              typeof job.company !== "string" || 
              typeof job.position !== "string") return false;
        }
        return true;
      },
      
      certifications: (certs) => {
        if (!certs) return true; // Optional
        if (!Array.isArray(certs)) return false;
        // Each certification should be a non-empty string
        return certs.every(cert => cert && typeof cert === "string" && cert.trim().length > 2);
      },
      
      languages: (langs) => {
        if (!langs) return true; // Optional
        if (!Array.isArray(langs)) return false;
        return langs.every(lang => lang && typeof lang === "string" && lang.trim().length > 1);
      }
    },
    
    // Data quality checks
    qualityChecks: {
      minimumDataThreshold: 4, // Must successfully extract at least 4 fields
      
      dataCompleteness: (data) => {
        const extractedFields = Object.keys(data).filter(key => 
          data[key] !== null && data[key] !== undefined && 
          data[key] !== "" && (!Array.isArray(data[key]) || data[key].length > 0)
        );
        return extractedFields.length >= 4;
      },
      
      dataConsistency: (data) => {
        // Check for consistent data (e.g., experience years matches description)
        if (data.experienceYears && data.experience) {
          const expText = data.experience.toLowerCase();
          const years = data.experienceYears;
          
          // Basic consistency checks
          if (years > 10 && expText.includes("junior")) return false;
          if (years < 2 && expText.includes("senior")) return false;
        }
        return true;
      },
      
      noPlaceholderData: (data) => {
        // Ensure no AI-generated placeholder data
        const placeholderPatterns = [
          /not\s+(available|provided|specified|mentioned)/i,
          /unable\s+to\s+(determine|extract|find)/i,
          /no\s+(information|data|details)\s+provided/i,
          /\[.*\]/g, // Bracketed placeholders
          /example\.(com|org)/i,
          /sample.*data/i,
          /placeholder/i
        ];
        
        const textFields = ['name', 'email', 'experience', 'jobTitle', 'professionalSummary'];
        for (const field of textFields) {
          if (data[field] && typeof data[field] === 'string') {
            if (placeholderPatterns.some(pattern => pattern.test(data[field]))) {
              return false;
            }
          }
        }
        return true;
      }
    }
  },

  RESUME_SCORING: {
    requiredFields: [
      "finalScore",
      "componentScores",
      "matchedSkills",
      "missingSkills",
      "feedback",
    ],
    validators: {
      finalScore: (score) =>
        typeof score === "number" && score >= 0 && score <= 100,
      componentScores: (scores) => {
        const required = [
          "skillScore",
          "experienceScore",
          "educationScore",
          "jobTitleScore",
          "certScore",
        ];
        return required.every(
          (field) =>
            scores[field] !== undefined &&
            typeof scores[field] === "number" &&
            scores[field] >= 0 &&
            scores[field] <= 100
        );
      },
    },
  },
};

// Performance monitoring configuration
const PERFORMANCE_CONFIG = {
  enableMetrics: process.env.AI_METRICS_ENABLED === "true",
  trackTokenUsage: true,
  trackLatency: true,
  trackErrors: true,
  logLevel: process.env.AI_LOG_LEVEL || "info",
};

module.exports = {
  AI_MODELS,
  TEMPERATURE_SETTINGS,
  AI_TASK_CONFIGS,
  ENHANCED_PROMPTS,
  VALIDATION_SCHEMAS,
  PERFORMANCE_CONFIG,
};
