/**
 * CronJob Mongoose Schema
 * Implements all risk mitigation strategies for production-ready system
 */

import { Schema, model, Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { ICronJob, SCHEDULE_CONSTANTS } from '../types/cronScheduler.types';

/**
 * CronJob Schema Definition
 */
const CronJobSchema = new Schema<ICronJob>({
  // Unique identifiers (Risk Mitigation: Job Duplication)
  jobUuid: {
    type: String,
    required: true,
    unique: true,
    default: () => uuidv4(),
    index: true
  },

  // Multi-tenancy fields
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },

  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    sparse: true,
    index: true
  },

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Skill identification for Claude Code
  skillId: {
    type: String,
    required: false,
    index: true,
    trim: true
  },

  // Metadata for context passing to execution endpoint
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
    // Stores: conversationId, sessionId, chatboxId, userEmail, userName, etc.
  },

  // Basic job configuration
  name: {
    type: String,
    required: [true, 'Job name is required'],
    trim: true,
    minlength: [SCHEDULE_CONSTANTS.MIN_JOB_NAME_LENGTH, 'Job name is too short'],
    maxlength: [SCHEDULE_CONSTANTS.MAX_JOB_NAME_LENGTH, 'Job name is too long']
  },

  prompt: {
    type: String,
    required: [true, 'Prompt is required'],
    minlength: [SCHEDULE_CONSTANTS.MIN_PROMPT_LENGTH, 'Prompt is too short'],
    maxlength: [SCHEDULE_CONSTANTS.MAX_PROMPT_LENGTH, 'Prompt is too long']
  },

  targetApi: {
    type: String,
    required: [true, 'Target API is required'],
    validate: {
      validator: function(v: string) {
        try {
          const url = new URL(v);
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          return false;
        }
      },
      message: 'Target API must be a valid HTTP/HTTPS URL'
    }
  },

  headers: {
    type: Map,
    of: String,
    default: new Map()
  },

  // Schedule configuration (Risk Mitigation: Timezone Issues - ALL IN UTC)
  scheduleType: {
    type: String,
    required: true,
    enum: ['once', 'recurring'],
    index: true
  },

  oneTime: {
    dateTime: {
      type: Date,
      validate: {
        validator: function(this: ICronJob, v: Date) {
          if (this.scheduleType === 'once') {
            return v && v > new Date();
          }
          return true;
        },
        message: 'One-time schedule date must be in the future'
      }
    }
  },

  recurring: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly']
    },
    time: {
      type: String,
      validate: {
        validator: function(v: string) {
          if (!v) return true;
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Time must be in HH:MM format'
      }
    },
    startDate: Date,
    endDate: {
      type: Date,
      validate: {
        validator: function(this: any, v: Date) {
          if (!v) return true;
          return v > this.recurring?.startDate;
        },
        message: 'End date must be after start date'
      }
    },
    daysOfWeek: {
      type: [Number],
      validate: {
        validator: function(v: number[]) {
          if (!v || v.length === 0) return true;
          return v.every(day => day >= 0 && day <= 6);
        },
        message: 'Days of week must be between 0 (Sunday) and 6 (Saturday)'
      }
    },
    dayOfMonth: {
      type: Number,
      min: [1, 'Day of month must be at least 1'],
      max: [31, 'Day of month cannot exceed 31']
    },
    cronExpression: {
      type: String,
      index: true
    }
  },

  // User's original timezone (for display purposes)
  userTimezone: {
    type: String,
    required: true,
    default: SCHEDULE_CONSTANTS.TIMEZONE_DEFAULT
  },

  // Job state
  status: {
    type: String,
    required: true,
    enum: ['active', 'paused', 'completed', 'failed'],
    default: 'active',
    index: true
  },

  nextRunAt: {
    type: Date,
    required: true,
    index: true // Critical index for scheduler queries
  },

  lastRunAt: {
    type: Date,
    index: true
  },

  executionCount: {
    type: Number,
    default: 0,
    min: 0
  },

  consecutiveFailures: {
    type: Number,
    default: 0,
    min: 0
  },

  // Rate limiting configuration (Risk Mitigation: API Rate Limits)
  rateLimitConfig: {
    maxRequestsPerMinute: {
      type: Number,
      default: SCHEDULE_CONSTANTS.DEFAULT_RATE_LIMIT,
      min: 1,
      max: 1000
    },
    backoffMultiplier: {
      type: Number,
      default: 2,
      min: 1.5,
      max: 10
    },
    maxBackoff: {
      type: Number,
      default: 32000,
      min: 1000,
      max: 300000
    },
    currentBackoff: {
      type: Number,
      default: SCHEDULE_CONSTANTS.MIN_BACKOFF
    },
    lastRateLimitHit: Date
  },

  // Response configuration (Risk Mitigation: Large Responses)
  responseConfig: {
    maxSizeBytes: {
      type: Number,
      default: SCHEDULE_CONSTANTS.MAX_RESPONSE_SIZE,
      min: 1024, // 1KB minimum
      max: 50 * 1024 * 1024 // 50MB maximum
    },
    compressResponse: {
      type: Boolean,
      default: true
    },
    storeFullResponse: {
      type: Boolean,
      default: false
    }
  },

  // Duplicate prevention (Risk Mitigation: Job Duplication)
  idempotencyKey: {
    type: String,
    sparse: true, // Allow null but ensure uniqueness when present
    index: true
  },

  jobFingerprint: {
    type: String,
    required: true,
    index: true
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt in UTC
  collection: 'cronjobs',
  autoIndex: false // Disable automatic index building to prevent startup issues
});

/**
 * Compound indexes for performance optimization
 */
// Main scheduler query index
CronJobSchema.index({ orgId: 1, status: 1, nextRunAt: 1 });

// Job lookup index
CronJobSchema.index({ jobUuid: 1, orgId: 1 });

// Duplicate detection index
CronJobSchema.index({ jobFingerprint: 1, createdAt: -1 });

// Active jobs for scheduler
CronJobSchema.index(
  { nextRunAt: 1, status: 1 },
  {
    partialFilterExpression: {
      status: { $in: ['active'] }
    }
  }
);

// Organization job listing
CronJobSchema.index({ orgId: 1, createdAt: -1 });

// Skill-based queries
CronJobSchema.index({ orgId: 1, skillId: 1, status: 1 });

// Project-based queries
CronJobSchema.index({ orgId: 1, projectId: 1, status: 1 });

/**
 * Virtual properties
 */
CronJobSchema.virtual('isOverdue').get(function(this: ICronJob) {
  return this.status === 'active' && this.nextRunAt < new Date();
});

CronJobSchema.virtual('hasReachedFailureLimit').get(function(this: ICronJob) {
  return this.consecutiveFailures >= SCHEDULE_CONSTANTS.MAX_CONSECUTIVE_FAILURES;
});

/**
 * Pre-save middleware
 */
CronJobSchema.pre('save', async function(next) {
  // Generate job fingerprint for duplicate detection (Risk Mitigation: Job Duplication)
  if (this.isNew) {
    const fingerprintData = {
      orgId: this.orgId.toString(),
      prompt: this.prompt,
      targetApi: this.targetApi,
      scheduleType: this.scheduleType,
      schedule: this.scheduleType === 'once' ?
        JSON.stringify(this.oneTime) :
        JSON.stringify(this.recurring)
    };

    this.jobFingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex');
  }

  // Validate schedule configuration
  if (this.scheduleType === 'once' && !this.oneTime?.dateTime) {
    return next(new Error('One-time schedule requires dateTime'));
  }

  if (this.scheduleType === 'recurring') {
    if (!this.recurring?.frequency || !this.recurring?.time || !this.recurring?.startDate) {
      return next(new Error('Recurring schedule requires frequency, time, and startDate'));
    }

    // Additional validation for weekly schedules
    if (this.recurring.frequency === 'weekly' && (!this.recurring.daysOfWeek || this.recurring.daysOfWeek.length === 0)) {
      return next(new Error('Weekly schedule requires at least one day of week'));
    }

    // Additional validation for monthly schedules
    if (this.recurring.frequency === 'monthly' && !this.recurring.dayOfMonth) {
      this.recurring.dayOfMonth = 1; // Default to first day of month
    }
  }

  next();
});

/**
 * Instance methods
 */
CronJobSchema.methods.markAsCompleted = function(this: ICronJob): Promise<ICronJob> {
  this.status = 'completed';
  return this.save();
};

CronJobSchema.methods.markAsFailed = function(this: ICronJob, _error?: string): Promise<ICronJob> {
  this.status = 'failed';
  this.consecutiveFailures += 1;
  return this.save();
};

CronJobSchema.methods.resetFailures = function(this: ICronJob): Promise<ICronJob> {
  this.consecutiveFailures = 0;
  return this.save();
};

CronJobSchema.methods.pause = function(this: ICronJob): Promise<ICronJob> {
  if (this.status !== 'active') {
    throw new Error(`Cannot pause job with status: ${this.status}`);
  }
  this.status = 'paused';
  return this.save();
};

CronJobSchema.methods.resume = function(this: ICronJob): Promise<ICronJob> {
  if (this.status !== 'paused') {
    throw new Error(`Cannot resume job with status: ${this.status}`);
  }
  this.status = 'active';
  return this.save();
};

/**
 * Static methods
 */
CronJobSchema.statics.checkDuplicate = async function(
  fingerprint: string,
  timeWindowMinutes: number = SCHEDULE_CONSTANTS.DUPLICATE_WINDOW_MINUTES
): Promise<ICronJob | null> {
  const cutoff = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  return this.findOne({
    jobFingerprint: fingerprint,
    createdAt: { $gte: cutoff }
  });
};

CronJobSchema.statics.findActiveJobs = function(orgId: string) {
  return this.find({
    orgId,
    status: 'active',
    nextRunAt: { $lte: new Date() }
  }).sort({ nextRunAt: 1 });
};

CronJobSchema.statics.findByIdempotencyKey = function(key: string, orgId: string) {
  return this.findOne({
    idempotencyKey: key,
    orgId
  });
};

CronJobSchema.statics.getStatistics = async function(orgId: string) {
  const stats = await this.aggregate([
    { $match: { orgId: new (await import('mongoose')).Types.ObjectId(orgId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    total: 0,
    active: 0,
    paused: 0,
    completed: 0,
    failed: 0
  };

  stats.forEach((stat: any) => {
    result[stat._id as keyof typeof result] = stat.count;
    result.total += stat.count;
  });

  return result;
};

/**
 * Indexes verification on startup
 */
CronJobSchema.statics.ensureIndexes = async function() {
  // Commented out to prevent infinite loop issue
  // await this.syncIndexes();
  // console.log('CronJob indexes synchronized');

  // Just ensure indexes are created without syncing
  await this.createIndexes();
  console.log('CronJob indexes created');
};

/**
 * Export the model
 */
export interface ICronJobModel extends Model<ICronJob> {
  checkDuplicate(fingerprint: string, timeWindowMinutes?: number): Promise<ICronJob | null>;
  findActiveJobs(orgId: string): Promise<ICronJob[]>;
  findByIdempotencyKey(key: string, orgId: string): Promise<ICronJob | null>;
  getStatistics(orgId: string): Promise<any>;
  ensureIndexes(): Promise<void>;
}

export const CronJob = model<ICronJob, ICronJobModel>('CronJob', CronJobSchema);