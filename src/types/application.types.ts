import { z } from 'zod';

/**
 * Application Validation Schemas
 */

export const createApplicationSchema = z.object({
  body: z.object({
    jobId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid job ID format'),
    clientId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid client ID format').optional(),
    source: z.enum(['manual', 'direct_apply', 'email_automation'], {
      errorMap: () => ({ message: 'Source must be manual, direct_apply, or email_automation' }),
    }),
    sourceEmail: z.string().email('Invalid source email').optional(),
    sourceEmailAccountId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid email account ID').optional(),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().optional(),
    resumeUrl: z.string().url('Invalid resume URL'),
    resumeOriginalName: z.string().min(1, 'Resume filename is required'),
    coverLetter: z.string().optional(),
    status: z.enum(['pending', 'reviewing', 'shortlisted', 'rejected', 'approved']).default('pending'),
    notes: z.string().optional(),
    internalNotes: z.string().optional(),
    parsedData: z.object({
      summary: z.string().optional(),
      skills: z.array(z.string()).optional(),
      experience: z.array(z.any()).optional(),
      education: z.array(z.any()).optional(),
      languages: z.array(z.string()).optional(),
      certifications: z.array(z.string()).optional(),
    }).optional(),
  }),
});

export const updateApplicationSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    resumeUrl: z.string().url().optional(),
    resumeOriginalName: z.string().optional(),
    coverLetter: z.string().optional(),
    status: z.enum(['pending', 'reviewing', 'shortlisted', 'rejected', 'approved']).optional(),
    notes: z.string().optional(),
    internalNotes: z.string().optional(),
  }),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});

export const applicationIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});

export const listApplicationsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
    jobId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    clientId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    status: z.enum(['pending', 'reviewing', 'shortlisted', 'rejected', 'approved']).optional(),
    source: z.enum(['manual', 'direct_apply', 'email_automation']).optional(),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export const approveApplicationSchema = z.object({
  body: z.object({
    jobId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid job ID format'),
    assignToPipeline: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid pipeline ID').optional(),
    initialStage: z.string().optional(),
    notes: z.string().optional(),
  }),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});

export const bulkUpdateStatusSchema = z.object({
  body: z.object({
    applicationIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1, 'At least one application ID required'),
    status: z.enum(['pending', 'reviewing', 'shortlisted', 'rejected', 'approved']),
    notes: z.string().optional(),
  }),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>['body'];
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>['body'];
export type ListApplicationsQuery = z.infer<typeof listApplicationsSchema>['query'];
export type ApproveApplicationInput = z.infer<typeof approveApplicationSchema>['body'];
export type BulkUpdateStatusInput = z.infer<typeof bulkUpdateStatusSchema>['body'];
