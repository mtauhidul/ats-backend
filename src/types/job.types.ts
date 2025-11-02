import { z } from 'zod';

/**
 * Job Validation Schemas
 */

// Create Job Schema
export const createJobSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Job title is required'),
    clientId: z.string().min(1, 'Client ID is required'),
    description: z.string().min(1, 'Job description is required'),
    requirements: z.array(z.string()).default([]),
    responsibilities: z.array(z.string()).default([]),
    location: z.string().min(1, 'Location is required'),
    locationType: z.enum(['onsite', 'hybrid', 'remote']),
    jobType: z.enum(['full_time', 'part_time', 'contract', 'internship']),
    experienceLevel: z.enum(['entry', 'junior', 'mid', 'senior', 'lead', 'executive']),
    salaryRange: z.object({
      min: z.number().positive().optional(),
      max: z.number().positive().optional(),
      currency: z.string().default('USD'),
    }).optional(),
    skills: z.array(z.string()).default([]),
    benefits: z.array(z.string()).optional(),
    pipelineId: z.string().optional(),
    categoryIds: z.array(z.string()).default([]),
    tagIds: z.array(z.string()).default([]),
    status: z.enum(['draft', 'open', 'closed', 'on_hold']).default('draft'),
    openings: z.number().positive().default(1),
    applicationDeadline: z.coerce.date().optional(),
    startDate: z.coerce.date().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    hiringManagerId: z.string().optional(),
    recruiterIds: z.array(z.string()).default([]),
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
    location: z.string().optional(),
    locationType: z.enum(['onsite', 'hybrid', 'remote']).optional(),
    jobType: z.enum(['full_time', 'part_time', 'contract', 'internship']).optional(),
    experienceLevel: z.enum(['entry', 'junior', 'mid', 'senior', 'lead', 'executive']).optional(),
    salaryRange: z.object({
      min: z.number().positive().optional(),
      max: z.number().positive().optional(),
      currency: z.string().optional(),
    }).optional(),
    benefits: z.array(z.string()).optional(),
    applicationDeadline: z.coerce.date().optional(),
    startDate: z.coerce.date().optional(),
    openings: z.number().positive().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    hiringManagerId: z.string().optional(),
    recruiterIds: z.array(z.string()).optional(),
    pipelineId: z.string().optional(),
    categoryIds: z.array(z.string()).optional(),
    tagIds: z.array(z.string()).optional(),
    status: z.enum(['draft', 'open', 'closed', 'on_hold']).optional(),
  }),
});

// List Jobs Schema
export const listJobsSchema = z.object({
  query: z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(10),
    clientId: z.string().optional(),
    status: z.enum(['draft', 'open', 'closed', 'on_hold']).optional(),
    jobType: z.enum(['full_time', 'part_time', 'contract', 'internship']).optional(),
    locationType: z.enum(['onsite', 'hybrid', 'remote']).optional(),
    experienceLevel: z.enum(['entry', 'junior', 'mid', 'senior', 'lead', 'executive']).optional(),
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
