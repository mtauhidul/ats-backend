import { z } from 'zod';

/**
 * Client Validation Schemas
 */

// Create Client Schema
export const createClientSchema = z.object({
  body: z.object({
    companyName: z.string().min(1, 'Company name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(1, 'Phone is required'),
    website: z.string().url('Invalid URL').optional().or(z.literal('')),
    logo: z.string().optional().refine(
      (val) => !val || val === '' || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:'),
      { message: 'Logo must be a valid URL or data URL' }
    ),
    industry: z.enum(['technology', 'healthcare', 'finance', 'education', 'retail', 'manufacturing', 'consulting', 'real_estate', 'hospitality', 'other']),
    companySize: z.enum(['1-50', '51-200', '201-500', '500+']),
    status: z.enum(['active', 'inactive', 'pending', 'on_hold']).default('active'),
    description: z.string().optional(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().min(1, 'City is required'),
      state: z.string().optional(),
      country: z.string().min(1, 'Country is required'),
      postalCode: z.string().optional(),
    }),
    contacts: z.array(z.object({
      name: z.string().min(1, 'Contact name is required'),
      email: z.string().email('Invalid email address'),
      phone: z.string().optional(),
      position: z.string().min(1, 'Position is required'),
      isPrimary: z.boolean(),
    })),
    tags: z.array(z.string()).optional(),
  }),
});

// Update Client Schema
export const updateClientSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Client ID is required'),
  }),
  body: z.object({
    companyName: z.string().min(1).optional(),
    email: z.string().email('Invalid email address').optional(),
    phone: z.string().optional(),
    website: z.string().url('Invalid URL').optional().or(z.literal('')),
    logo: z.string().optional().refine(
      (val) => !val || val === '' || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:'),
      { message: 'Logo must be a valid URL or data URL' }
    ),
    industry: z.enum(['technology', 'healthcare', 'finance', 'education', 'retail', 'manufacturing', 'consulting', 'real_estate', 'hospitality', 'other']).optional(),
    companySize: z.enum(['1-50', '51-200', '201-500', '500+']).optional(),
    status: z.enum(['active', 'inactive', 'pending', 'on_hold']).optional(),
    description: z.string().optional(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
    }).optional(),
    tags: z.array(z.string()).optional(),
    assignedTo: z.string().optional(),
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
