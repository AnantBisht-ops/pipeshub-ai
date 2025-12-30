/**
 * Cron Scheduler Configuration
 * Includes all risk mitigation settings for production environment
 */

import { SCHEDULE_CONSTANTS } from '../types/cronScheduler.types';

/**
 * Parse Redis sentinels from environment variable
 */
const parseRedisSentinels = (): Array<{ host: string; port: number }> | undefined => {
  const sentinelsEnv = process.env.REDIS_SENTINELS;
  if (!sentinelsEnv) return undefined;

  try {
    return JSON.parse(sentinelsEnv);
  } catch {
    console.warn('Failed to parse REDIS_SENTINELS environment variable');
    return undefined;
  }
};

/**
 * Main configuration object with risk mitigation settings
 */
export const CronSchedulerConfig = {
  // Module settings
  module: {
    name: 'cron_scheduler',
    version: '1.0.0',
    enabled: process.env.CRON_SCHEDULER_ENABLED !== 'false',
    // API URLs configuration
    baseUrl: process.env.SCHEDULER_BASE_URL || 'http://localhost:3000/api/v1/cron',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    // OpenAnalyst API configuration
    openAnalystApi: {
      baseUrl: process.env.OPENANALYST_BASE_URL || 'https://api.openanalyst.com:3456',
      authEndpoint: process.env.OPENANALYST_AUTH_ENDPOINT || '/api/auth/token',
      agentEndpoint: process.env.OPENANALYST_AGENT_ENDPOINT || '/api/agent/run'
    }
  },

  // Queue configuration (Risk Mitigation: Redis Failure)
  queue: {
    name: process.env.CRON_QUEUE_NAME || 'cron-jobs',
    prefix: process.env.CRON_QUEUE_PREFIX || 'cron',

    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),

      // Risk Mitigation: Redis Failure - Connection resilience
      // BullMQ requires maxRetriesPerRequest to be null
      maxRetriesPerRequest: null,
      retryStrategy: (times: number): number | null => {
        // Exponential backoff with max 2 seconds
        const delay = Math.min(times * 50, 2000);
        console.log(`Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err: Error): boolean => {
        const targetErrors = ['READONLY', 'ECONNREFUSED', 'ENOTFOUND'];
        console.error('Redis connection error:', err.message);
        return targetErrors.some(e => err.message.includes(e));
      },
      enableOfflineQueue: true, // Queue commands when Redis is down

      // Redis Sentinel support for high availability
      sentinels: parseRedisSentinels(),
      sentinelName: process.env.REDIS_SENTINEL_NAME || 'mymaster',

      // Connection pool settings
      lazyConnect: false,
      keepAlive: 30000, // 30 seconds
      connectTimeout: 10000, // 10 seconds
      commandTimeout: 15000, // 15 seconds (increased to prevent timeout warnings)
    },

    // BullMQ job options
    defaultJobOptions: {
      attempts: parseInt(process.env.CRON_MAX_RETRIES || '3', 10),
      backoff: {
        type: 'exponential',
        delay: parseInt(process.env.CRON_RETRY_DELAY || '2000', 10) // Start with 2 seconds
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 100 // Keep last 100 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        count: 50 // Keep last 50 failed jobs
      }
    },

    // Queue monitoring settings
    monitoring: {
      stallInterval: 30000, // Check for stalled jobs every 30 seconds
      maxStalledCount: 3, // Max times a job can be stalled before failing
    }
  },

  // Worker configuration (Risk Mitigation: Worker Crash)
  worker: {
    concurrency: parseInt(process.env.CRON_WORKER_CONCURRENCY || '5', 10),
    maxStalledCount: 3,
    stalledInterval: 30000, // 30 seconds
    lockDuration: 30000, // 30 seconds
    lockRenewTime: 15000, // Renew lock every 15 seconds

    // PM2 configuration for auto-restart (Risk Mitigation: Worker Crash)
    pm2: {
      enabled: process.env.NODE_ENV === 'production',
      instances: parseInt(process.env.CRON_WORKER_INSTANCES || '2', 10),
      maxRestarts: 10,
      minUptime: '10s',
      maxMemoryRestart: process.env.CRON_WORKER_MAX_MEMORY || '500M',
      autorestart: true,
      watch: false,
      errorFile: process.env.CRON_WORKER_ERROR_LOG || './logs/cron-worker-error.log',
      outFile: process.env.CRON_WORKER_OUT_LOG || './logs/cron-worker-out.log',
      mergeLog: true,
      time: true
    },

    // Graceful shutdown settings
    gracefulShutdown: {
      timeout: 30000, // 30 seconds to finish current jobs
      forceExitTimeout: 35000 // Force exit after 35 seconds
    }
  },

  // HTTP client configuration
  http: {
    timeout: parseInt(process.env.CRON_JOB_TIMEOUT || '30000', 10), // 30 seconds default
    maxRedirects: 5,
    keepAlive: true,
    keepAliveMsecs: 1000,

    // Risk Mitigation: Large Responses
    maxResponseSize: parseInt(
      process.env.CRON_MAX_RESPONSE_SIZE ||
      String(SCHEDULE_CONSTANTS.MAX_RESPONSE_SIZE),
      10
    ),

    // Retry configuration for failed requests
    retryConfig: {
      retries: 3,
      retryDelay: (retryCount: number): number => {
        // Exponential backoff: 1s, 2s, 4s
        return Math.pow(2, retryCount - 1) * 1000;
      },
      retryCondition: (error: any): boolean => {
        // Retry on network errors and 5xx responses
        if (!error.response) return true; // Network error
        const status = error.response?.status;
        return status >= 500 && status <= 599;
      },
      shouldResetTimeout: true
    },

    // Request headers
    defaultHeaders: {
      'User-Agent': 'CronScheduler/1.0',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  },

  // Rate limiting configuration (Risk Mitigation: API Rate Limits)
  rateLimiting: {
    enabled: true,
    defaultMaxRequestsPerMinute: parseInt(
      process.env.CRON_DEFAULT_RATE_LIMIT ||
      String(SCHEDULE_CONSTANTS.DEFAULT_RATE_LIMIT),
      10
    ),
    backoffMultiplier: 2,
    minBackoff: SCHEDULE_CONSTANTS.MIN_BACKOFF, // 2 seconds
    maxBackoff: SCHEDULE_CONSTANTS.MAX_BACKOFF, // 32 seconds

    // Headers to check for rate limit information
    rateLimitHeaders: {
      remaining: ['x-ratelimit-remaining', 'x-rate-limit-remaining'],
      reset: ['x-ratelimit-reset', 'x-rate-limit-reset'],
      retryAfter: ['retry-after', 'x-retry-after']
    },

    // Per-API rate limit overrides
    apiOverrides: {
      'api.openai.com': {
        maxRequestsPerMinute: 60
      },
      'api.anthropic.com': {
        maxRequestsPerMinute: 60
      }
    }
  },

  // Response handling configuration (Risk Mitigation: Large Responses)
  responseHandling: {
    compression: {
      enabled: true,
      threshold: 1024, // Compress responses larger than 1KB
      algorithm: 'gzip' as const,
      level: 6 // Compression level (1-9)
    },

    storage: {
      // External storage for large responses
      provider: process.env.CRON_STORAGE_PROVIDER || 'local', // 'local', 's3', 'azure'
      localPath: process.env.CRON_STORAGE_LOCAL_PATH || './storage/cron-responses',

      // S3 configuration
      s3: {
        bucket: process.env.CRON_S3_BUCKET,
        region: process.env.CRON_S3_REGION || 'us-east-1',
        accessKeyId: process.env.CRON_S3_ACCESS_KEY,
        secretAccessKey: process.env.CRON_S3_SECRET_KEY,
        prefix: process.env.CRON_S3_PREFIX || 'cron-responses/'
      },

      // Azure configuration
      azure: {
        containerName: process.env.CRON_AZURE_CONTAINER,
        connectionString: process.env.CRON_AZURE_CONNECTION_STRING,
        prefix: process.env.CRON_AZURE_PREFIX || 'cron-responses/'
      },

      // Storage limits
      maxInlineSize: 1 * 1024 * 1024, // Store inline if < 1MB
      maxStorageSize: 50 * 1024 * 1024, // Max 50MB for external storage
      ttl: 30 * 24 * 60 * 60 // Keep stored responses for 30 days
    }
  },

  // Timezone configuration (Risk Mitigation: Timezone Issues)
  timezone: {
    default: SCHEDULE_CONSTANTS.TIMEZONE_DEFAULT, // UTC
    storage: 'UTC', // Always store in UTC
    display: process.env.CRON_DISPLAY_TIMEZONE || 'UTC',

    // Supported timezones for validation
    supported: [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Toronto',
      'America/Vancouver',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Moscow',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Singapore',
      'Asia/Kolkata',
      'Asia/Dubai',
      'Australia/Sydney',
      'Australia/Melbourne',
      'Pacific/Auckland'
    ]
  },

  // Duplicate prevention configuration (Risk Mitigation: Job Duplication)
  duplicatePrevention: {
    enabled: true,
    timeWindowMinutes: parseInt(
      process.env.CRON_DUPLICATE_WINDOW ||
      String(SCHEDULE_CONSTANTS.DUPLICATE_WINDOW_MINUTES),
      10
    ),
    checkFingerprint: true,
    checkIdempotencyKey: true,

    // Fingerprint configuration
    fingerprint: {
      algorithm: 'sha256',
      includeFields: ['orgId', 'prompt', 'targetApi', 'scheduleType', 'schedule']
    }
  },

  // Monitoring and alerting configuration
  monitoring: {
    enabled: process.env.CRON_ENABLE_MONITORING === 'true',

    // Health check settings
    healthCheck: {
      enabled: true,
      interval: 60000, // Check every minute
      timeout: 5000, // 5 second timeout for health checks

      // Thresholds for health status
      thresholds: {
        queueSize: 1000, // Alert if queue size > 1000
        failureRate: 0.1, // Alert if failure rate > 10%
        workerMemory: 2 * 1024 * 1024 * 1024, // Alert if worker memory > 2GB (adjusted for Node.js apps)
        redisMemory: 1024 * 1024 * 1024, // Alert if Redis memory > 1GB
        executionTime: 60000 // Alert if avg execution time > 60 seconds
      }
    },

    // Metrics collection
    metrics: {
      enabled: true,
      interval: 300000, // Collect metrics every 5 minutes
      retention: 7 * 24 * 60 * 60, // Keep metrics for 7 days

      // Prometheus configuration
      prometheus: {
        enabled: process.env.CRON_PROMETHEUS_ENABLED === 'true',
        port: parseInt(process.env.CRON_PROMETHEUS_PORT || '9090', 10),
        path: '/metrics'
      }
    },

    // Alerting configuration
    alerts: {
      enabled: process.env.CRON_ALERTS_ENABLED === 'true',
      channels: {
        email: {
          enabled: process.env.CRON_ALERT_EMAIL_ENABLED === 'true',
          to: process.env.CRON_ALERT_EMAIL_TO?.split(',') || [],
          from: process.env.CRON_ALERT_EMAIL_FROM || 'cron-scheduler@example.com'
        },
        slack: {
          enabled: process.env.CRON_ALERT_SLACK_ENABLED === 'true',
          webhookUrl: process.env.CRON_ALERT_SLACK_WEBHOOK
        }
      }
    }
  },

  // Security configuration
  security: {
    // Request validation
    validation: {
      maxPromptLength: SCHEDULE_CONSTANTS.MAX_PROMPT_LENGTH,
      maxHeadersSize: 8192, // 8KB max for headers
      allowedProtocols: ['http', 'https'],
      blockedDomains: process.env.CRON_BLOCKED_DOMAINS?.split(',') || [],
      allowedDomains: process.env.CRON_ALLOWED_DOMAINS?.split(',') || []
    },

    // Encryption for sensitive data
    encryption: {
      enabled: process.env.CRON_ENCRYPTION_ENABLED === 'true',
      algorithm: 'aes-256-gcm',
      keyRotationDays: 90
    },

    // API key management
    apiKeys: {
      encrypt: true,
      maskInLogs: true,
      rotationReminder: 30 // Remind to rotate API keys every 30 days
    }
  },

  // Logging configuration
  logging: {
    level: process.env.CRON_LOG_LEVEL || 'info',
    format: process.env.CRON_LOG_FORMAT || 'json',

    // Log destinations
    destinations: {
      console: true,
      file: process.env.CRON_LOG_FILE || './logs/cron-scheduler.log',
      syslog: process.env.CRON_LOG_SYSLOG === 'true'
    },

    // Log rotation
    rotation: {
      enabled: true,
      maxSize: '100m',
      maxFiles: 10,
      compress: true
    },

    // Sensitive data masking
    masking: {
      enabled: true,
      fields: ['password', 'apiKey', 'token', 'authorization', 'cookie']
    }
  },

  // Database configuration
  database: {
    // Collection names
    collections: {
      jobs: 'cronjobs',
      executions: 'cronexecutions'
    },

    // Query optimization
    optimization: {
      lean: true, // Use lean queries for better performance
      batchSize: 100, // Batch size for bulk operations
      connectionPoolSize: 10 // MongoDB connection pool size
    },

    // Maintenance settings
    maintenance: {
      cleanupEnabled: true,
      cleanupInterval: 24 * 60 * 60 * 1000, // Run cleanup daily
      executionRetentionDays: 30, // Keep executions for 30 days
      compactInterval: 7 * 24 * 60 * 60 * 1000 // Compact collections weekly
    }
  }
};

/**
 * Validate configuration on load
 */
export function validateConfig(): void {
  // Check required environment variables
  const required = ['REDIS_HOST', 'MONGO_URI'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
  }

  // Validate numeric configurations
  if (CronSchedulerConfig.queue.defaultJobOptions.attempts < 1) {
    throw new Error('CRON_MAX_RETRIES must be at least 1');
  }

  if (CronSchedulerConfig.worker.concurrency < 1) {
    throw new Error('CRON_WORKER_CONCURRENCY must be at least 1');
  }

  if (CronSchedulerConfig.http.timeout < 1000) {
    throw new Error('CRON_JOB_TIMEOUT must be at least 1000ms');
  }

  console.log('Cron Scheduler configuration validated successfully');
}

// Validate configuration on module load
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}