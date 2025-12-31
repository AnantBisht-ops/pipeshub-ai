/**
 * Cron Scheduler Validation Middleware
 * Validates all incoming requests for the cron scheduler endpoints
 * Uses Zod for comprehensive schema validation
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import moment from 'moment-timezone';
// Note: SCHEDULE_CONSTANTS import removed as it's not used in this file

/**
 * Main schedule creation/update schema
 */
const scheduleSchema = z.object({
  // Basic job information
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be less than 200 characters')
    .trim(),

  prompt: z.string()
    .min(1, 'Prompt is required')
    .max(10000, 'Prompt must be less than 10000 characters'),

  targetApi: z.string()
    .url('Target API must be a valid URL')
    .refine(url => url.startsWith('http://') || url.startsWith('https://'), {
      message: 'Target API must use HTTP or HTTPS protocol'
    }),

  headers: z.record(z.string()).optional(),

  // Schedule configuration
  scheduleType: z.enum(['once', 'recurring'], {
    errorMap: () => ({ message: 'Schedule type must be either "once" or "recurring"' })
  }),

  timezone: z.string().optional().default('UTC'),

  // Optional project ID
  projectId: z.string().optional(),

  // One-time schedule
  oneTime: z.object({
    date: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    time: z.string()
      .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format (24-hour)')
  }).optional(),

  // Recurring schedule
  recurring: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly'], {
      errorMap: () => ({ message: 'Frequency must be daily, weekly, or monthly' })
    }),
    time: z.string()
      .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format (24-hour)'),
    startDate: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    endDate: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
      .optional(),
    daysOfWeek: z.array(
      z.number()
        .min(0, 'Day of week must be between 0 (Sunday) and 6 (Saturday)')
        .max(6, 'Day of week must be between 0 (Sunday) and 6 (Saturday)')
    ).optional(),
    dayOfMonth: z.number()
      .min(1, 'Day of month must be between 1 and 31')
      .max(31, 'Day of month must be between 1 and 31')
      .optional()
  }).optional(),

  // Duplicate prevention
  idempotencyKey: z.string()
    .min(1)
    .max(255)
    .optional(),

  // Rate limiting configuration
  rateLimitConfig: z.object({
    maxRequestsPerMinute: z.number()
      .min(1, 'Max requests must be at least 1')
      .max(1000, 'Max requests cannot exceed 1000')
      .optional(),
    backoffMultiplier: z.number()
      .min(1, 'Backoff multiplier must be at least 1')
      .max(10, 'Backoff multiplier cannot exceed 10')
      .optional(),
    maxBackoff: z.number()
      .min(1000, 'Max backoff must be at least 1 second')
      .max(300000, 'Max backoff cannot exceed 5 minutes')
      .optional()
  }).optional(),

  // Response configuration
  responseConfig: z.object({
    maxSizeBytes: z.number()
      .min(1024, 'Max size must be at least 1KB')
      .max(50 * 1024 * 1024, 'Max size cannot exceed 50MB')
      .optional(),
    compressResponse: z.boolean().optional(),
    storeFullResponse: z.boolean().optional()
  }).optional()
})
.refine(data => {
  // Validate schedule type has corresponding data
  if (data.scheduleType === 'once') {
    return !!data.oneTime;
  }
  if (data.scheduleType === 'recurring') {
    return !!data.recurring;
  }
  return false;
}, {
  message: 'Schedule configuration missing for selected type',
  path: ['scheduleType']
})
.refine(data => {
  // Validate future dates for one-time schedules
  if (data.scheduleType === 'once' && data.oneTime) {
    const scheduleDateTime = moment.tz(
      `${data.oneTime.date} ${data.oneTime.time}`,
      'YYYY-MM-DD HH:mm',
      data.timezone || 'UTC'
    );
    return scheduleDateTime.isAfter(moment());
  }
  return true;
}, {
  message: 'Schedule time must be in the future',
  path: ['oneTime']
})
.refine(data => {
  // Validate recurring schedule consistency
  if (data.scheduleType === 'recurring' && data.recurring) {
    const { frequency, daysOfWeek, dayOfMonth } = data.recurring;

    // Weekly requires daysOfWeek
    if (frequency === 'weekly' && (!daysOfWeek || daysOfWeek.length === 0)) {
      return false;
    }

    // Monthly optionally uses dayOfMonth (defaults to 1 if not provided)
    if (frequency === 'monthly' && dayOfMonth !== undefined) {
      const startDate = moment(data.recurring.startDate);
      const maxDays = startDate.daysInMonth();
      if (dayOfMonth > maxDays) {
        return false;
      }
    }

    // Daily doesn't need additional fields
    return true;
  }
  return true;
}, {
  message: 'Invalid recurring schedule configuration',
  path: ['recurring']
})
.refine(data => {
  // Validate end date is after start date for recurring
  if (data.scheduleType === 'recurring' && data.recurring) {
    if (data.recurring.endDate) {
      const startDate = moment(data.recurring.startDate);
      const endDate = moment(data.recurring.endDate);
      return endDate.isAfter(startDate);
    }
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['recurring', 'endDate']
})
.refine(data => {
  // Validate timezone
  if (data.timezone) {
    return moment.tz.zone(data.timezone) !== null;
  }
  return true;
}, {
  message: 'Invalid timezone',
  path: ['timezone']
});

/**
 * Schema for updating an existing job
 */
const updateJobSchema = z.object({
  name: z.string()
    .min(1)
    .max(200)
    .trim()
    .optional(),

  prompt: z.string()
    .min(1)
    .max(10000)
    .optional(),

  targetApi: z.string()
    .url()
    .refine(url => url.startsWith('http://') || url.startsWith('https://'), {
      message: 'Target API must use HTTP or HTTPS protocol'
    })
    .optional(),

  headers: z.record(z.string()).optional(),

  scheduleType: z.enum(['once', 'recurring']).optional(),

  timezone: z.string().optional(),

  oneTime: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/)
  }).optional(),

  recurring: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
    dayOfMonth: z.number().min(1).max(31).optional()
  }).optional(),

  rateLimitConfig: z.object({
    maxRequestsPerMinute: z.number().min(1).max(1000).optional(),
    backoffMultiplier: z.number().min(1).max(10).optional(),
    maxBackoff: z.number().min(1000).max(300000).optional()
  }).optional(),

  responseConfig: z.object({
    maxSizeBytes: z.number().min(1024).max(50 * 1024 * 1024).optional(),
    compressResponse: z.boolean().optional(),
    storeFullResponse: z.boolean().optional()
  }).optional()
}).refine(data => {
  // If updating schedule type, ensure corresponding data is provided
  if (data.scheduleType === 'once' && !data.oneTime) {
    return false;
  }
  if (data.scheduleType === 'recurring' && !data.recurring) {
    return false;
  }
  return true;
}, {
  message: 'Schedule configuration required when changing schedule type'
});

/**
 * Schema for query parameters
 */
const listJobsQuerySchema = z.object({
  page: z.string()
    .regex(/^\d+$/, 'Page must be a positive number')
    .transform(Number)
    .refine(n => n > 0, 'Page must be greater than 0')
    .optional(),

  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a positive number')
    .transform(Number)
    .refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100')
    .optional(),

  status: z.enum(['active', 'paused', 'completed', 'failed']).optional(),

  scheduleType: z.enum(['once', 'recurring']).optional(),

  projectId: z.string().optional(),

  search: z.string().max(100).optional(),

  sortBy: z.enum(['nextRunAt', 'createdAt', 'name', 'status']).optional(),

  sortOrder: z.enum(['asc', 'desc']).optional(),

  fromDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be in YYYY-MM-DD format')
    .optional(),

  toDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be in YYYY-MM-DD format')
    .optional()
});

/**
 * Schema for pagination query parameters
 */
const paginationQuerySchema = z.object({
  page: z.string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine(n => n > 0)
    .optional(),

  limit: z.string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine(n => n > 0 && n <= 100)
    .optional()
});

/**
 * Validate schedule creation request
 */
export const validateScheduleRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validated = scheduleSchema.parse(req.body);
    req.body = validated;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
      return;
    }
    next(error);
  }
};

/**
 * Validate job update request
 */
export const validateUpdateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validated = updateJobSchema.parse(req.body);
    req.body = validated;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
      return;
    }
    next(error);
  }
};

/**
 * Validate list jobs query parameters
 */
export const validateListJobsQuery = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validated = listJobsQuerySchema.parse(req.query);
    req.query = validated as any;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
      return;
    }
    next(error);
  }
};

/**
 * Validate pagination query parameters
 */
export const validatePaginationQuery = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validated = paginationQuerySchema.parse(req.query);
    req.query = validated as any;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid pagination parameters',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
      return;
    }
    next(error);
  }
};

/**
 * Validate job ID parameter
 */
export const validateJobId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const jobId = req.params.id || req.params.jobId;

  // Check if it's a valid MongoDB ObjectId (24 hex characters)
  if (!jobId || !/^[0-9a-fA-F]{24}$/.test(jobId)) {
    res.status(400).json({
      success: false,
      error: 'Invalid job ID format'
    });
    return;
  }

  next();
};

/**
 * Validate idempotency key header
 */
export const validateIdempotencyKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const idempotencyKey = req.headers['idempotency-key'] as string;

  if (idempotencyKey) {
    // Validate idempotency key format
    if (idempotencyKey.length > 255) {
      res.status(400).json({
        success: false,
        error: 'Idempotency key too long (max 255 characters)'
      });
      return;
    }

    // Add to body for processing
    req.body.idempotencyKey = idempotencyKey;
  }

  next();
};

/**
 * Sanitize response data to prevent XSS
 */
export const sanitizeResponse = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json;

  res.json = function(data: any) {
    // Deep clone and sanitize the response data
    const sanitized = sanitizeObject(data);
    return originalJson.call(this, sanitized);
  };

  next();
};

/**
 * Helper function to sanitize object
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Basic XSS prevention - remove script tags
    return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Export all validation middleware
 */
export const validationMiddleware = {
  validateScheduleRequest,
  validateUpdateRequest,
  validateListJobsQuery,
  validatePaginationQuery,
  validateJobId,
  validateIdempotencyKey,
  sanitizeResponse
};