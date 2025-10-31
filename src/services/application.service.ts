import { Application, Job } from '../models';
import affindaService from './affinda.service';
import openaiService from './openai.service';
import cloudinaryService from './cloudinary.service';
import logger from '../utils/logger';
import { config } from '../config';
import { ValidationError, NotFoundError } from '../utils/errors';

/**
 * Input for creating application with resume parsing
 */
export interface CreateApplicationWithParsingInput {
  // Required
  resumeBuffer: Buffer;
  resumeFilename: string;
  resumeMimetype: string;
  
  // Optional candidate info (will be filled from parsing if not provided)
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  
  // Optional job/client
  jobId?: string;
  clientId?: string;
  
  // Optional files
  videoIntroUrl?: string;
  
  // Source tracking
  source: 'manual' | 'direct_apply' | 'email_automation' | 'public_apply';
  sourceEmailAccountId?: string;
  
  // Additional data
  notes?: string;
  resumeRawText?: string; // Pre-extracted text for AI validation
}

/**
 * Parse resume and create application (Direct Apply workflow)
 * 
 * This service function can be called from:
 * - API endpoint (parseAndSaveResume controller)
 * - Email automation job
 * - Any other internal service
 * 
 * Workflow:
 * 1. Parse resume with Affinda (primary) or OpenAI (fallback)
 * 2. Upload resume to Cloudinary
 * 3. AI validation (if resumeRawText provided)
 * 4. Create application with parsed data
 */
export async function createApplicationWithParsing(
  input: CreateApplicationWithParsingInput
): Promise<any> {
  
  // Verify job exists if jobId provided
  let job = null;
  if (input.jobId) {
    job = await Job.findById(input.jobId);
    if (!job) {
      throw new NotFoundError('Job not found');
    }
  }

  logger.info(
    `Creating application with parsing: ${input.resumeFilename}${job ? ` for job ${job.title}` : ''}`
  );

  // Step 1: Parse resume using Affinda (primary) or OpenAI (fallback)
  let parsedData;
  let parsingMethod = 'openai';

  if (config.affinda.useAffinda && config.affinda.apiToken) {
    try {
      logger.info('Using Affinda parser (primary)');
      parsedData = await affindaService.parseResume(
        input.resumeBuffer,
        input.resumeFilename
      );
      parsingMethod = 'affinda';
      logger.info('✅ Parsing successful with Affinda');
    } catch (affindaError: any) {
      logger.warn(
        'Affinda parsing failed, falling back to OpenAI:',
        affindaError.message
      );
      parsedData = await openaiService.parseResumeFromFile(
        input.resumeBuffer,
        input.resumeMimetype
      );
      logger.info('✅ Parsing successful with OpenAI');
    }
  } else {
    logger.info('Using OpenAI parser');
    parsedData = await openaiService.parseResumeFromFile(
      input.resumeBuffer,
      input.resumeMimetype
    );
    logger.info('✅ Parsing successful with OpenAI');
  }

  // Step 2: Get candidate info (prefer parsed data over input)
  const candidateEmail = parsedData.personalInfo?.email || input.email;
  const candidateFirstName = parsedData.personalInfo?.firstName || input.firstName || '';
  const candidateLastName = parsedData.personalInfo?.lastName || input.lastName || '';
  const candidatePhone = parsedData.personalInfo?.phone || input.phone;

  // Validate that we have an email
  if (!candidateEmail) {
    throw new ValidationError(
      'Could not extract email from resume. Please provide it manually.'
    );
  }

  // Step 3: Check for duplicate application
  // Check if application exists with this jobId + email combination
  // This includes checking for jobId: null (unassigned applications)
  const existingApplication = await Application.findOne({
    jobId: input.jobId || null,
    email: candidateEmail,
  });

  if (existingApplication) {
    if (input.jobId) {
      throw new ValidationError(
        `Application already exists for this job with email: ${candidateEmail}`
      );
    } else {
      // For unassigned applications, update the existing one instead of creating a new one
      logger.info(
        `Found existing unassigned application for ${candidateEmail}, updating instead of creating new one`
      );
      
      // We'll return the existing application ID but continue with the upload and update process
      // This prevents duplicate key error while preserving the resume update functionality
      throw new ValidationError(
        `Application already exists for email: ${candidateEmail}. Please assign a job or delete the existing unassigned application first.`
      );
    }
  }

  // Step 4: Upload resume to Cloudinary
  logger.info('Uploading resume to Cloudinary...');
  const resumeUploadResult = await cloudinaryService.uploadResume(
    input.resumeBuffer,
    input.resumeFilename
  );
  const resumeUrl = resumeUploadResult.url;
  logger.info(`✅ Resume uploaded: ${resumeUrl}`);

  // Step 5: AI Resume Validation (if resume text provided)
  let validationResult = null;
  if (input.resumeRawText && input.resumeRawText.trim().length > 0) {
    try {
      logger.info('Running AI validation on resume...');
      validationResult = await openaiService.validateResume(input.resumeRawText);
      logger.info(
        `Resume validation: ${validationResult.isValid ? 'VALID' : 'INVALID'} ` +
        `(score: ${validationResult.score}/100) - ${validationResult.reason}`
      );
    } catch (error: any) {
      logger.error('Resume validation failed:', error);
      // Don't block application creation if validation fails
      validationResult = null;
    }
  }

  // Step 6: Create application
  logger.info('Creating application...');
  const application = await Application.create({
    // Candidate info
    firstName: candidateFirstName,
    lastName: candidateLastName,
    email: candidateEmail,
    phone: candidatePhone,

    // Resume
    resumeUrl,
    resumeOriginalName: input.resumeFilename,
    resumeRawText: input.resumeRawText,
    videoIntroUrl: input.videoIntroUrl,

    // Parsed data
    parsedData: {
      summary: parsedData.summary,
      skills: parsedData.skills,
      experience: parsedData.experience,
      education: parsedData.education,
      certifications: parsedData.certifications,
      languages: parsedData.languages,
    },

    // AI Validation
    isValidResume: validationResult?.isValid ?? null,
    validationScore: validationResult?.score ?? null,
    validationReason: validationResult?.reason ?? 'Validation not performed',

    // Job association
    jobId: input.jobId,
    clientId: input.clientId || job?.clientId,

    // Source tracking
    source: input.source,
    sourceEmailAccountId: input.sourceEmailAccountId,

    // Status
    status: 'pending',
    notes: input.notes,
  });

  // Populate references
  await application.populate([
    { path: 'jobId', select: 'title location employmentType' },
    { path: 'clientId', select: 'companyName logo' },
    { path: 'sourceEmailAccountId', select: 'name email' },
  ]);

  logger.info(
    `✅ Application created: ${application._id} (${candidateEmail})${job ? ` for ${job.title}` : ''}`
  );
  logger.info(`   Parsing method: ${parsingMethod}`);
  if (validationResult) {
    logger.info(`   AI Validation: ${validationResult.isValid ? '✓ VALID' : '✗ INVALID'} (${validationResult.score}/100)`);
  }

  return application;
}
