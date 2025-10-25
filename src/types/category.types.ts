import { z } from 'zod';

// Create Category Schema
export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name is required'),
    description: z.string().optional(),
  }),
});

// Update Category Schema
export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Category ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
  }),
});

// Category ID Schema
export const categoryIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Category ID is required'),
  }),
});

// Export Types
export type CreateCategoryInput = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>['body'];
