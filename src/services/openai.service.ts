import OpenAI from 'openai';
import { config } from '../config';
import logger from '../utils/logger';
import { InternalServerError } from '../utils/errors';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export interface ParsedResume {
  personalInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
  };
  summary?: string;
  skills?: string[];
  experience?: Array<{
    company: string;
    title: string;
    duration: string;
    description?: string;
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    field?: string;
    year?: string;
  }>;
  certifications?: string[];
  languages?: string[];
  extractedText: string;
}

export interface AIScore {
  overallScore: number;
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: 'strong_fit' | 'good_fit' | 'moderate_fit' | 'poor_fit';
}

class OpenAIService {
  /**
   * Extract text from PDF buffer
   */
  async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      logger.error('PDF extraction error:', error);
      throw new InternalServerError('Failed to extract text from PDF');
    }
  }

  /**
   * Extract text from DOCX buffer
   */
  async extractTextFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      logger.error('DOCX extraction error:', error);
      throw new InternalServerError('Failed to extract text from DOCX');
    }
  }

  /**
   * Extract text from resume file
   */
  async extractTextFromResume(buffer: Buffer, fileType: string): Promise<string> {
    const lowerType = fileType.toLowerCase();

    if (lowerType === 'pdf' || lowerType === 'application/pdf') {
      return this.extractTextFromPDF(buffer);
    } else if (lowerType === 'docx' || lowerType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return this.extractTextFromDOCX(buffer);
    } else if (lowerType === 'doc' || lowerType === 'application/msword') {
      return this.extractTextFromDOCX(buffer);
    } else {
      throw new InternalServerError('Unsupported file type for text extraction');
    }
  }

  /**
   * Parse resume using AI
   */
  async parseResume(resumeText: string): Promise<ParsedResume> {
    try {
            const prompt = `
Extract structured information from this resume text and return as JSON:

${resumeText}

Return the following JSON structure (omit fields if not found):
{
  "personalInfo": {
    "firstName": "First name",
    "lastName": "Last name",
    "email": "email@example.com",
    "phone": "Phone number",
    "location": "City, State/Country",
    "linkedin": "LinkedIn URL",
    "website": "Personal website URL"
  },
  "summary": "Brief professional summary (2-3 sentences)",
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "duration": "Start - End (e.g., Jan 2020 - Present)",
      "description": "Brief description of responsibilities"
    }
  ],
  "education": [
    {
      "institution": "University/School Name",
      "degree": "Degree Name",
      "field": "Field of Study",
      "year": "Graduation Year"
    }
  ],
  "certifications": ["certification1", "certification2", ...],
  "languages": ["language1", "language2", ...]
}

Return ONLY valid JSON, no additional text.
`.trim();

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert resume parser that extracts structured data from resumes. Always return valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse JSON response
      const parsed = JSON.parse(content);

      return {
        ...parsed,
        extractedText: resumeText,
      };
    } catch (error: any) {
      logger.error('Resume parsing error:', error);
      throw new InternalServerError(`Failed to parse resume: ${error.message}`);
    }
  }

  /**
   * Score candidate against job requirements
   */
  async scoreCandidate(
    resumeData: ParsedResume,
    jobDescription: string,
    jobRequirements: string[]
  ): Promise<AIScore> {
    try {
      const prompt = `
You are an expert recruitment AI. Analyze how well this candidate matches the job requirements.

Job Description:
${jobDescription}

Job Requirements:
${jobRequirements.join('\n')}

Candidate Resume Summary:
${resumeData.summary || 'N/A'}

Skills: ${resumeData.skills?.join(', ') || 'N/A'}

Experience:
${resumeData.experience?.map(exp => `${exp.title} at ${exp.company} (${exp.duration})`).join('\n') || 'N/A'}

Education:
${resumeData.education?.map(edu => `${edu.degree} in ${edu.field} from ${edu.institution}`).join('\n') || 'N/A'}

Please provide a detailed scoring analysis in JSON format:
{
  "overallScore": 0-100,
  "skillsMatch": 0-100,
  "experienceMatch": 0-100,
  "educationMatch": 0-100,
  "summary": "Brief summary of the analysis",
  "strengths": ["strength1", "strength2", "strength3"],
  "concerns": ["concern1", "concern2"],
  "recommendation": "strong_fit" | "good_fit" | "moderate_fit" | "poor_fit"
}

Consider:
- How many required skills the candidate has
- Relevance of work experience
- Education level and field
- Overall fit for the role

Return ONLY valid JSON, no additional text.
`.trim();

      const response = await openai.chat.completions.create({
        model: config.openai.scoringModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert recruitment AI that scores candidates against job requirements. Always return valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 1500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse JSON response
      const score: AIScore = JSON.parse(content);

      // Validate scores are in range
      score.overallScore = Math.max(0, Math.min(100, score.overallScore));
      score.skillsMatch = Math.max(0, Math.min(100, score.skillsMatch));
      score.experienceMatch = Math.max(0, Math.min(100, score.experienceMatch));
      score.educationMatch = Math.max(0, Math.min(100, score.educationMatch));

      return score;
    } catch (error: any) {
      logger.error('Candidate scoring error:', error);
      throw new InternalServerError(`Failed to score candidate: ${error.message}`);
    }
  }

  /**
   * Parse resume from file buffer
   */
  async parseResumeFromFile(
    fileBuffer: Buffer,
    fileType: string
  ): Promise<ParsedResume> {
    const text = await this.extractTextFromResume(fileBuffer, fileType);
    return this.parseResume(text);
  }
}

export default new OpenAIService();
