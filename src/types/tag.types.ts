import { z } from 'zod';

// Create Tag Schema
export const createTagSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Tag name is required'),
    color: z.string().optional(),
  }),
});

// Update Tag Schema
export const updateTagSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Tag ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    color: z.string().optional(),
  }),
});

// Tag ID Schema
export const tagIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Tag ID is required'),
  }),
});

// Export Types
export type CreateTagInput = z.infer<typeof createTagSchema>['body'];
export type UpdateTagInput = z.infer<typeof updateTagSchema>['body'];
