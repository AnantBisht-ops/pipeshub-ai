/**
 * CronExecution Mongoose Schema
 * Stores execution history with response data and error tracking
 */

import { Schema, model, Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ICronExecution, SCHEDULE_CONSTANTS } from '../types/cronScheduler.types';

/**
 * CronExecution Schema Definition
 */
const CronExecutionSchema = new Schema<ICronExecution>({
  // Unique identifier for each execution
  executionUuid: {
    type: String,
    required: true,
    unique: true,
    default: () => uuidv4(),
    index: true
  },

  // Job reference
  jobId: {
    type: Schema.Types.ObjectId,
    ref: 'CronJob',
    required: true,
    index: true
  },

  jobUuid: {
    type: String,
    required: true,
    index: true
  },

  // Multi-tenancy
  orgId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },

  // Execution timing (Risk Mitigation: Timezone Issues - ALL IN UTC)
  scheduledFor: {
    type: Date,
    required: true
  },

  executedAt: {
    type: Date,
    required: true,
    index: true
  },

  completedAt: {
    type: Date
  },

  // Request details
  request: {
    prompt: {
      type: String,
      required: true
    },
    targetApi: {
      type: String,
      required: true
    },
    headers: {
      type: Map,
      of: String,
      default: new Map()
    },
    timeout: {
      type: Number,
      required: true,
      default: SCHEDULE_CONSTANTS.DEFAULT_TIMEOUT
    }
  },

  // Response details (Risk Mitigation: Large Responses)
  response: {
    statusCode: {
      type: Number,
      min: 100,
      max: 599
    },
    headers: {
      type: Map,
      of: String
    },
    data: {
      type: Schema.Types.Mixed,
      validate: {
        validator: function(v: any) {
          if (!v) return true;

          // Check size limit (Risk Mitigation: Large Responses)
          const size = Buffer.byteLength(
            typeof v === 'string' ? v : JSON.stringify(v)
          );

          // Allow slightly larger size for compressed data (base64 adds ~33% overhead)
          return size <= SCHEDULE_CONSTANTS.MAX_RESPONSE_SIZE * 1.4;
        },
        message: `Response data exceeds ${SCHEDULE_CONSTANTS.MAX_RESPONSE_SIZE / (1024 * 1024)}MB limit`
      }
    },
    dataSize: {
      type: Number,
      min: 0
    },
    isCompressed: {
      type: Boolean,
      default: false
    },
    isTruncated: {
      type: Boolean,
      default: false
    },
    storageLocation: {
      type: String, // S3/Azure path for large responses
      validate: {
        validator: function(v: string) {
          if (!v) return true;
          // Validate storage path format
          return /^(s3|azure|local):\/\//.test(v);
        },
        message: 'Storage location must start with s3://, azure://, or local://'
      }
    }
  },

  // Execution status
  status: {
    type: String,
    required: true,
    enum: ['success', 'failed', 'timeout', 'rate_limited'],
    index: true
  },

  // Performance metrics
  duration: {
    type: Number, // milliseconds
    required: true,
    min: 0
  },

  attempts: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
    max: SCHEDULE_CONSTANTS.MAX_RETRIES + 1
  },

  // Error tracking
  error: {
    message: {
      type: String,
      maxlength: 5000
    },
    code: {
      type: String,
      maxlength: 100
    },
    stack: {
      type: String,
      maxlength: 10000
    },
    retryable: {
      type: Boolean,
      default: false
    }
  },

  // Rate limit information (Risk Mitigation: API Rate Limits)
  rateLimitInfo: {
    remaining: {
      type: Number,
      min: 0
    },
    reset: Date,
    retryAfter: {
      type: Number, // seconds
      min: 0
    }
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }, // Only track creation time
  collection: 'cronexecutions',
  autoIndex: false // Disable automatic index building to prevent startup issues
});

/**
 * Indexes for query optimization
 */
// Main query index for execution history
CronExecutionSchema.index({ jobId: 1, executedAt: -1 });

// Organization-based queries
CronExecutionSchema.index({ orgId: 1, status: 1, executedAt: -1 });

// Job UUID lookup
CronExecutionSchema.index({ jobUuid: 1, executedAt: -1 });

// Status aggregation
CronExecutionSchema.index({ status: 1, executedAt: -1 });

// TTL Index - Auto-delete old executions after 30 days (Risk Mitigation: Storage Management)
CronExecutionSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
    name: 'execution_ttl_index'
  }
);

// Performance monitoring index
CronExecutionSchema.index({ duration: 1, status: 1 });

/**
 * Virtual properties
 */
CronExecutionSchema.virtual('isSuccess').get(function(this: ICronExecution) {
  return this.status === 'success';
});

CronExecutionSchema.virtual('isFailed').get(function(this: ICronExecution) {
  return this.status === 'failed';
});

CronExecutionSchema.virtual('isRateLimited').get(function(this: ICronExecution) {
  return this.status === 'rate_limited';
});

CronExecutionSchema.virtual('executionTime').get(function(this: ICronExecution) {
  if (this.executedAt && this.completedAt) {
    return this.completedAt.getTime() - this.executedAt.getTime();
  }
  return this.duration;
});

/**
 * Pre-save middleware
 */
CronExecutionSchema.pre('save', function(next) {
  // Calculate duration if not set
  if (!this.duration && this.executedAt && this.completedAt) {
    this.duration = this.completedAt.getTime() - this.executedAt.getTime();
  }

  // Validate response size
  if (this.response?.data && !this.response.isCompressed) {
    const size = Buffer.byteLength(
      typeof this.response.data === 'string' ?
        this.response.data :
        JSON.stringify(this.response.data)
    );
    this.response.dataSize = size;

    // Mark as truncated if exceeds limit
    if (size > SCHEDULE_CONSTANTS.MAX_RESPONSE_SIZE) {
      this.response.isTruncated = true;
    }
  }

  next();
});

/**
 * Instance methods
 */
CronExecutionSchema.methods.markAsSuccess = function(this: ICronExecution): Promise<ICronExecution> {
  this.status = 'success';
  this.completedAt = new Date();
  if (!this.duration) {
    this.duration = this.completedAt.getTime() - this.executedAt.getTime();
  }
  return this.save();
};

CronExecutionSchema.methods.markAsFailed = function(
  this: ICronExecution,
  error: Error,
  retryable: boolean = false
): Promise<ICronExecution> {
  this.status = 'failed';
  this.completedAt = new Date();
  this.error = {
    message: error.message,
    code: (error as any).code || 'UNKNOWN',
    stack: error.stack,
    retryable
  };
  if (!this.duration) {
    this.duration = this.completedAt.getTime() - this.executedAt.getTime();
  }
  return this.save();
};

CronExecutionSchema.methods.markAsTimeout = function(this: ICronExecution): Promise<ICronExecution> {
  this.status = 'timeout';
  this.completedAt = new Date();
  this.error = {
    message: 'Request timed out',
    code: 'TIMEOUT',
    stack: undefined,
    retryable: true
  };
  if (!this.duration) {
    this.duration = this.completedAt.getTime() - this.executedAt.getTime();
  }
  return this.save();
};

CronExecutionSchema.methods.markAsRateLimited = function(
  this: ICronExecution,
  retryAfter?: number
): Promise<ICronExecution> {
  this.status = 'rate_limited';
  this.completedAt = new Date();
  if (retryAfter) {
    this.rateLimitInfo = {
      remaining: 0,
      reset: new Date(Date.now() + retryAfter * 1000),
      retryAfter
    };
  }
  if (!this.duration) {
    this.duration = this.completedAt.getTime() - this.executedAt.getTime();
  }
  return this.save();
};

/**
 * Static methods
 */
CronExecutionSchema.statics.getRecentExecutions = function(
  jobId: string,
  limit: number = 10
) {
  return this.find({ jobId })
    .sort({ executedAt: -1 })
    .limit(limit)
    .lean();
};

CronExecutionSchema.statics.getSuccessRate = async function(
  jobId: string,
  days: number = 7
): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stats = await this.aggregate([
    {
      $match: {
        jobId: new (await import('mongoose')).Types.ObjectId(jobId),
        executedAt: { $gte: since }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  let total = 0;
  let successful = 0;

  stats.forEach((stat: any) => {
    total += stat.count;
    if (stat._id === 'success') {
      successful = stat.count;
    }
  });

  return total > 0 ? (successful / total) * 100 : 0;
};

CronExecutionSchema.statics.getAverageExecutionTime = async function(
  jobId: string,
  days: number = 7
): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const result = await this.aggregate([
    {
      $match: {
        jobId: new (await import('mongoose')).Types.ObjectId(jobId),
        executedAt: { $gte: since },
        status: 'success'
      }
    },
    {
      $group: {
        _id: null,
        avgDuration: { $avg: '$duration' }
      }
    }
  ]);

  return result.length > 0 ? Math.round(result[0].avgDuration) : 0;
};

CronExecutionSchema.statics.cleanupOldExecutions = async function(
  daysToKeep: number = 30
): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  const result = await this.deleteMany({ createdAt: { $lt: cutoff } });
  return result.deletedCount || 0;
};

CronExecutionSchema.statics.getExecutionStatistics = async function(orgId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalStats, todayStats] = await Promise.all([
    // All-time statistics
    this.aggregate([
      { $match: { orgId: new (await import('mongoose')).Types.ObjectId(orgId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' }
        }
      }
    ]),
    // Today's statistics
    this.countDocuments({
      orgId: new (await import('mongoose')).Types.ObjectId(orgId),
      executedAt: { $gte: today }
    })
  ]);

  const result = {
    total: 0,
    success: 0,
    failed: 0,
    timeout: 0,
    rateLimited: 0,
    avgDuration: 0,
    executionsToday: todayStats
  };

  let totalDuration = 0;
  let durationCount = 0;

  totalStats.forEach((stat: any) => {
    const status = stat._id as keyof typeof result;
    if (status in result && typeof result[status] === 'number') {
      (result as any)[status] = stat.count;
      result.total += stat.count;
    }
    if (stat.avgDuration) {
      totalDuration += stat.avgDuration * stat.count;
      durationCount += stat.count;
    }
  });

  result.avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

  return result;
};

/**
 * Export the model
 */
export interface ICronExecutionModel extends Model<ICronExecution> {
  getRecentExecutions(jobId: string, limit?: number): Promise<ICronExecution[]>;
  getSuccessRate(jobId: string, days?: number): Promise<number>;
  getAverageExecutionTime(jobId: string, days?: number): Promise<number>;
  cleanupOldExecutions(daysToKeep?: number): Promise<number>;
  getExecutionStatistics(orgId: string): Promise<any>;
}

export const CronExecution = model<ICronExecution, ICronExecutionModel>('CronExecution', CronExecutionSchema);