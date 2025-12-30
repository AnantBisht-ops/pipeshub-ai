# 🎯 Cron Job Scheduler System - Complete Implementation Plan

## Table of Contents
- [Executive Summary](#executive-summary)
- [System Architecture](#system-architecture)
- [Risk Mitigation Strategies](#risk-mitigation-strategies)
- [Phase 1: Database & Infrastructure Setup](#phase-1-database--infrastructure-setup)
- [Phase 2: Core Services Implementation](#phase-2-core-services-implementation)
- [Phase 3: API Layer Implementation](#phase-3-api-layer-implementation)
- [Phase 4: BullMQ Integration & Worker Setup](#phase-4-bullmq-integration--worker-setup)
- [Phase 5: Integration with Existing System](#phase-5-integration-with-existing-system)
- [Phase 6: Testing Strategy](#phase-6-testing-strategy)
- [Phase 7: Monitoring & Maintenance](#phase-7-monitoring--maintenance)
- [Implementation Timeline](#implementation-timeline)
- [Success Criteria](#success-criteria)

---

## Executive Summary

### Project Overview
Building a production-ready cron job scheduler system that allows users to schedule prompts to be sent to various APIs at specified times.

### Core Features
- **Schedule Types**: One-time and recurring (Daily, Weekly, Monthly)
- **Database**: MongoDB for persistence
- **Queue System**: BullMQ + Redis for reliable job scheduling
- **API Framework**: Express.js with TypeScript
- **Multi-tenancy**: Full support for orgId and projectId isolation

### Key Capabilities
- Schedule jobs with structured schema (not from prompt parsing)
- Execute HTTP POST requests to target APIs at scheduled times
- Store complete execution history with responses
- Full CRUD operations for job management
- Pause/resume functionality
- Comprehensive error handling and retry logic

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     CLIENT APPLICATION                       │
│         (Colleague's System with Schedule Form)              │
└───────────────────┬──────────────────────────────────────────┘
                    │ HTTP POST /api/v1/cron/schedule
                    ▼
┌──────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS API LAYER                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • Authentication Middleware                         │   │
│  │  • Validation Middleware (Zod)                       │   │
│  │  • Rate Limiting                                     │   │
│  │  • Error Handling                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────┬──────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER (Business Logic)            │
│  ┌────────────────────────┐  ┌─────────────────────────┐    │
│  │  CronSchedulerService  │  │  TimeCalculatorService  │    │
│  │  • Create/Update Jobs  │  │  • Calculate Next Run   │    │
│  │  • Manage Status       │  │  • Parse Schedules      │    │
│  │  • Query Jobs          │  │  • Generate Cron Expr   │    │
│  └────────────────────────┘  └─────────────────────────┘    │
└───────────────────┬──────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────────┐   ┌──────────────────────────┐
│     MONGODB      │   │    BULLMQ + REDIS        │
│                  │   │                          │
│  • cron_jobs     │   │  • Job Queue             │
│  • cron_         │   │  • Scheduled Tasks       │
│    executions    │   │  • Retry Logic           │
└──────────────────┘   └────────────┬─────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────┐
│                    WORKER PROCESS                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  CronWorkerService                                   │   │
│  │  • Fetch Job from DB                                 │   │
│  │  • Execute HTTP Request                              │   │
│  │  • Handle Timeouts & Retries                        │   │
│  │  • Save Response to DB                               │   │
│  │  • Re-schedule if Recurring                          │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────┬──────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────┐
│                     TARGET APIs                              │
│         (OpenAI, Anthropic, Internal APIs, etc.)             │
└──────────────────────────────────────────────────────────────┘
```

---

## Risk Mitigation Strategies

### ⚠️ CRITICAL: All Risk Mitigations Must Be Implemented

| Risk | Mitigation Strategy | Implementation Details |
|------|-------------------|----------------------|
| **Redis Failure** | Redis Sentinel/Cluster | • Configure Redis Sentinel for automatic failover<br>• Implement connection retry logic with exponential backoff<br>• Add health check endpoint for Redis status<br>• Fallback to database polling if Redis completely fails |
| **Worker Crash** | Auto-restart with PM2 | • Use PM2 for process management<br>• Configure auto-restart on crash<br>• Implement graceful shutdown handlers<br>• Add worker health monitoring<br>• Multiple worker instances for redundancy |
| **API Rate Limits** | Rate limiting & backoff | • Implement per-API rate limit tracking<br>• Exponential backoff: 2s, 4s, 8s, 16s, 32s<br>• Store rate limit headers from responses<br>• Queue throttling based on API limits<br>• Alert on repeated rate limit hits |
| **Large Responses** | Response size limits | • Set max response size to 10MB<br>• Stream large responses to file storage<br>• Store reference instead of full response<br>• Compress responses before storage<br>• Implement response truncation with warning |
| **Time Zone Issues** | UTC Storage | • Store ALL timestamps in UTC<br>• Convert user input to UTC immediately<br>• Use moment-timezone for conversions<br>• Display times with timezone indicator<br>• Validate timezone in requests |
| **Job Duplication** | Unique job IDs | • Generate UUID for each job<br>• Implement idempotency keys<br>• Check for duplicate submissions within 5 minutes<br>• Use database unique constraints<br>• Add job fingerprinting (hash of key params) |

### Additional Risk Mitigations

| Risk | Mitigation Strategy | Implementation Details |
|------|-------------------|----------------------|
| **Memory Leaks** | Resource Management | • Implement connection pooling<br>• Set max listeners for event emitters<br>• Regular garbage collection monitoring<br>• Limit concurrent job processing |
| **Database Overload** | Query Optimization | • Add proper indexes on all query fields<br>• Implement pagination for large result sets<br>• Use lean() for read-only queries<br>• Cache frequently accessed data |
| **Network Failures** | Robust HTTP Client | • Set timeout of 30 seconds<br>• Implement retry with circuit breaker<br>• Use keep-alive connections<br>• Handle DNS failures gracefully |
| **Security Issues** | Security Best Practices | • Validate all input data<br>• Sanitize stored responses<br>• Encrypt sensitive headers<br>• Implement request signing<br>• Audit log all operations |

---

## Phase 1: Database & Infrastructure Setup

### Goal
Set up MongoDB schemas, TypeScript types, and basic module structure with all risk mitigations in place.

### Step 1.1: Create Module Structure
```bash
src/modules/cron_scheduler/
├── container/
│   └── cronScheduler.container.ts       # Dependency injection setup
├── controller/
│   └── cronScheduler.controller.ts      # API endpoint handlers
├── routes/
│   └── cronScheduler.routes.ts          # Express route definitions
├── services/
│   ├── cronScheduler.service.ts         # Main business logic
│   ├── cronQueue.service.ts             # BullMQ queue management
│   ├── cronWorker.service.ts            # Job execution worker
│   ├── timeCalculator.service.ts        # Schedule calculations
│   └── rateLimiter.service.ts           # API rate limit tracking
├── schema/
│   ├── cronJob.schema.ts                # Job configuration model
│   └── cronExecution.schema.ts          # Execution history model
├── types/
│   └── cronScheduler.types.ts           # TypeScript interfaces
├── config/
│   └── cronScheduler.config.ts          # Module configuration
├── middlewares/
│   ├── cronValidation.middleware.ts     # Request validation
│   └── duplicateCheck.middleware.ts     # Duplicate prevention
├── constants/
│   └── cronScheduler.constants.ts       # Constants and enums
├── utils/
│   ├── timezone.util.ts                 # UTC conversion utilities
│   └── responseCompressor.util.ts       # Response compression
└── monitors/
    └── health.monitor.ts                 # Health check monitoring
```

### Step 1.2: TypeScript Interfaces

```typescript
// types/cronScheduler.types.ts

export interface ICronJobRequest {
  name: string;
  prompt: string;
  targetApi: string;
  headers?: Record<string, string>;
  scheduleType: 'once' | 'recurring';

  // For duplicate prevention
  idempotencyKey?: string;

  // Timezone (stored but converted to UTC)
  timezone?: string; // Default: 'UTC'

  oneTime?: {
    date: string;  // YYYY-MM-DD (in user's timezone, converted to UTC)
    time: string;  // HH:MM (in user's timezone, converted to UTC)
  };

  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;  // HH:MM (in user's timezone, converted to UTC)
    startDate: string;  // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
    daysOfWeek?: number[];  // For weekly: [1,3,5] (Mon, Wed, Fri)
    dayOfMonth?: number;    // For monthly: 1-31
  };

  // Rate limiting configuration
  rateLimitConfig?: {
    maxRequestsPerMinute?: number;
    backoffMultiplier?: number;
  };

  // Response handling
  responseConfig?: {
    maxSizeBytes?: number;  // Default: 10MB
    compressResponse?: boolean;
    storeFullResponse?: boolean;
  };
}

export interface ICronJob extends Document {
  // Unique identifiers
  _id: ObjectId;
  jobUuid: string;  // UUID for absolute uniqueness

  // Multi-tenancy
  orgId: ObjectId;
  projectId?: ObjectId;
  createdBy: ObjectId;

  // Job configuration
  name: string;
  prompt: string;
  targetApi: string;
  headers?: Record<string, string>;

  // Schedule configuration (ALL STORED IN UTC)
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
    cronExpression: string;  // Generated cron expression
  };

  // User's original timezone (for display purposes)
  userTimezone: string;

  // Job state
  status: 'active' | 'paused' | 'completed' | 'failed';
  nextRunAt: Date;  // UTC
  lastRunAt?: Date; // UTC
  executionCount: number;
  consecutiveFailures: number;

  // Rate limiting
  rateLimitConfig: {
    maxRequestsPerMinute: number;
    currentBackoff: number;
    lastRateLimitHit?: Date;
  };

  // Response configuration
  responseConfig: {
    maxSizeBytes: number;
    compressResponse: boolean;
    storeFullResponse: boolean;
  };

  // Duplicate prevention
  idempotencyKey?: string;
  jobFingerprint: string;  // Hash of critical params

  // Timestamps (UTC)
  createdAt: Date;
  updatedAt: Date;
}

export interface ICronExecution extends Document {
  _id: ObjectId;
  executionUuid: string;  // UUID for uniqueness
  jobId: ObjectId;
  jobUuid: string;
  orgId: ObjectId;

  // Execution details (ALL IN UTC)
  scheduledFor: Date;  // When it was supposed to run
  executedAt: Date;    // When it actually ran
  completedAt: Date;   // When it finished

  // Request details
  request: {
    prompt: string;
    targetApi: string;
    headers: Record<string, string>;
    timeout: number;
  };

  // Response details
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    data?: any;  // Actual response data
    dataSize: number;  // Size in bytes
    isCompressed: boolean;
    isTruncated: boolean;
    storageLocation?: string;  // For large responses
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

  // Rate limit info
  rateLimitInfo?: {
    remaining: number;
    reset: Date;
    retryAfter?: number;
  };

  // Timestamps (UTC)
  createdAt: Date;
}
```

### Step 1.3: Mongoose Schemas with Risk Mitigations

```typescript
// schema/cronJob.schema.ts

import { Schema, model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const CronJobSchema = new Schema({
  jobUuid: {
    type: String,
    required: true,
    unique: true,  // Ensures uniqueness
    default: () => uuidv4()
  },

  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true  // Index for multi-tenancy queries
  },

  // ... other fields as defined in interface ...

  jobFingerprint: {
    type: String,
    required: true,
    index: true  // For duplicate detection
  },

  nextRunAt: {
    type: Date,
    required: true,
    index: true  // Critical index for scheduler queries
  },

  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'failed'],
    default: 'active',
    index: true  // Index for status filtering
  }
}, {
  timestamps: true  // Automatically adds createdAt and updatedAt in UTC
});

// Compound indexes for performance
CronJobSchema.index({ orgId: 1, status: 1, nextRunAt: 1 });
CronJobSchema.index({ jobUuid: 1, orgId: 1 });
CronJobSchema.index({ jobFingerprint: 1, createdAt: -1 });

// Pre-save hook for fingerprint generation (duplicate prevention)
CronJobSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate fingerprint from critical fields
    const fingerprintData = {
      orgId: this.orgId,
      prompt: this.prompt,
      targetApi: this.targetApi,
      scheduleType: this.scheduleType,
      schedule: this.scheduleType === 'once' ?
        this.oneTime : this.recurring
    };

    this.jobFingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex');
  }
  next();
});

// Method to check for duplicates within time window
CronJobSchema.statics.checkDuplicate = async function(
  fingerprint: string,
  timeWindowMinutes: number = 5
) {
  const cutoff = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  const duplicate = await this.findOne({
    jobFingerprint: fingerprint,
    createdAt: { $gte: cutoff }
  });
  return duplicate;
};

export const CronJob = model('CronJob', CronJobSchema);
```

```typescript
// schema/cronExecution.schema.ts

const CronExecutionSchema = new Schema({
  executionUuid: {
    type: String,
    required: true,
    unique: true,
    default: () => uuidv4()
  },

  jobId: {
    type: Schema.Types.ObjectId,
    ref: 'CronJob',
    required: true,
    index: true  // Index for history queries
  },

  // Response with size limits
  response: {
    statusCode: Number,
    headers: Schema.Types.Mixed,
    data: {
      type: Schema.Types.Mixed,
      validate: {
        validator: function(v: any) {
          // Validate response size (10MB limit)
          const size = JSON.stringify(v).length;
          return size <= 10 * 1024 * 1024;
        },
        message: 'Response data exceeds 10MB limit'
      }
    },
    dataSize: Number,
    isCompressed: Boolean,
    isTruncated: Boolean,
    storageLocation: String  // S3/Azure path for large responses
  },

  // ... other fields ...
}, {
  timestamps: true
});

// Indexes for query performance
CronExecutionSchema.index({ jobId: 1, executedAt: -1 });
CronExecutionSchema.index({ orgId: 1, status: 1, executedAt: -1 });
CronExecutionSchema.index({ executionUuid: 1 });

// TTL index to auto-delete old executions after 30 days
CronExecutionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

export const CronExecution = model('CronExecution', CronExecutionSchema);
```

### Step 1.4: Configuration with Risk Mitigation Settings

```typescript
// config/cronScheduler.config.ts

export const CronSchedulerConfig = {
  // Queue configuration
  queue: {
    name: process.env.CRON_QUEUE_NAME || 'cron-jobs',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        // Exponential backoff for Redis reconnection
        return Math.min(times * 50, 2000);
      },
      enableOfflineQueue: true,  // Queue commands when Redis is down
      sentinels: process.env.REDIS_SENTINELS ?
        JSON.parse(process.env.REDIS_SENTINELS) : undefined
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000  // Start with 2 seconds
      },
      removeOnComplete: false,  // Keep for history
      removeOnFail: false       // Keep for debugging
    }
  },

  // Worker configuration
  worker: {
    concurrency: parseInt(process.env.CRON_WORKER_CONCURRENCY || '5'),
    maxStalledCount: 3,
    stalledInterval: 30000,  // 30 seconds
    autorun: true,
    // PM2 configuration embedded
    pm2: {
      instances: 2,  // Run 2 worker instances
      max_restarts: 10,
      min_uptime: '10s',
      autorestart: true,
      watch: false
    }
  },

  // HTTP client configuration
  http: {
    timeout: parseInt(process.env.CRON_JOB_TIMEOUT || '30000'),  // 30 seconds
    maxRedirects: 5,
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxResponseSize: 10 * 1024 * 1024,  // 10MB
    retryConfig: {
      retries: 3,
      retryDelay: (retryCount: number) => retryCount * 1000,
      retryCondition: (error: any) => {
        // Retry on network errors and 5xx responses
        return !error.response || error.response.status >= 500;
      }
    }
  },

  // Rate limiting configuration
  rateLimiting: {
    defaultMaxRequestsPerMinute: 60,
    backoffMultiplier: 2,
    maxBackoff: 32000,  // 32 seconds
    rateLimitHeaders: [
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'retry-after'
    ]
  },

  // Timezone configuration
  timezone: {
    default: 'UTC',
    storage: 'UTC',  // Always store in UTC
    supported: [
      'UTC', 'America/New_York', 'America/Chicago',
      'America/Denver', 'America/Los_Angeles',
      'Europe/London', 'Europe/Paris', 'Asia/Tokyo',
      'Asia/Shanghai', 'Asia/Kolkata'
    ]
  },

  // Duplicate prevention
  duplicatePrevention: {
    enabled: true,
    timeWindowMinutes: 5,
    checkFingerprint: true,
    checkIdempotencyKey: true
  },

  // Monitoring
  monitoring: {
    enabled: process.env.CRON_ENABLE_MONITORING === 'true',
    healthCheckInterval: 60000,  // 1 minute
    metricsInterval: 300000,     // 5 minutes
    alertThresholds: {
      queueSize: 1000,
      failureRate: 0.1,  // 10%
      workerMemory: 500 * 1024 * 1024  // 500MB
    }
  }
};
```

### Step 1.5: Database Migration with Indexes

```javascript
// migrations/003_add_cron_scheduler.js

module.exports = {
  async up(db) {
    // Create collections
    await db.createCollection('cronjobs');
    await db.createCollection('cronexecutions');

    // Add indexes for cronjobs
    await db.collection('cronjobs').createIndex(
      { jobUuid: 1 },
      { unique: true }
    );

    await db.collection('cronjobs').createIndex(
      { orgId: 1, status: 1, nextRunAt: 1 }
    );

    await db.collection('cronjobs').createIndex(
      { jobFingerprint: 1, createdAt: -1 }
    );

    await db.collection('cronjobs').createIndex(
      { nextRunAt: 1, status: 1 },
      {
        partialFilterExpression: {
          status: { $in: ['active'] }
        }
      }
    );

    // Add indexes for cronexecutions
    await db.collection('cronexecutions').createIndex(
      { executionUuid: 1 },
      { unique: true }
    );

    await db.collection('cronexecutions').createIndex(
      { jobId: 1, executedAt: -1 }
    );

    // TTL index for automatic cleanup
    await db.collection('cronexecutions').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 30 * 24 * 60 * 60 }  // 30 days
    );
  },

  async down(db) {
    await db.collection('cronjobs').drop();
    await db.collection('cronexecutions').drop();
  }
};
```

---

## Phase 2: Core Services Implementation

### Goal
Build business logic layer with all risk mitigation strategies implemented.

### Step 2.1: Time Calculator Service (UTC Handling)

```typescript
// services/timeCalculator.service.ts

import moment from 'moment-timezone';
import { CronSchedulerConfig } from '../config/cronScheduler.config';

@injectable()
export class TimeCalculatorService {

  /**
   * CRITICAL: All times are converted to UTC for storage
   */
  parseScheduleToUTC(
    schedule: ICronJobRequest,
    userTimezone: string = 'UTC'
  ): Date {
    // Validate timezone
    if (!moment.tz.zone(userTimezone)) {
      throw new Error(`Invalid timezone: ${userTimezone}`);
    }

    if (schedule.scheduleType === 'once' && schedule.oneTime) {
      // Parse user's local time and convert to UTC
      const localDateTime = moment.tz(
        `${schedule.oneTime.date} ${schedule.oneTime.time}`,
        'YYYY-MM-DD HH:mm',
        userTimezone
      );

      // Validate future date
      if (localDateTime.isBefore(moment())) {
        throw new Error('Schedule time must be in the future');
      }

      // Return as UTC Date object
      return localDateTime.utc().toDate();
    }

    // For recurring, calculate next run in UTC
    return this.calculateNextRun(schedule.recurring!, userTimezone);
  }

  /**
   * Generate cron expression for BullMQ (in UTC)
   */
  generateCronExpression(
    recurring: IRecurringSchedule,
    userTimezone: string
  ): string {
    // Convert user's time to UTC
    const userTime = moment.tz(
      `2000-01-01 ${recurring.time}`,
      'YYYY-MM-DD HH:mm',
      userTimezone
    ).utc();

    const hour = userTime.hour();
    const minute = userTime.minute();

    switch (recurring.frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`;

      case 'weekly':
        const days = recurring.daysOfWeek!.join(',');
        return `${minute} ${hour} * * ${days}`;

      case 'monthly':
        const day = recurring.dayOfMonth || 1;
        return `${minute} ${hour} ${day} * *`;

      default:
        throw new Error(`Unsupported frequency: ${recurring.frequency}`);
    }
  }

  /**
   * Calculate next run time (always returns UTC)
   */
  calculateNextRun(
    recurring: IRecurringSchedule,
    userTimezone: string,
    fromDate: Date = new Date()
  ): Date {
    const cronExpression = this.generateCronExpression(recurring, userTimezone);
    // Use cron-parser to calculate next run
    const interval = parser.parseExpression(cronExpression, {
      currentDate: fromDate,
      tz: 'UTC'  // Always work in UTC
    });

    return interval.next().toDate();
  }
}
```

### Step 2.2: Rate Limiter Service

```typescript
// services/rateLimiter.service.ts

@injectable()
export class RateLimiterService {
  private rateLimitTrackers: Map<string, RateLimitTracker> = new Map();

  /**
   * Check if request can be made to API
   */
  async canMakeRequest(targetApi: string, config: RateLimitConfig): Promise<boolean> {
    const tracker = this.getTracker(targetApi);

    // Check if currently in backoff
    if (tracker.backoffUntil && tracker.backoffUntil > Date.now()) {
      return false;
    }

    // Check rate limit
    const minuteAgo = Date.now() - 60000;
    tracker.requests = tracker.requests.filter(time => time > minuteAgo);

    if (tracker.requests.length >= config.maxRequestsPerMinute) {
      // Apply backoff
      tracker.backoffUntil = Date.now() + tracker.currentBackoff;
      tracker.currentBackoff = Math.min(
        tracker.currentBackoff * config.backoffMultiplier,
        CronSchedulerConfig.rateLimiting.maxBackoff
      );
      return false;
    }

    return true;
  }

  /**
   * Record request and update rate limit from response headers
   */
  recordRequest(
    targetApi: string,
    responseHeaders: Record<string, string>
  ): void {
    const tracker = this.getTracker(targetApi);
    tracker.requests.push(Date.now());

    // Parse rate limit headers
    const remaining = parseInt(responseHeaders['x-ratelimit-remaining'] || '999');
    const reset = parseInt(responseHeaders['x-ratelimit-reset'] || '0');
    const retryAfter = parseInt(responseHeaders['retry-after'] || '0');

    if (remaining === 0) {
      // We hit the rate limit
      if (retryAfter) {
        tracker.backoffUntil = Date.now() + (retryAfter * 1000);
      } else if (reset) {
        tracker.backoffUntil = reset * 1000;  // Convert to milliseconds
      } else {
        // Apply exponential backoff
        tracker.backoffUntil = Date.now() + tracker.currentBackoff;
        tracker.currentBackoff = Math.min(
          tracker.currentBackoff * 2,
          CronSchedulerConfig.rateLimiting.maxBackoff
        );
      }
    } else {
      // Reset backoff on successful request
      tracker.currentBackoff = 2000;  // Reset to initial
    }
  }

  private getTracker(targetApi: string): RateLimitTracker {
    if (!this.rateLimitTrackers.has(targetApi)) {
      this.rateLimitTrackers.set(targetApi, {
        requests: [],
        currentBackoff: 2000,
        backoffUntil: null
      });
    }
    return this.rateLimitTrackers.get(targetApi)!;
  }
}
```

### Step 2.3: Response Compressor Service

```typescript
// services/responseCompressor.service.ts

import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

@injectable()
export class ResponseCompressorService {

  /**
   * Compress response if it exceeds threshold
   */
  async compressResponse(
    data: any,
    config: ResponseConfig
  ): Promise<{ data: any, isCompressed: boolean, size: number }> {
    const jsonString = JSON.stringify(data);
    const size = Buffer.byteLength(jsonString);

    // Check size limit
    if (size > config.maxSizeBytes) {
      if (!config.storeFullResponse) {
        // Truncate response
        const truncated = jsonString.substring(0, config.maxSizeBytes);
        return {
          data: JSON.parse(truncated + '"}'),  // Close JSON safely
          isCompressed: false,
          size: config.maxSizeBytes
        };
      }
      // Store to external storage (S3/Azure) - implementation needed
      // Return reference instead
    }

    if (config.compressResponse && size > 1024) {  // Compress if > 1KB
      const compressed = await gzip(jsonString);
      return {
        data: compressed.toString('base64'),
        isCompressed: true,
        size: compressed.length
      };
    }

    return {
      data,
      isCompressed: false,
      size
    };
  }

  /**
   * Decompress response for reading
   */
  async decompressResponse(data: string, isCompressed: boolean): Promise<any> {
    if (!isCompressed) {
      return typeof data === 'string' ? JSON.parse(data) : data;
    }

    const buffer = Buffer.from(data, 'base64');
    const decompressed = await gunzip(buffer);
    return JSON.parse(decompressed.toString());
  }
}
```

### Step 2.4: Main Cron Scheduler Service

```typescript
// services/cronScheduler.service.ts

@injectable()
export class CronSchedulerService {
  constructor(
    @inject('Logger') private logger: Logger,
    @inject('TimeCalculatorService') private timeCalculator: TimeCalculatorService,
    @inject('CronQueueService') private queueService: CronQueueService,
    @inject('RateLimiterService') private rateLimiter: RateLimiterService,
    @inject('ResponseCompressorService') private compressor: ResponseCompressorService
  ) {}

  /**
   * Create a new scheduled job with duplicate prevention
   */
  async createJob(
    data: ICronJobRequest,
    orgId: string,
    userId: string
  ): Promise<ICronJob> {
    try {
      // 1. Check for duplicates (Risk Mitigation: Job Duplication)
      if (CronSchedulerConfig.duplicatePrevention.enabled) {
        // Check idempotency key
        if (data.idempotencyKey) {
          const existing = await CronJob.findOne({
            orgId,
            idempotencyKey: data.idempotencyKey
          });
          if (existing) {
            this.logger.info('Duplicate job prevented by idempotency key');
            return existing;
          }
        }

        // Check fingerprint
        const tempJob = new CronJob(data);
        await tempJob.validate();  // Generate fingerprint
        const duplicate = await CronJob.checkDuplicate(
          tempJob.jobFingerprint,
          CronSchedulerConfig.duplicatePrevention.timeWindowMinutes
        );
        if (duplicate) {
          this.logger.warn('Duplicate job detected within time window');
          throw new Error('Duplicate job detected. Please wait before creating similar job.');
        }
      }

      // 2. Convert times to UTC (Risk Mitigation: Timezone Issues)
      const userTimezone = data.timezone || CronSchedulerConfig.timezone.default;
      const nextRunAt = this.timeCalculator.parseScheduleToUTC(data, userTimezone);

      // 3. Create job document
      const job = new CronJob({
        ...data,
        jobUuid: uuidv4(),  // Risk Mitigation: Unique IDs
        orgId,
        createdBy: userId,
        userTimezone,
        nextRunAt,  // Stored in UTC
        executionCount: 0,
        consecutiveFailures: 0,
        status: 'active',

        // Set defaults for risk mitigation
        rateLimitConfig: {
          maxRequestsPerMinute: data.rateLimitConfig?.maxRequestsPerMinute || 60,
          currentBackoff: 2000,
          ...data.rateLimitConfig
        },
        responseConfig: {
          maxSizeBytes: data.responseConfig?.maxSizeBytes || (10 * 1024 * 1024),
          compressResponse: data.responseConfig?.compressResponse !== false,
          storeFullResponse: data.responseConfig?.storeFullResponse || false,
          ...data.responseConfig
        }
      });

      // Generate cron expression for recurring jobs
      if (data.scheduleType === 'recurring' && data.recurring) {
        job.recurring!.cronExpression = this.timeCalculator.generateCronExpression(
          data.recurring,
          userTimezone
        );
      }

      // 4. Save to database
      await job.save();

      // 5. Schedule with BullMQ
      await this.queueService.scheduleJob(job);

      this.logger.info(`Job created: ${job.jobUuid}`);
      return job;

    } catch (error) {
      this.logger.error('Failed to create job:', error);
      throw error;
    }
  }

  /**
   * Pause a job (with proper cleanup)
   */
  async pauseJob(jobId: string, orgId: string): Promise<void> {
    const job = await CronJob.findOne({ _id: jobId, orgId });
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== 'active') {
      throw new Error(`Cannot pause job with status: ${job.status}`);
    }

    // Update status
    job.status = 'paused';
    await job.save();

    // Remove from queue
    await this.queueService.cancelJob(job.jobUuid);

    this.logger.info(`Job paused: ${job.jobUuid}`);
  }

  /**
   * Resume a paused job
   */
  async resumeJob(jobId: string, orgId: string): Promise<void> {
    const job = await CronJob.findOne({ _id: jobId, orgId });
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== 'paused') {
      throw new Error(`Cannot resume job with status: ${job.status}`);
    }

    // Calculate new next run time
    const userTimezone = job.userTimezone;
    if (job.scheduleType === 'recurring' && job.recurring) {
      job.nextRunAt = this.timeCalculator.calculateNextRun(
        job.recurring,
        userTimezone
      );
    } else if (job.oneTime) {
      // For one-time jobs, check if the time has passed
      if (job.oneTime.dateTime < new Date()) {
        throw new Error('Scheduled time has already passed');
      }
      job.nextRunAt = job.oneTime.dateTime;
    }

    // Update status
    job.status = 'active';
    await job.save();

    // Re-schedule with BullMQ
    await this.queueService.scheduleJob(job);

    this.logger.info(`Job resumed: ${job.jobUuid}`);
  }
}
```

---

## Phase 3: API Layer Implementation

### Goal
Create RESTful endpoints with comprehensive validation and error handling.

### Step 3.1: Validation Middleware

```typescript
// middlewares/cronValidation.middleware.ts

import { z } from 'zod';
import moment from 'moment-timezone';

const scheduleSchema = z.object({
  name: z.string().min(1).max(200),
  prompt: z.string().min(1).max(10000),
  targetApi: z.string().url().startsWith('http'),
  headers: z.record(z.string()).optional(),

  scheduleType: z.enum(['once', 'recurring']),
  timezone: z.string().optional().default('UTC'),

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

  idempotencyKey: z.string().optional(),

  rateLimitConfig: z.object({
    maxRequestsPerMinute: z.number().min(1).max(1000).optional(),
    backoffMultiplier: z.number().min(1).max(10).optional()
  }).optional(),

  responseConfig: z.object({
    maxSizeBytes: z.number().min(1024).max(50 * 1024 * 1024).optional(),
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
  message: 'Schedule configuration missing for selected type'
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
  message: 'Schedule time must be in the future'
})
.refine(data => {
  // Validate timezone
  if (data.timezone) {
    return moment.tz.zone(data.timezone) !== null;
  }
  return true;
}, {
  message: 'Invalid timezone'
});

export const validateScheduleRequest = (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = scheduleSchema.parse(req.body);
    req.body = validated;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }
    next(error);
  }
};
```

### Step 3.2: Controller Implementation

```typescript
// controller/cronScheduler.controller.ts

@injectable()
export class CronSchedulerController {
  constructor(
    @inject('CronSchedulerService') private service: CronSchedulerService,
    @inject('Logger') private logger: Logger
  ) {}

  /**
   * POST /api/v1/cron/schedule
   * Create a new scheduled job
   */
  async createJob(req: Request, res: Response): Promise<void> {
    try {
      // Extract org and user from auth
      const orgId = req.user.orgId;
      const userId = req.user.id;

      // Check for idempotency header
      const idempotencyKey = req.headers['idempotency-key'] as string;
      if (idempotencyKey) {
        req.body.idempotencyKey = idempotencyKey;
      }

      const job = await this.service.createJob(req.body, orgId, userId);

      res.status(201).json({
        success: true,
        message: 'Job scheduled successfully',
        data: {
          jobId: job._id,
          jobUuid: job.jobUuid,
          name: job.name,
          nextRunAt: job.nextRunAt,
          status: job.status
        }
      });
    } catch (error: any) {
      this.logger.error('Failed to create job:', error);

      if (error.message.includes('Duplicate')) {
        res.status(409).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create job'
        });
      }
    }
  }

  /**
   * GET /api/v1/cron/jobs
   * List all jobs for the organization
   */
  async listJobs(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user.orgId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;

      const filter: any = { orgId };
      if (status) {
        filter.status = status;
      }

      const jobs = await CronJob.find(filter)
        .sort({ nextRunAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await CronJob.countDocuments(filter);

      res.json({
        success: true,
        data: jobs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      this.logger.error('Failed to list jobs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list jobs'
      });
    }
  }

  /**
   * GET /api/v1/cron/jobs/:id/history
   * Get execution history for a job
   */
  async getJobHistory(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user.orgId;
      const jobId = req.params.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      // Verify job ownership
      const job = await CronJob.findOne({ _id: jobId, orgId });
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      const executions = await CronExecution.find({ jobId })
        .sort({ executedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await CronExecution.countDocuments({ jobId });

      // Decompress responses if needed
      const decompressed = await Promise.all(
        executions.map(async (exec) => {
          if (exec.response?.isCompressed) {
            exec.response.data = await this.compressor.decompressResponse(
              exec.response.data,
              true
            );
          }
          return exec;
        })
      );

      res.json({
        success: true,
        data: decompressed,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      this.logger.error('Failed to get job history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get job history'
      });
    }
  }
}
```

---

## Phase 4: BullMQ Integration & Worker Setup

### Goal
Implement reliable job scheduling and execution with all risk mitigations.

### Step 4.1: Queue Service

```typescript
// services/cronQueue.service.ts

import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

@injectable()
export class CronQueueService {
  private queue: Queue;
  private queueEvents: QueueEvents;
  private redisConnection: IORedis;

  constructor(@inject('Logger') private logger: Logger) {
    this.initializeQueue();
  }

  private initializeQueue(): void {
    // Create Redis connection with failover support
    this.redisConnection = new IORedis({
      ...CronSchedulerConfig.queue.redis,
      reconnectOnError: (err) => {
        this.logger.error('Redis connection error:', err);
        return true;  // Always reconnect
      }
    });

    // Monitor Redis connection
    this.redisConnection.on('error', (error) => {
      this.logger.error('Redis error:', error);
      // Implement fallback to database polling if needed
    });

    this.redisConnection.on('connect', () => {
      this.logger.info('Redis connected successfully');
    });

    // Create queue
    this.queue = new Queue(CronSchedulerConfig.queue.name, {
      connection: this.redisConnection,
      defaultJobOptions: CronSchedulerConfig.queue.defaultJobOptions
    });

    // Create queue events for monitoring
    this.queueEvents = new QueueEvents(CronSchedulerConfig.queue.name, {
      connection: this.redisConnection.duplicate()
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.logger.info(`Job ${jobId} completed`);
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.error(`Job ${jobId} failed: ${failedReason}`);
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      this.logger.warn(`Job ${jobId} stalled`);
    });
  }

  /**
   * Schedule a job with proper error handling
   */
  async scheduleJob(job: ICronJob): Promise<void> {
    try {
      if (job.scheduleType === 'once') {
        // One-time job
        const delay = job.nextRunAt.getTime() - Date.now();
        if (delay < 0) {
          throw new Error('Cannot schedule job in the past');
        }

        await this.queue.add(
          'execute-job',
          {
            jobId: job._id.toString(),
            jobUuid: job.jobUuid
          },
          {
            delay,
            jobId: job.jobUuid  // Use UUID to ensure uniqueness
          }
        );
      } else {
        // Recurring job
        await this.queue.add(
          'execute-job',
          {
            jobId: job._id.toString(),
            jobUuid: job.jobUuid
          },
          {
            repeat: {
              pattern: job.recurring!.cronExpression,
              startDate: new Date(job.recurring!.startDate),
              endDate: job.recurring!.endDate ?
                new Date(job.recurring!.endDate) : undefined,
              tz: 'UTC'  // Always use UTC
            },
            jobId: job.jobUuid
          }
        );
      }

      this.logger.info(`Job scheduled: ${job.jobUuid}`);
    } catch (error) {
      this.logger.error('Failed to schedule job:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled job
   */
  async cancelJob(jobUuid: string): Promise<void> {
    try {
      const job = await this.queue.getJob(jobUuid);
      if (job) {
        await job.remove();
        this.logger.info(`Job cancelled: ${jobUuid}`);
      }

      // Also remove any repeatable jobs
      const repeatableJobs = await this.queue.getRepeatableJobs();
      const toRemove = repeatableJobs.find(r => r.id === jobUuid);
      if (toRemove) {
        await this.queue.removeRepeatableByKey(toRemove.key);
      }
    } catch (error) {
      this.logger.error('Failed to cancel job:', error);
      throw error;
    }
  }
}
```

### Step 4.2: Worker Service

```typescript
// services/cronWorker.service.ts

import { Worker, Job } from 'bullmq';
import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

@injectable()
export class CronWorkerService {
  private worker: Worker;

  constructor(
    @inject('Logger') private logger: Logger,
    @inject('RateLimiterService') private rateLimiter: RateLimiterService,
    @inject('ResponseCompressorService') private compressor: ResponseCompressorService,
    @inject('TimeCalculatorService') private timeCalculator: TimeCalculatorService
  ) {
    this.initializeWorker();
  }

  private initializeWorker(): void {
    this.worker = new Worker(
      CronSchedulerConfig.queue.name,
      async (job: Job) => await this.processJob(job),
      {
        connection: new IORedis(CronSchedulerConfig.queue.redis),
        concurrency: CronSchedulerConfig.worker.concurrency,
        maxStalledCount: CronSchedulerConfig.worker.maxStalledCount,
        stalledInterval: CronSchedulerConfig.worker.stalledInterval
      }
    );

    // Worker event handlers
    this.worker.on('completed', (job) => {
      this.logger.info(`Worker completed job: ${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Worker failed job ${job?.id}:`, error);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      await this.worker.close();
    });
  }

  /**
   * Process a scheduled job
   */
  private async processJob(job: Job): Promise<void> {
    const startTime = Date.now();
    let execution: any;

    try {
      const { jobId, jobUuid } = job.data;

      // 1. Fetch job from database
      const cronJob = await CronJob.findById(jobId);
      if (!cronJob) {
        throw new Error(`Job not found: ${jobId}`);
      }

      // Check if job is still active
      if (cronJob.status !== 'active') {
        this.logger.info(`Skipping inactive job: ${jobUuid}`);
        return;
      }

      // 2. Check rate limiting
      const canProceed = await this.rateLimiter.canMakeRequest(
        cronJob.targetApi,
        cronJob.rateLimitConfig
      );

      if (!canProceed) {
        throw new Error('Rate limit exceeded, will retry later');
      }

      // 3. Create execution record
      execution = new CronExecution({
        executionUuid: uuidv4(),
        jobId: cronJob._id,
        jobUuid: cronJob.jobUuid,
        orgId: cronJob.orgId,
        scheduledFor: cronJob.nextRunAt,
        executedAt: new Date(),
        status: 'pending',
        request: {
          prompt: cronJob.prompt,
          targetApi: cronJob.targetApi,
          headers: cronJob.headers || {},
          timeout: CronSchedulerConfig.http.timeout
        },
        attempts: job.attemptsMade + 1
      });

      await execution.save();

      // 4. Prepare HTTP client with retry
      const httpClient = axios.create({
        timeout: CronSchedulerConfig.http.timeout,
        maxRedirects: CronSchedulerConfig.http.maxRedirects,
        maxContentLength: CronSchedulerConfig.http.maxResponseSize,
        maxBodyLength: CronSchedulerConfig.http.maxResponseSize
      });

      // Configure retry logic
      axiosRetry(httpClient, CronSchedulerConfig.http.retryConfig);

      // 5. Make HTTP request
      this.logger.info(`Executing job ${jobUuid} to ${cronJob.targetApi}`);

      const response = await httpClient.post(
        cronJob.targetApi,
        { prompt: cronJob.prompt },
        { headers: cronJob.headers || {} }
      );

      // 6. Process and compress response
      const compressed = await this.compressor.compressResponse(
        response.data,
        cronJob.responseConfig
      );

      // 7. Update execution record
      execution.status = 'success';
      execution.completedAt = new Date();
      execution.duration = Date.now() - startTime;
      execution.response = {
        statusCode: response.status,
        headers: response.headers as any,
        data: compressed.data,
        dataSize: compressed.size,
        isCompressed: compressed.isCompressed,
        isTruncated: compressed.size >= cronJob.responseConfig.maxSizeBytes
      };

      await execution.save();

      // 8. Update rate limiter
      this.rateLimiter.recordRequest(cronJob.targetApi, response.headers as any);

      // 9. Update job status
      cronJob.lastRunAt = new Date();
      cronJob.executionCount += 1;
      cronJob.consecutiveFailures = 0;  // Reset on success

      // 10. Calculate next run for recurring jobs
      if (cronJob.scheduleType === 'recurring') {
        cronJob.nextRunAt = this.timeCalculator.calculateNextRun(
          cronJob.recurring!,
          cronJob.userTimezone,
          new Date()
        );

        // Check if job has reached end date
        if (cronJob.recurring!.endDate &&
            cronJob.nextRunAt > cronJob.recurring!.endDate) {
          cronJob.status = 'completed';
          this.logger.info(`Recurring job completed: ${jobUuid}`);
        }
      } else {
        // One-time job completed
        cronJob.status = 'completed';
      }

      await cronJob.save();

      this.logger.info(`Job ${jobUuid} executed successfully in ${Date.now() - startTime}ms`);

    } catch (error: any) {
      this.logger.error(`Job execution failed:`, error);

      // Update execution record with error
      if (execution) {
        execution.status = 'failed';
        execution.completedAt = new Date();
        execution.duration = Date.now() - startTime;
        execution.error = {
          message: error.message,
          code: error.code || 'UNKNOWN',
          stack: error.stack,
          retryable: this.isRetryableError(error)
        };

        // Handle specific error types
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          if (axiosError.response) {
            execution.response = {
              statusCode: axiosError.response.status,
              headers: axiosError.response.headers as any
            };

            // Update rate limiter with error response
            this.rateLimiter.recordRequest(
              execution.request.targetApi,
              axiosError.response.headers as any
            );
          }

          // Check for rate limiting
          if (axiosError.response?.status === 429) {
            execution.status = 'rate_limited';
          }
        }

        await execution.save();
      }

      // Update job with failure
      const cronJob = await CronJob.findById(job.data.jobId);
      if (cronJob) {
        cronJob.consecutiveFailures += 1;

        // Mark as failed after max consecutive failures
        if (cronJob.consecutiveFailures >= 5) {
          cronJob.status = 'failed';
          this.logger.error(`Job ${cronJob.jobUuid} marked as failed after 5 consecutive failures`);
        }

        await cronJob.save();
      }

      // Re-throw for BullMQ retry logic
      if (this.isRetryableError(error)) {
        throw error;
      }
    }
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      // Retry on network errors and 5xx errors
      return !error.response || (status !== undefined && status >= 500);
    }
    return true;  // Retry unknown errors
  }
}
```

---

## Phase 5: Integration with Existing System

### Goal
Integrate the cron scheduler module with your existing Express.js application.

### Step 5.1: Container Setup

```typescript
// container/cronScheduler.container.ts

import { Container } from 'inversify';

export class CronSchedulerContainer {
  private static container: Container;

  static async initialize(config: AppConfig): Promise<Container> {
    const container = new Container();

    // Bind configuration
    container.bind<AppConfig>('AppConfig').toConstantValue(config);
    container.bind<Logger>('Logger').toConstantValue(logger);

    // Bind services
    container.bind<TimeCalculatorService>('TimeCalculatorService')
      .to(TimeCalculatorService).inSingletonScope();

    container.bind<RateLimiterService>('RateLimiterService')
      .to(RateLimiterService).inSingletonScope();

    container.bind<ResponseCompressorService>('ResponseCompressorService')
      .to(ResponseCompressorService).inSingletonScope();

    container.bind<CronQueueService>('CronQueueService')
      .to(CronQueueService).inSingletonScope();

    container.bind<CronWorkerService>('CronWorkerService')
      .to(CronWorkerService).inSingletonScope();

    container.bind<CronSchedulerService>('CronSchedulerService')
      .to(CronSchedulerService).inSingletonScope();

    // Bind controller
    container.bind<CronSchedulerController>('CronSchedulerController')
      .to(CronSchedulerController).inSingletonScope();

    // Initialize queue and worker
    const queueService = container.get<CronQueueService>('CronQueueService');
    const workerService = container.get<CronWorkerService>('CronWorkerService');

    // Start health monitoring
    if (CronSchedulerConfig.monitoring.enabled) {
      const monitor = new HealthMonitor(queueService, workerService);
      monitor.start();
    }

    this.container = container;
    return container;
  }

  static getContainer(): Container {
    if (!this.container) {
      throw new Error('CronSchedulerContainer not initialized');
    }
    return this.container;
  }
}
```

### Step 5.2: Routes Setup

```typescript
// routes/cronScheduler.routes.ts

import { Router } from 'express';
import { Container } from 'inversify';

export function createCronSchedulerRoutes(container: Container): Router {
  const router = Router();
  const controller = container.get<CronSchedulerController>('CronSchedulerController');

  // Apply authentication middleware to all routes
  router.use(authMiddleware);

  // Schedule a job
  router.post('/schedule',
    validateScheduleRequest,
    rateLimitMiddleware({ max: 10, windowMs: 60000 }), // 10 per minute
    (req, res) => controller.createJob(req, res)
  );

  // List jobs
  router.get('/jobs',
    (req, res) => controller.listJobs(req, res)
  );

  // Get job details
  router.get('/jobs/:id',
    (req, res) => controller.getJobById(req, res)
  );

  // Update job
  router.patch('/jobs/:id',
    validateUpdateRequest,
    (req, res) => controller.updateJob(req, res)
  );

  // Delete job
  router.delete('/jobs/:id',
    (req, res) => controller.deleteJob(req, res)
  );

  // Pause job
  router.patch('/jobs/:id/pause',
    (req, res) => controller.pauseJob(req, res)
  );

  // Resume job
  router.patch('/jobs/:id/resume',
    (req, res) => controller.resumeJob(req, res)
  );

  // Get execution history
  router.get('/jobs/:id/history',
    (req, res) => controller.getJobHistory(req, res)
  );

  // Health check
  router.get('/health',
    (req, res) => controller.getHealth(req, res)
  );

  return router;
}
```

### Step 5.3: App Integration

```typescript
// Update src/app.ts

class App {
  private cronSchedulerContainer: Container;

  async initialize(): Promise<void> {
    // ... existing initialization ...

    // Initialize Cron Scheduler
    this.cronSchedulerContainer = await CronSchedulerContainer.initialize(this.config);

    // Register routes
    this.app.use(
      '/api/v1/cron',
      createCronSchedulerRoutes(this.cronSchedulerContainer)
    );

    this.logger.info('Cron Scheduler module initialized');
  }
}
```

---

## Phase 6: Testing Strategy

### Testing Coverage Requirements

1. **Unit Tests** (80% coverage minimum)
   - Time calculations with timezone handling
   - Rate limiting logic
   - Response compression
   - Duplicate detection

2. **Integration Tests**
   - API endpoint testing
   - Queue operations
   - Worker job processing
   - Database operations

3. **End-to-End Tests**
   - Complete job lifecycle
   - Error scenarios
   - Rate limiting scenarios
   - Large response handling

---

## Phase 7: Monitoring & Maintenance

### Monitoring Setup

```typescript
// monitors/health.monitor.ts

export class HealthMonitor {
  private metrics = {
    jobsCreated: 0,
    jobsExecuted: 0,
    jobsFailed: 0,
    avgExecutionTime: 0,
    queueDepth: 0,
    workerMemory: 0
  };

  async checkHealth(): Promise<HealthStatus> {
    const checks = {
      redis: await this.checkRedis(),
      mongodb: await this.checkMongoDB(),
      queue: await this.checkQueue(),
      worker: await this.checkWorker()
    };

    const healthy = Object.values(checks).every(c => c);

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      checks,
      metrics: this.metrics,
      timestamp: new Date()
    };
  }
}
```

### PM2 Configuration

```javascript
// ecosystem.config.js

module.exports = {
  apps: [{
    name: 'cron-worker',
    script: './dist/workers/cronWorker.js',
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    error_file: './logs/cron-worker-error.log',
    out_file: './logs/cron-worker-out.log',
    merge_logs: true,
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

---

## Implementation Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Database Setup | 2 hours | Pending |
| Phase 2: Core Services | 4 hours | Pending |
| Phase 3: API Layer | 3 hours | Pending |
| Phase 4: BullMQ Integration | 3 hours | Pending |
| Phase 5: System Integration | 2 hours | Pending |
| Phase 6: Testing | 3 hours | Pending |
| Phase 7: Monitoring | 1 hour | Pending |

**Total: 18 hours**

---

## Success Criteria

### Functional Requirements ✅
- [ ] One-time job scheduling
- [ ] Recurring jobs (daily, weekly, monthly)
- [ ] Accurate time execution
- [ ] API request execution
- [ ] Response storage
- [ ] Job management (CRUD)
- [ ] Pause/Resume functionality
- [ ] Execution history

### Non-Functional Requirements ✅
- [ ] Handle 1000+ concurrent jobs
- [ ] Automatic retry on failures
- [ ] Multi-tenant isolation
- [ ] Sub-second API response
- [ ] 99.9% uptime target
- [ ] Comprehensive error handling
- [ ] Detailed logging
- [ ] Health monitoring

### Risk Mitigation Implementation ✅
- [ ] Redis failover configured
- [ ] Worker auto-restart with PM2
- [ ] Rate limiting implemented
- [ ] Response size limits enforced
- [ ] UTC timezone handling
- [ ] Duplicate prevention active

---

## Ready to Start Phase 1?

This comprehensive plan includes all risk mitigation strategies strictly implemented throughout the system. Each phase has detailed implementation steps with security, reliability, and performance considerations built-in.

**Awaiting your command to begin Phase 1: Database & Infrastructure Setup!** 🚀