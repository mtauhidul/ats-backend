// middleware/validation.js
// Input validation middleware using Zod to prevent NoSQL injection and invalid data

const { z } = require('zod');

/**
 * Validation Schemas
 * Define strict schemas for all API inputs
 */

// Common reusable schemas
const emailSchema = z.string().email().max(255);
const objectIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/).min(1).max(255);
const urlSchema = z.string().url().max(2048).refine(
  (url) => {
    // Only allow http and https protocols
    const allowedProtocols = ['http:', 'https:'];
    try {
      const urlObj = new URL(url);
      return allowedProtocols.includes(urlObj.protocol);
    } catch {
      return false;
    }
  },
  { message: 'Only HTTP and HTTPS protocols are allowed' }
);
const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/).optional();

// Enum values for status fields
const applicationStatusSchema = z.enum([
  'pending',
  'screening',
  'interview',
  'assessment',
  'offer',
  'hired',
  'rejected',
  'withdrawn'
]);

const candidateStatusSchema = z.enum([
  'new',
  'active',
  'interviewing',
  'offer_extended',
  'hired',
  'rejected',
  'inactive'
]);

// Sort and filter schemas
const sortOrderSchema = z.enum(['asc', 'desc']);
const sortFieldSchema = z.enum([
  'createdAt',
  'updatedAt',
  'name',
  'email',
  'status',
  'score',
  'appliedDate'
]);

// Pagination schema
const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive().max(100)).optional().default('20'),
  sortBy: sortFieldSchema.optional().default('createdAt'),
  sortOrder: sortOrderSchema.optional().default('desc')
});

/**
 * Application Validation Schemas
 */
const createApplicationSchema = z.object({
  body: z.object({
    jobId: objectIdSchema,
    candidateId: objectIdSchema,
    resume: z.string().max(10000).optional(),
    coverLetter: z.string().max(5000).optional(),
    answers: z.array(z.object({
      questionId: z.string(),
      answer: z.string().max(2000)
    })).optional(),
    source: z.enum(['email', 'web', 'api', 'referral', 'linkedin', 'indeed', 'other']).optional(),
    status: applicationStatusSchema.optional().default('pending')
  })
});

const updateApplicationSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    status: applicationStatusSchema.optional(),
    notes: z.string().max(5000).optional(),
    score: z.number().min(0).max(100).optional(),
    reviewedBy: objectIdSchema.optional(),
    interviewDate: z.string().datetime().optional(),
    feedback: z.string().max(5000).optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update"
  })
});

const getApplicationsSchema = z.object({
  query: paginationSchema.extend({
    status: applicationStatusSchema.optional(),
    jobId: objectIdSchema.optional(),
    candidateId: objectIdSchema.optional(),
    source: z.string().max(50).optional(),
    minScore: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).pipe(z.number().min(0).max(100)).optional(),
    maxScore: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).pipe(z.number().min(0).max(100)).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  })
});

/**
 * Candidate Validation Schemas
 */
const createCandidateSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    email: emailSchema,
    phone: phoneSchema,
    linkedin: urlSchema.optional(),
    github: urlSchema.optional(),
    portfolio: urlSchema.optional(),
    location: z.string().max(255).optional(),
    experience: z.number().int().min(0).max(99).optional(),
    skills: z.array(z.string().max(100)).max(50).optional(),
    education: z.array(z.object({
      degree: z.string().max(255),
      institution: z.string().max(255),
      year: z.number().int().min(1950).max(2100),
      field: z.string().max(255).optional()
    })).optional(),
    resumeUrl: urlSchema.optional(),
    status: candidateStatusSchema.optional().default('new'),
    source: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).max(20).optional()
  })
});

const updateCandidateSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema,
    linkedin: urlSchema.optional(),
    github: urlSchema.optional(),
    portfolio: urlSchema.optional(),
    location: z.string().max(255).optional(),
    experience: z.number().int().min(0).max(99).optional(),
    skills: z.array(z.string().max(100)).max(50).optional(),
    status: candidateStatusSchema.optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    notes: z.string().max(5000).optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update"
  })
});

const getCandidatesSchema = z.object({
  query: paginationSchema.extend({
    status: candidateStatusSchema.optional(),
    skills: z.string().max(500).optional(), // Comma-separated skills
    minExperience: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0)).optional(),
    maxExperience: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().max(99)).optional(),
    location: z.string().max(255).optional(),
    search: z.string().max(255).optional(),
    tags: z.string().max(500).optional() // Comma-separated tags
  })
});

/**
 * Email Automation Validation Schemas
 */
const createEmailAccountSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1).max(255),
    imapHost: z.string().min(1).max(255),
    imapPort: z.number().int().min(1).max(65535),
    imapSecure: z.boolean().optional().default(true),
    smtpHost: z.string().min(1).max(255).optional(),
    smtpPort: z.number().int().min(1).max(65535).optional(),
    smtpSecure: z.boolean().optional(),
    name: z.string().min(1).max(255).optional(),
    folder: z.string().max(255).optional().default('INBOX'),
    autoProcess: z.boolean().optional().default(true),
    filters: z.object({
      fromDomains: z.array(z.string().max(255)).optional(),
      subjectContains: z.array(z.string().max(255)).optional(),
      hasAttachments: z.boolean().optional()
    }).optional()
  })
});

const sendEmailSchema = z.object({
  body: z.object({
    to: z.union([emailSchema, z.array(emailSchema)]),
    from: emailSchema,
    subject: z.string().min(1).max(998), // RFC 5322 limit
    text: z.string().max(100000).optional(),
    html: z.string().max(100000).optional(),
    cc: z.union([emailSchema, z.array(emailSchema)]).optional(),
    bcc: z.union([emailSchema, z.array(emailSchema)]).optional(),
    replyTo: emailSchema.optional(),
    attachments: z.array(z.object({
      filename: z.string().max(255),
      content: z.string().optional(),
      path: z.string().max(1024).optional(),
      contentType: z.string().max(255).optional()
    })).max(10).optional(),
    templateId: objectIdSchema.optional(),
    variables: z.record(z.any()).optional()
  }).refine(data => data.text || data.html, {
    message: "Either text or html content must be provided"
  })
});

/**
 * Notification Validation Schemas
 */
const createNotificationSchema = z.object({
  body: z.object({
    userId: objectIdSchema,
    title: z.string().min(1).max(255),
    message: z.string().min(1).max(1000),
    type: z.enum(['info', 'success', 'warning', 'error']).optional().default('info'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
    link: z.string().max(1024).optional(),
    data: z.record(z.any()).optional(),
    expiresAt: z.string().datetime().optional()
  })
});

/**
 * Communication Validation Schemas
 */
const createCommunicationSchema = z.object({
  body: z.object({
    candidateId: objectIdSchema,
    applicationId: objectIdSchema.optional(),
    type: z.enum(['email', 'sms', 'call', 'meeting', 'note']),
    direction: z.enum(['inbound', 'outbound']),
    subject: z.string().max(998).optional(),
    content: z.string().max(100000),
    status: z.enum(['pending', 'sent', 'delivered', 'failed', 'read']).optional().default('pending'),
    scheduledFor: z.string().datetime().optional(),
    metadata: z.record(z.any()).optional()
  })
});

/**
 * Webhook Validation Schemas
 */
const webhookPayloadSchema = z.object({
  body: z.object({
    event: z.string().min(1).max(255),
    timestamp: z.number().int().positive(),
    data: z.record(z.any())
  }),
  headers: z.object({
    'x-sendgrid-signature': z.string().optional(),
    'x-webhook-signature': z.string().optional()
  }).passthrough() // Allow other headers
});

/**
 * Zoom Meeting Validation Schemas
 */
const createZoomMeetingSchema = z.object({
  body: z.object({
    topic: z.string().min(1).max(255),
    type: z.enum(['instant', 'scheduled', 'recurring']).optional().default('scheduled'),
    startTime: z.string().datetime(),
    duration: z.number().int().min(1).max(1440), // Max 24 hours
    timezone: z.string().max(100).optional().default('UTC'),
    password: z.string().min(1).max(10).optional(),
    agenda: z.string().max(2000).optional(),
    settings: z.object({
      host_video: z.boolean().optional(),
      participant_video: z.boolean().optional(),
      join_before_host: z.boolean().optional(),
      mute_upon_entry: z.boolean().optional(),
      waiting_room: z.boolean().optional(),
      audio: z.enum(['both', 'telephony', 'voip']).optional(),
      auto_recording: z.enum(['local', 'cloud', 'none']).optional()
    }).optional()
  })
});

/**
 * Validation Middleware Factory
 * Creates middleware that validates request data against a Zod schema
 */
const validate = (schema) => {
  return async (req, res, next) => {
    try {
      // Validate the request data
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers
      });

      // Replace request data with validated data
      req.body = validated.body || req.body;
      req.query = validated.query || req.query;
      req.params = validated.params || req.params;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format Zod errors for client
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(400).json({
          error: 'Validation failed',
          details: formattedErrors
        });
      }

      // Handle unexpected errors
      console.error('Validation middleware error:', error);
      return res.status(500).json({
        error: 'Internal validation error'
      });
    }
  };
};

/**
 * Sanitization helpers
 */
const sanitizeFilters = (filters) => {
  // Remove any potential NoSQL injection operators
  const sanitized = {};
  const allowedOperators = ['==', '!=', '<', '<=', '>', '>=', 'in', 'not-in', 'array-contains'];
  
  for (const [key, value] of Object.entries(filters)) {
    // Skip if key contains dangerous patterns
    if (key.includes('$') || key.includes('.')) {
      continue;
    }
    
    sanitized[key] = value;
  }
  
  return sanitized;
};

/**
 * Export validation schemas and middleware
 */
module.exports = {
  // Middleware
  validate,
  
  // Application schemas
  createApplicationSchema,
  updateApplicationSchema,
  getApplicationsSchema,
  
  // Candidate schemas
  createCandidateSchema,
  updateCandidateSchema,
  getCandidatesSchema,
  
  // Email schemas
  createEmailAccountSchema,
  sendEmailSchema,
  
  // Notification schemas
  createNotificationSchema,
  
  // Communication schemas
  createCommunicationSchema,
  
  // Webhook schemas
  webhookPayloadSchema,
  
  // Zoom schemas
  createZoomMeetingSchema,
  
  // Utilities
  sanitizeFilters,
  
  // Common schemas for reuse
  emailSchema,
  objectIdSchema,
  urlSchema,
  phoneSchema,
  applicationStatusSchema,
  candidateStatusSchema,
  sortOrderSchema,
  sortFieldSchema,
  paginationSchema
};
