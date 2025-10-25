import { z } from 'zod';

/**
 * Job Validation Schemas
 */

// Create Job Schema
export const createJobSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Job title is required'),
    description: z.string().min(1, 'Job description is required'),
    requirements: z.array(z.string()).optional(),
    responsibilities: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    location: z.string().min(1, 'Location is required'),
    employmentType: z.enum(['full-time', 'part-time', 'contract', 'internship', 'temporary']),
    experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']).optional(),
    departmentId: z.string().optional(),
    clientId: z.string().min(1, 'Client ID is required'),
    salaryRange: z.object({
      min: z.number().positive().optional(),
      max: z.number().positive().optional(),
      currency: z.string().default('USD'),
    }).optional(),
    applicationDeadline: z.string().datetime().optional(),
    maxApplications: z.number().positive().optional(),
    isRemote: z.boolean().default(false),
    pipelineId: z.string().optional(),
    categoryIds: z.array(z.string()).optional(),
    tagIds: z.array(z.string()).optional(),
    status: z.enum(['draft', 'active', 'paused', 'closed', 'cancelled']).default('draft'),
  }),
});

// Update Job Schema
export const updateJobSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Job ID is required'),
  }),
  body: z.object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    requirements: z.array(z.string()).optional(),
    responsibilities: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    location: z.string().min(1).optional(),
    employmentType: z.enum(['full-time', 'part-time', 'contract', 'internship', 'temporary']).optional(),
    experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']).optional(),
    departmentId: z.string().optional(),
    salaryRange: z.object({
      min: z.number().positive().optional(),
      max: z.number().positive().optional(),
      currency: z.string().optional(),
    }).optional(),
    applicationDeadline: z.string().datetime().optional(),
    maxApplications: z.number().positive().optional(),
    isRemote: z.boolean().optional(),
    pipelineId: z.string().optional(),
    categoryIds: z.array(z.string()).optional(),
    tagIds: z.array(z.string()).optional(),
    status: z.enum(['draft', 'active', 'paused', 'closed', 'cancelled']).optional(),
  }),
});

// List Jobs Schema
export const listJobsSchema = z.object({
  query: z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(10),
    clientId: z.string().optional(),
    status: z.enum(['draft', 'active', 'paused', 'closed', 'cancelled']).optional(),
    employmentType: z.enum(['full-time', 'part-time', 'contract', 'internship', 'temporary']).optional(),
    experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']).optional(),
    isRemote: z.coerce.boolean().optional(),
    search: z.string().optional(),
    sortBy: z.string().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

// Job ID Schema
export const jobIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Job ID is required'),
  }),
});

// Bulk Update Status Schema
export const bulkUpdateJobStatusSchema = z.object({
  body: z.object({
    jobIds: z.array(z.string()).min(1, 'At least one job ID is required'),
    status: z.enum(['draft', 'active', 'paused', 'closed', 'cancelled']),
  }),
});

// Export Types
export type CreateJobInput = z.infer<typeof createJobSchema>['body'];
export type UpdateJobInput = z.infer<typeof updateJobSchema>['body'];
export type ListJobsQuery = z.infer<typeof listJobsSchema>['query'];
export type BulkUpdateJobStatusInput = z.infer<typeof bulkUpdateJobStatusSchema>['body'];
