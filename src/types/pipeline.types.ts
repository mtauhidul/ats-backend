import { z } from 'zod';

/**
 * Pipeline Validation Schemas
 */

// Pipeline Stage Schema
const stageSchema = z.object({
  name: z.string().min(1, 'Stage name is required'),
  description: z.string().optional(),
  order: z.number().int().positive(),
  isDefault: z.boolean().default(false),
  color: z.string().optional(),
});

// Create Pipeline Schema
export const createPipelineSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Pipeline name is required'),
    description: z.string().optional(),
    stages: z.array(stageSchema).min(1, 'At least one stage is required'),
    isDefault: z.boolean().default(false),
  }),
});

// Update Pipeline Schema
export const updatePipelineSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Pipeline ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    stages: z.array(stageSchema).optional(),
    isDefault: z.boolean().optional(),
  }),
});

// List Pipelines Schema
export const listPipelinesSchema = z.object({
  query: z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(10),
    search: z.string().optional(),
    sortBy: z.string().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

// Pipeline ID Schema
export const pipelineIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Pipeline ID is required'),
  }),
});

// Export Types
export type PipelineStage = z.infer<typeof stageSchema>;
export type CreatePipelineInput = z.infer<typeof createPipelineSchema>['body'];
export type UpdatePipelineInput = z.infer<typeof updatePipelineSchema>['body'];
export type ListPipelinesQuery = z.infer<typeof listPipelinesSchema>['query'];
