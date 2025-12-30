/**
 * Cron Scheduler Constants
 * Centralized constants for the module
 */

/**
 * Event names for the cron scheduler
 */
export const CRON_EVENTS = {
  JOB_CREATED: 'cron:job:created',
  JOB_UPDATED: 'cron:job:updated',
  JOB_DELETED: 'cron:job:deleted',
  JOB_PAUSED: 'cron:job:paused',
  JOB_RESUMED: 'cron:job:resumed',
  JOB_SCHEDULED: 'cron:job:scheduled',
  JOB_EXECUTING: 'cron:job:executing',
  JOB_COMPLETED: 'cron:job:completed',
  JOB_FAILED: 'cron:job:failed',
  JOB_RETRYING: 'cron:job:retrying',
  RATE_LIMITED: 'cron:rate:limited',
  WORKER_ERROR: 'cron:worker:error',
  QUEUE_ERROR: 'cron:queue:error'
} as const;

/**
 * Error codes for the cron scheduler
 */
export const CRON_ERROR_CODES = {
  JOB_NOT_FOUND: 'CRON_JOB_NOT_FOUND',
  DUPLICATE_JOB: 'CRON_DUPLICATE_JOB',
  INVALID_SCHEDULE: 'CRON_INVALID_SCHEDULE',
  INVALID_STATUS: 'CRON_INVALID_STATUS',
  RATE_LIMITED: 'CRON_RATE_LIMITED',
  TIMEOUT: 'CRON_TIMEOUT',
  NETWORK_ERROR: 'CRON_NETWORK_ERROR',
  RESPONSE_TOO_LARGE: 'CRON_RESPONSE_TOO_LARGE',
  UNAUTHORIZED: 'CRON_UNAUTHORIZED',
  WORKER_FAILED: 'CRON_WORKER_FAILED',
  QUEUE_FAILED: 'CRON_QUEUE_FAILED',
  DATABASE_ERROR: 'CRON_DATABASE_ERROR',
  VALIDATION_ERROR: 'CRON_VALIDATION_ERROR'
} as const;

/**
 * Job status values
 */
export const JOB_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

/**
 * Execution status values
 */
export const EXECUTION_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  RATE_LIMITED: 'rate_limited'
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

/**
 * Queue job names
 */
export const QUEUE_JOBS = {
  EXECUTE_JOB: 'execute-job',
  CLEANUP_EXECUTIONS: 'cleanup-executions',
  CHECK_HEALTH: 'check-health',
  COLLECT_METRICS: 'collect-metrics',
  RETRY_FAILED: 'retry-failed'
} as const;

/**
 * Metric names for monitoring
 */
export const METRICS = {
  JOBS_CREATED_TOTAL: 'cron_jobs_created_total',
  JOBS_EXECUTED_TOTAL: 'cron_jobs_executed_total',
  JOBS_FAILED_TOTAL: 'cron_jobs_failed_total',
  JOBS_DURATION_SECONDS: 'cron_jobs_duration_seconds',
  QUEUE_SIZE: 'cron_queue_size',
  QUEUE_WAITING: 'cron_queue_waiting',
  QUEUE_ACTIVE: 'cron_queue_active',
  QUEUE_DELAYED: 'cron_queue_delayed',
  WORKER_MEMORY_BYTES: 'cron_worker_memory_bytes',
  RATE_LIMIT_HITS: 'cron_rate_limit_hits',
  RESPONSE_SIZE_BYTES: 'cron_response_size_bytes',
  ERROR_RATE: 'cron_error_rate'
} as const;

/**
 * Log levels
 */
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace'
} as const;

/**
 * Validation patterns
 */
export const VALIDATION_PATTERNS = {
  TIME: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
  DATE: /^\d{4}-\d{2}-\d{2}$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  URL: /^https?:\/\/.+/,
  CRON_EXPRESSION: /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  TIMEZONE: 'UTC',
  TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  RATE_LIMIT: 60,
  BACKOFF_MULTIPLIER: 2,
  MAX_RESPONSE_SIZE: 10 * 1024 * 1024, // 10MB
  COMPRESSION_THRESHOLD: 1024, // 1KB
  DUPLICATE_WINDOW: 5, // minutes
  EXECUTION_RETENTION: 30, // days
  HEALTH_CHECK_INTERVAL: 60000, // 1 minute
  METRICS_INTERVAL: 300000 // 5 minutes
} as const;

/**
 * Headers to extract from API responses
 */
export const RESPONSE_HEADERS_TO_EXTRACT = [
  'content-type',
  'content-length',
  'x-request-id',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'x-ratelimit-limit',
  'retry-after',
  'cache-control',
  'etag',
  'last-modified'
] as const;

/**
 * Sensitive headers to mask in logs
 */
export const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'cookie',
  'set-cookie',
  'x-access-token',
  'x-refresh-token'
] as const;

/**
 * Storage providers
 */
export const STORAGE_PROVIDERS = {
  LOCAL: 'local',
  S3: 's3',
  AZURE: 'azure',
  GCS: 'gcs'
} as const;

/**
 * Alert severity levels
 */
export const ALERT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

/**
 * Time constants in milliseconds
 */
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000
} as const;

/**
 * Cron expression presets
 */
export const CRON_PRESETS = {
  EVERY_MINUTE: '* * * * *',
  EVERY_HOUR: '0 * * * *',
  EVERY_DAY_MIDNIGHT: '0 0 * * *',
  EVERY_DAY_NOON: '0 12 * * *',
  EVERY_WEEK_MONDAY: '0 0 * * 1',
  EVERY_MONTH_FIRST: '0 0 1 * *',
  EVERY_YEAR: '0 0 1 1 *',
  WEEKDAYS_9AM: '0 9 * * 1-5',
  WEEKENDS_10AM: '0 10 * * 0,6'
} as const;

/**
 * Health status values
 */
export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy'
} as const;

/**
 * Export all constants as a single object for convenience
 */
export const CRON_CONSTANTS = {
  EVENTS: CRON_EVENTS,
  ERROR_CODES: CRON_ERROR_CODES,
  HTTP_STATUS,
  QUEUE_JOBS,
  METRICS,
  LOG_LEVELS,
  VALIDATION_PATTERNS,
  DEFAULTS,
  RESPONSE_HEADERS_TO_EXTRACT,
  SENSITIVE_HEADERS,
  STORAGE_PROVIDERS,
  ALERT_SEVERITY,
  TIME,
  CRON_PRESETS,
  HEALTH_STATUS
} as const;

/**
 * Type exports for TypeScript
 */
export type CronEvent = typeof CRON_EVENTS[keyof typeof CRON_EVENTS];
export type CronErrorCode = typeof CRON_ERROR_CODES[keyof typeof CRON_ERROR_CODES];
export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];
export type QueueJob = typeof QUEUE_JOBS[keyof typeof QUEUE_JOBS];
export type MetricName = typeof METRICS[keyof typeof METRICS];
export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];
export type StorageProvider = typeof STORAGE_PROVIDERS[keyof typeof STORAGE_PROVIDERS];
export type AlertSeverity = typeof ALERT_SEVERITY[keyof typeof ALERT_SEVERITY];
export type HealthStatus = typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS];