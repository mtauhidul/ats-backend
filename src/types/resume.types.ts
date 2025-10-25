import { z } from 'zod';

/**
 * Resume Validation Schemas
 */

export const parseResumeSchema = z.object({
  body: z.object({
    extractSkills: z.boolean().optional().default(true),
    extractEducation: z.boolean().optional().default(true),
    extractExperience: z.boolean().optional().default(true),
  }),
});

export const parseAndSaveResumeSchema = z.object({
  body: z.object({
    jobId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid job ID format'),
    clientId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid client ID format').optional(),
    source: z.enum(['manual', 'direct_apply']).default('manual'),
    notes: z.string().optional(),
    extractSkills: z.boolean().optional().default(true),
    extractEducation: z.boolean().optional().default(true),
    extractExperience: z.boolean().optional().default(true),
  }),
});

export type ParseResumeInput = z.infer<typeof parseResumeSchema>['body'];
export type ParseAndSaveResumeInput = z.infer<typeof parseAndSaveResumeSchema>['body'];
