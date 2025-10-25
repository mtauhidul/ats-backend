import { z } from 'zod';

/**
 * Email Account Validation Schemas
 */

export const createEmailAccountSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    provider: z.enum(['gmail', 'outlook', 'custom'], {
      errorMap: () => ({ message: 'Provider must be gmail, outlook, or custom' }),
    }),
    imapHost: z.string().min(1, 'IMAP host is required'),
    imapPort: z.number().int().positive('IMAP port must be a positive integer'),
    imapUser: z.string().min(1, 'IMAP user is required'),
    imapPassword: z.string().min(1, 'IMAP password is required'),
    imapTls: z.boolean().default(true),
    smtpHost: z.string().min(1, 'SMTP host is required').optional(),
    smtpPort: z.number().int().positive('SMTP port must be a positive integer').optional(),
    smtpUser: z.string().min(1, 'SMTP user is required').optional(),
    smtpPassword: z.string().min(1, 'SMTP password is required').optional(),
    smtpTls: z.boolean().default(true).optional(),
    isActive: z.boolean().default(true).optional(),
  }),
});

export const updateEmailAccountSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    email: z.string().email('Invalid email address').optional(),
    provider: z.enum(['gmail', 'outlook', 'custom']).optional(),
    imapHost: z.string().min(1, 'IMAP host is required').optional(),
    imapPort: z.number().int().positive('IMAP port must be a positive integer').optional(),
    imapUser: z.string().min(1, 'IMAP user is required').optional(),
    imapPassword: z.string().min(1, 'IMAP password is required').optional(),
    imapTls: z.boolean().optional(),
    smtpHost: z.string().min(1, 'SMTP host is required').optional(),
    smtpPort: z.number().int().positive('SMTP port must be a positive integer').optional(),
    smtpUser: z.string().min(1, 'SMTP user is required').optional(),
    smtpPassword: z.string().min(1, 'SMTP password is required').optional(),
    smtpTls: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});

export const emailAccountIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});

export const listEmailAccountsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
    provider: z.enum(['gmail', 'outlook', 'custom']).optional(),
    isActive: z.string().optional().transform(val => val === 'true' ? true : val === 'false' ? false : undefined),
    search: z.string().optional(),
  }),
});

export type CreateEmailAccountInput = z.infer<typeof createEmailAccountSchema>['body'];
export type UpdateEmailAccountInput = z.infer<typeof updateEmailAccountSchema>['body'];
export type ListEmailAccountsQuery = z.infer<typeof listEmailAccountsSchema>['query'];
