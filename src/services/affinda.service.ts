import { AffindaAPI, AffindaCredential } from '@affinda/affinda';
import { config } from '../config';
import logger from '../utils/logger';
import { InternalServerError } from '../utils/errors';
import { ParsedResume } from './openai.service';

class AffindaService {
  private client: AffindaAPI;

  constructor() {
    const credential = new AffindaCredential(config.affinda.apiToken);
    this.client = new AffindaAPI(credential);
  }

  /**
   * Create a resume collection if it doesn't exist
   */
  async ensureResumeCollection(): Promise<string> {
    try {
      const workspaceDetails = await this.client.getWorkspace(config.affinda.workspace);
      
      // Check if a collection already exists
      if (workspaceDetails.collections && workspaceDetails.collections.length > 0) {
        const existingCollection = workspaceDetails.collections[0];
        const collectionId = existingCollection.identifier;
        
        // Check if it's our old collection without custom fields
        if (existingCollection.name === 'Resumes') {
          logger.info(`🔄 Found old collection "${existingCollection.name}", deleting and recreating with custom fields...`);
          try {
            await this.client.deleteCollection(collectionId);
            logger.info(`✅ Deleted old collection: ${collectionId}`);
          } catch (deleteError: any) {
            logger.warn(`Could not delete old collection: ${deleteError.message}`);
          }
        } else {
          logger.info(`✅ Collection already exists: ${collectionId} (${existingCollection.name})`);
          return collectionId;
        }
      }

      // Create a new resume collection with specific fields
      logger.info(`📝 Creating new resume collection with custom fields...`);
      const newCollection = await this.client.createCollection({
        name: 'ATS Resumes',
        workspace: config.affinda.workspace,
        extractor: 'resume', // Use Affinda's built-in resume extractor
        fieldsLayout: {
          defaultCategory: {
            label: 'Resume Information',
            enabledFields: [
              // Personal Information
              { dataPoint: 'name', label: 'Full Name', fieldType: 'text' },
              { dataPoint: 'emails', label: 'Email Addresses', fieldType: 'text' },
              { dataPoint: 'phoneNumbers', label: 'Phone Numbers', fieldType: 'phonenumber' },
              { dataPoint: 'location', label: 'Location', fieldType: 'location' },
              { dataPoint: 'linkedin', label: 'LinkedIn Profile', fieldType: 'url' },
              { dataPoint: 'websites', label: 'Websites', fieldType: 'url' },
              
              // Professional Summary
              { dataPoint: 'summary', label: 'Professional Summary', fieldType: 'text' },
              { dataPoint: 'objective', label: 'Career Objective', fieldType: 'text' },
              { dataPoint: 'totalYearsExperience', label: 'Years of Experience', fieldType: 'yearsexperience' },
              { dataPoint: 'profession', label: 'Current Profession', fieldType: 'jobtitle' },
              
              // Work Experience
              { dataPoint: 'workExperience', label: 'Work Experience', fieldType: 'table' },
              
              // Education
              { dataPoint: 'education', label: 'Education', fieldType: 'table' },
              
              // Skills & Certifications
              { dataPoint: 'skills', label: 'Skills', fieldType: 'skill' },
              { dataPoint: 'certifications', label: 'Certifications', fieldType: 'table' },
              
              // Languages
              { dataPoint: 'languages', label: 'Languages', fieldType: 'language' },
              
              // Additional
              { dataPoint: 'rawText', label: 'Raw Text', fieldType: 'text' },
            ],
            disabledFields: []
          },
          categories: []
        }
      });

      logger.info(`✅ Created new collection: ${newCollection.identifier} (${newCollection.name})`);
      return newCollection.identifier;
    } catch (error: any) {
      logger.error('Failed to ensure resume collection:', error);
      throw new InternalServerError(`Failed to set up Affinda collection: ${error.message}`);
    }
  }

  /**
   * Parse resume using Affinda API
   */
  async parseResume(fileBuffer: Buffer, filename: string): Promise<ParsedResume> {
    try {
      logger.info(`Parsing resume with Affinda: ${filename}`);

      // Ensure collection exists (creates one if needed)
      const collectionIdentifier = await this.ensureResumeCollection();

      // Upload and parse resume with Affinda
      const result = await this.client.createDocument({
        file: fileBuffer,
        fileName: filename,
        workspace: config.affinda.workspace,
        collection: collectionIdentifier, // Use the collection we just ensured exists
        wait: 'true', // Wait for parsing to complete
        url: undefined,
      });

      logger.info(`📄 Document uploaded, identifier: ${result.meta?.identifier}`);
      logger.info(`📄 Collection used: ${result.meta?.collection?.identifier || 'unknown'}`);

      // Debug: Log the raw response structure
      logger.info(`🔍 Result keys: ${JSON.stringify(Object.keys(result || {}))}`);
      logger.info(`🔍 Result.data keys: ${JSON.stringify(Object.keys(result.data || {}))}`);
      
      // Check if data is empty
      if (!result.data || Object.keys(result.data).length === 0) {
        throw new Error(
          `Affinda parsing failed - returned empty data.\n` +
          `Collection: ${result.meta?.collection?.identifier || 'none'}\n` +
          `This may indicate an issue with the Affinda service or document format.`
        );
      }

      const data: any = result.data;

      // Debug: Log parsed data structure
      logger.info(`🔍 Name data: ${JSON.stringify(data.name)}`);
      logger.info(`🔍 Emails data: ${JSON.stringify(data.emails)}`);
      logger.info(`🔍 LinkedIn: ${data.linkedin}`);
      logger.info(`🔍 Websites: ${JSON.stringify(data.websites)}`);
      logger.info(`🔍 Skills sample (first 3): ${JSON.stringify(data.skills?.slice(0, 3))}`);
      logger.info(`🔍 Certifications: ${JSON.stringify(data.certifications)}`);
      logger.info(`🔍 Languages: ${JSON.stringify(data.languages)}`);
      logger.info(`🔍 Work experience - count: ${data.workExperience?.length || 0}`);

      // Extract personal information
      const personalInfo = {
        firstName: data.name?.first || '',
        lastName: data.name?.last || '',
        email: Array.isArray(data.emails) ? data.emails[0] : (data.emails || ''),
        phone: Array.isArray(data.phoneNumbers) ? data.phoneNumbers[0] : (data.phoneNumbers || ''),
        location: data.location?.formatted ||
                  [data.location?.city, data.location?.state, data.location?.country]
                    .filter(Boolean)
                    .join(', ') || '',
        linkedin: data.linkedin || data.websites?.find((w: any) => {
          const url = typeof w === 'string' ? w : w?.url;
          return url?.includes('linkedin');
        }) || '',
        website: (() => {
          const site = data.websites?.find((w: any) => {
            const url = typeof w === 'string' ? w : w?.url;
            return url && !url.includes('linkedin') && !url.startsWith('tel:');
          });
          return typeof site === 'string' ? site : site?.url || '';
        })(),
      };

      // Extract skills - handle both object array and string array
      const skills = data.skills?.map((skill: any) => {
        if (typeof skill === 'string') return skill;
        return skill?.name || skill?.value || '';
      }).filter(Boolean) || [];

      // Extract work experience
      const experience = data.workExperience?.map((exp: any) => ({
        company: exp.organization || '',
        title: exp.jobTitle || '',
        duration: this.formatDuration(exp.dates?.startDate, exp.dates?.endDate),
        description: exp.jobDescription || '',
      })) || [];

      // Extract education
      const education = data.education?.map((edu: any) => ({
        institution: edu.organization || '',
        degree: edu.accreditation?.education || '',
        field: edu.accreditation?.educationLevel || '',
        year: this.formatYear(edu.dates?.completionDate) ||
              this.formatDuration(edu.dates?.startDate, edu.dates?.endDate),
      })) || [];

      // Extract certifications - handle both object array and string array
      const certifications = data.certifications?.map((cert: any) => {
        if (typeof cert === 'string') return cert;
        return cert?.name || cert?.value || '';
      }).filter(Boolean) || [];

      // Extract languages - handle both object array and string array
      const languages = data.languages?.map((lang: any) => {
        if (typeof lang === 'string') return lang;
        return lang?.name || lang?.value || '';
      }).filter(Boolean) || [];

      // Calculate years of experience
      const yearsOfExperience = this.calculateYearsOfExperience(data.totalYearsExperience, experience);

      // Get current position (most recent)
      const currentTitle = experience[0]?.title || '';
      const currentCompany = experience[0]?.company || '';

      // Create summary if available
      const summary = data.summary || data.objective || '';

      logger.info(`Affinda parsing successful: ${personalInfo.email} - Extracted ${skills.length} skills, ${experience.length} experiences, ${education.length} education entries`);

      const parsedResult = {
        personalInfo,
        currentTitle,
        currentCompany,
        yearsOfExperience,
        summary,
        skills,
        experience,
        education,
        certifications,
        languages,
        extractedText: data.rawText || '',
      };

      // Debug: Log what we're returning
      logger.info(`📤 Returning: skills=${parsedResult.skills.length}, experience=${parsedResult.experience.length}, education=${parsedResult.education.length}, certifications=${parsedResult.certifications.length}, languages=${parsedResult.languages.length}`);
      logger.info(`📤 Skills sample: ${JSON.stringify(parsedResult.skills.slice(0, 3))}`);

      return parsedResult;
    } catch (error: any) {
      logger.error('Affinda parsing error:', error);
      throw new InternalServerError(`Failed to parse resume with Affinda: ${error.message}`);
    }
  }

  /**
   * Format date range for duration
   */
  private formatDuration(startDate?: string, endDate?: string): string {
    if (!startDate) return '';

    const start = this.formatDate(startDate);

    // Check if endDate is null, undefined, or the string "present"
    if (!endDate || (typeof endDate === 'string' && endDate.toLowerCase() === 'present')) {
      return `${start} - Present`;
    }

    const end = this.formatDate(endDate);
    return `${start} - ${end}`;
  }

  /**
   * Format single date to "Month Year"
   */
  private formatDate(dateString: string): string {
    if (!dateString) return '';
    
    try {
      // Convert to string if it's not already
      const dateStr = String(dateString);
      const date = new Date(dateStr);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return dateStr;
      }
      
      const month = date.toLocaleString('en-US', { month: 'long' });
      const year = date.getFullYear();
      return `${month} ${year}`;
    } catch {
      return String(dateString);
    }
  }

  /**
   * Format year only
   */
  private formatYear(dateString?: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.getFullYear().toString();
    } catch {
      return dateString;
    }
  }

  /**
   * Calculate years of experience
   */
  private calculateYearsOfExperience(
    totalYears?: number,
    experience?: Array<{ duration: string }>
  ): number {
    if (totalYears && totalYears > 0) {
      return Math.round(totalYears);
    }

    // Fallback: estimate from experience entries
    if (experience && experience.length > 0) {
      // Simple heuristic: count non-overlapping years
      return Math.max(1, experience.length);
    }

    return 0;
  }

  /**
   * Validate resume quality
   */
  async validateResume(parsedData: ParsedResume): Promise<{
    isValid: boolean;
    score: number;
    summary: string;
    concerns: string[];
  }> {
    const concerns: string[] = [];
    let score = 100;

    // Check email
    if (!parsedData.personalInfo?.email) {
      concerns.push('Missing email address');
      score -= 30;
    }

    // Check name
    if (!parsedData.personalInfo?.firstName || !parsedData.personalInfo?.lastName) {
      concerns.push('Missing or incomplete name');
      score -= 20;
    }

    // Check experience
    if (!parsedData.experience || parsedData.experience.length === 0) {
      concerns.push('No work experience found');
      score -= 25;
    }

    // Check skills
    if (!parsedData.skills || parsedData.skills.length < 3) {
      concerns.push('Limited or no skills listed');
      score -= 15;
    }

    // Check education
    if (!parsedData.education || parsedData.education.length === 0) {
      concerns.push('No education information found');
      score -= 10;
    }

    const isValid = score >= 40 && !!parsedData.personalInfo?.email;

    return {
      isValid,
      score: Math.max(0, score),
      summary: isValid
        ? `Resume is valid and complete (${score}/100)`
        : `Resume has issues that need attention (${score}/100)`,
      concerns,
    };
  }
}

export default new AffindaService();
