import { z } from 'zod';

/**
 * Client Validation Schemas
 */

// Create Client Schema
export const createClientSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Client name is required'),
    industry: z.string().optional(),
    website: z.string().url('Invalid URL').optional(),
    logo: z.string().url('Invalid URL').optional(),
    contactPerson: z.string().optional(),
    contactEmail: z.string().email('Invalid email address').optional(),
    contactPhone: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    isActive: z.boolean().default(true),
  }),
});

// Update Client Schema
export const updateClientSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Client ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    industry: z.string().optional(),
    website: z.string().url().optional(),
    logo: z.string().url().optional(),
    contactPerson: z.string().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

// List Clients Schema
export const listClientsSchema = z.object({
  query: z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(10),
    isActive: z.coerce.boolean().optional(),
    industry: z.string().optional(),
    search: z.string().optional(),
    sortBy: z.string().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

// Client ID Schema
export const clientIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Client ID is required'),
  }),
});

// Export Types
export type CreateClientInput = z.infer<typeof createClientSchema>['body'];
export type UpdateClientInput = z.infer<typeof updateClientSchema>['body'];
export type ListClientsQuery = z.infer<typeof listClientsSchema>['query'];
