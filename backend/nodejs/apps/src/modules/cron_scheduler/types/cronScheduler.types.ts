/**
 * Cron Scheduler TypeScript Interfaces
 * Includes all risk mitigation fields for production-ready system
 */

import { Document, ObjectId } from 'mongoose';

/**
 * Request interface for creating/updating scheduled jobs
 */
export interface ICronJobRequest {
  // Basic job information
  name: string;
  prompt: string;
  targetApi: string;
  headers?: Record<string, string>;

  // Multi-tenancy
  orgId?: string;
  projectId?: string;

  // Skill identification for Claude Code
  skillId?: string;

  // Schedule configuration
  scheduleType: 'once' | 'recurring';

  // Timezone - REQUIRED for proper scheduling
  timezone?: string; // User's timezone (e.g., 'Asia/Kolkata', 'America/New_York')

  // Metadata for context passing to execution endpoint
  metadata?: {
    conversationId?: string;    // Which conversation/chat this belongs to
    sessionId?: string;         // Session identifier
    chatboxId?: string;         // Chatbox identifier
    userEmail?: string;         // User's email for notifications
    userName?: string;          // User's name for context
    skillName?: string;         // Name of the skill being used
    projectName?: string;       // Name of the project
    [key: string]: any;         // Allow additional context fields
  };

  // For duplicate prevention (Risk Mitigation: Job Duplication)
  idempotencyKey?: string;

  // One-time schedule configuration
  oneTime?: {
    date: string;  // YYYY-MM-DD (in user's timezone)
    time: string;  // HH:MM (in user's timezone)
  };

  // Recurring schedule configuration
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;  // HH:MM (in user's timezone)
    startDate: string;  // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD (optional)
    daysOfWeek?: number[];  // For weekly: 0-6 (0=Sunday, 6=Saturday)
    dayOfMonth?: number;    // For monthly: 1-31
  };

  // Rate limiting configuration (Risk Mitigation: API Rate Limits)
  rateLimitConfig?: {
    maxRequestsPerMinute?: number;
    backoffMultiplier?: number;
  };

  // Response handling (Risk Mitigation: Large Responses)
  responseConfig?: {
    maxSizeBytes?: number;  // Default: 10MB
    compressResponse?: boolean;
    storeFullResponse?: boolean;
  };
}

/**
 * Main Cron Job document interface
 */
export interface ICronJob extends Document {
  // Unique identifiers (Risk Mitigation: Job Duplication)
  _id: ObjectId;
  jobUuid: string;  // UUID for absolute uniqueness

  // Multi-tenancy support
  orgId: ObjectId;
  projectId?: ObjectId;
  createdBy: ObjectId;

  // Skill identification
  skillId?: string;

  // Job configuration
  name: string;
  prompt: string;
  targetApi: string;
  headers?: Record<string, string>;

  // Metadata for context (passed to execution endpoint)
  metadata?: {
    conversationId?: string;
    sessionId?: string;
    chatboxId?: string;
    userEmail?: string;
    userName?: string;
    skillName?: string;
    projectName?: string;
    [key: string]: any;
  };

  // Schedule configuration (ALL STORED IN UTC - Risk Mitigation: Timezone Issues)
  scheduleType: 'once' | 'recurring';

  oneTime?: {
    dateTime: Date;  // Stored in UTC
  };

  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;  // HH:MM in UTC
    startDate: Date;  // UTC
    endDate?: Date;   // UTC
    daysOfWeek?: number[];
    dayOfMonth?: number;
    cronExpression: string;  // Generated cron expression for BullMQ
  };

  // User's original timezone (for display purposes)
  userTimezone: string;

  // Job state
  status: 'active' | 'paused' | 'completed' | 'failed';
  nextRunAt: Date;  // UTC - indexed for efficient queries
  lastRunAt?: Date; // UTC
  executionCount: number;
  consecutiveFailures: number;

  // Rate limiting (Risk Mitigation: API Rate Limits)
  rateLimitConfig: {
    maxRequestsPerMinute: number;
    backoffMultiplier: number;
    maxBackoff: number;
    currentBackoff: number;
    lastRateLimitHit?: Date;
  };

  // Response configuration (Risk Mitigation: Large Responses)
  responseConfig: {
    maxSizeBytes: number;
    compressResponse: boolean;
    storeFullResponse: boolean;
  };

  // Duplicate prevention (Risk Mitigation: Job Duplication)
  idempotencyKey?: string;
  jobFingerprint: string;  // Hash of critical params for duplicate detection

  // Timestamps (UTC)
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Execution history document interface
 */
export interface ICronExecution extends Document {
  // Unique identifiers
  _id: ObjectId;
  executionUuid: string;  // UUID for uniqueness
  jobId: ObjectId;
  jobUuid: string;
  orgId: ObjectId;

  // Execution timing (ALL IN UTC - Risk Mitigation: Timezone Issues)
  scheduledFor: Date;  // When it was supposed to run
  executedAt: Date;    // When it actually ran
  completedAt?: Date;  // When it finished

  // Request details
  request: {
    prompt: string;
    targetApi: string;
    headers: Record<string, string>;
    timeout: number;
  };

  // Response details (Risk Mitigation: Large Responses)
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    data?: any;  // Actual response data (may be compressed)
    dataSize: number;  // Size in bytes
    isCompressed: boolean;
    isTruncated: boolean;
    storageLocation?: string;  // For large responses stored externally
  };

  // Execution metadata
  status: 'success' | 'failed' | 'timeout' | 'rate_limited';
  duration: number;  // milliseconds
  attempts: number;

  // Error details
  error?: {
    message: string;
    code: string;
    stack?: string;
    retryable: boolean;
  };

  // Rate limit info (Risk Mitigation: API Rate Limits)
  rateLimitInfo?: {
    remaining: number;
    reset: Date;
    retryAfter?: number;
  };

  // Timestamps (UTC)
  createdAt: Date;
}

/**
 * Rate limit tracker interface
 */
export interface IRateLimitTracker {
  requests: number[];  // Timestamps of recent requests
  currentBackoff: number;  // Current backoff delay in ms
  backoffUntil: number | null;  // Timestamp when backoff ends
}

/**
 * Health status interface
 */
export interface IHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    redis: boolean;
    mongodb: boolean;
    queue: boolean;
    worker: boolean;
  };
  metrics: {
    jobsCreated: number;
    jobsExecuted: number;
    jobsFailed: number;
    avgExecutionTime: number;
    queueDepth: number;
    workerMemory: number;
  };
  timestamp: Date;
}

/**
 * Job statistics interface
 */
export interface IJobStatistics {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  executionsToday: number;
  successRate: number;
  averageExecutionTime: number;
}

/**
 * Response for job listing
 */
export interface IJobListResponse {
  jobs: ICronJob[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Response for execution listing
 */
export interface IExecutionListResponse {
  executions: ICronExecution[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Validation error interface
 */
export interface IValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * API Response interface
 */
export interface IApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: IValidationError[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Configuration interfaces
 */
export interface IRateLimitConfig {
  maxRequestsPerMinute: number;
  backoffMultiplier: number;
  maxBackoff: number;
}

export interface IResponseConfig {
  maxSizeBytes: number;
  compressResponse: boolean;
  storeFullResponse: boolean;
}

/**
 * Queue job data interface
 */
export interface IQueueJobData {
  jobId: string;
  jobUuid: string;
}

/**
 * Worker metrics interface
 */
export interface IWorkerMetrics {
  processed: number;
  failed: number;
  completed: number;
  active: number;
  waiting: number;
  delayed: number;
}

/**
 * Type guards
 */
export const isOneTimeSchedule = (schedule: any): schedule is { date: string; time: string } => {
  return schedule &&
         typeof schedule.date === 'string' &&
         typeof schedule.time === 'string';
};

export const isRecurringSchedule = (schedule: any): schedule is ICronJobRequest['recurring'] => {
  return schedule &&
         typeof schedule.frequency === 'string' &&
         typeof schedule.time === 'string' &&
         typeof schedule.startDate === 'string';
};

/**
 * Enums for better type safety
 */
export enum ScheduleType {
  ONCE = 'once',
  RECURRING = 'recurring'
}

export enum JobStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum ExecutionStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  RATE_LIMITED = 'rate_limited'
}

export enum Frequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

/**
 * Constants for validation
 */
export const SCHEDULE_CONSTANTS = {
  MIN_JOB_NAME_LENGTH: 1,
  MAX_JOB_NAME_LENGTH: 200,
  MIN_PROMPT_LENGTH: 1,
  MAX_PROMPT_LENGTH: 10000,
  MAX_RESPONSE_SIZE: 10 * 1024 * 1024, // 10MB
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  MAX_CONSECUTIVE_FAILURES: 5,
  DUPLICATE_WINDOW_MINUTES: 5,
  DEFAULT_RATE_LIMIT: 60, // requests per minute
  TIMEZONE_DEFAULT: 'UTC',
  MIN_BACKOFF: 2000, // 2 seconds
  MAX_BACKOFF: 32000 // 32 seconds
};

// Export all types
export type {
  ObjectId
};