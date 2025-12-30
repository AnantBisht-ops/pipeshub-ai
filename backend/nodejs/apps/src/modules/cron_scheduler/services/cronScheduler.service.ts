/**
 * Main Cron Scheduler Service
 * Coordinates all cron job operations and integrates with other services
 * Handles CRUD operations, duplicate prevention, and job management
 */

import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
import { CronJob, ICronJobModel } from '../schema/cronJob.schema';
import { CronExecution, ICronExecutionModel } from '../schema/cronExecution.schema';
import { TimeCalculatorService } from './timeCalculator.service';
import { CronQueueService } from './cronQueue.service';
import { CronSchedulerConfig } from '../config/cronScheduler.config';
import {
  ICronJobRequest,
  ICronJob,
  ICronExecution,
  IJobStatistics,
  IApiResponse,
  JobStatus,
  ExecutionStatus,
  SCHEDULE_CONSTANTS
} from '../types/cronScheduler.types';
import { CRON_EVENTS } from '../constants/cronScheduler.constants';

/**
 * Job filter options
 */
interface JobFilterOptions {
  status?: JobStatus;
  scheduleType?: 'once' | 'recurring';
  projectId?: string;
  search?: string;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Pagination options
 */
interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@injectable()
export class CronSchedulerService {
  constructor(
    @inject('Logger') private logger: any,
    @inject('TimeCalculatorService') private timeCalculator: TimeCalculatorService,
    @inject('CronQueueService') private queueService: CronQueueService
  ) {}

  /**
   * Trigger manual job execution
   * This will add a job to the queue immediately
   */
  public async triggerManualExecution(jobId: string): Promise<ICronExecution> {
    try {
      const job = await CronJob.findById(jobId);

      if (!job) {
        throw new Error('Job not found');
      }

      // Create a manual execution record
      const execution = new CronExecution({
        executionUuid: uuidv4(),
        jobId: job._id,
        jobUuid: job.jobUuid,
        jobName: job.name,
        orgId: job.orgId,
        status: 'pending' as ExecutionStatus,
        isManual: true,
        startedAt: new Date(),
        attemptNumber: 1
      });

      await execution.save();

      // Add to queue immediately (no delay)
      // Temporarily set nextRunAt for immediate execution
      const originalNextRunAt = job.nextRunAt;
      job.nextRunAt = new Date(); // Execute immediately
      await this.queueService.scheduleJob(job);
      job.nextRunAt = originalNextRunAt; // Restore original value

      this.logger.info(`Manual execution triggered for job: ${job.jobUuid}`);
      return execution as ICronExecution;

    } catch (error: any) {
      this.logger.error(`Failed to trigger manual execution:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Create a new scheduled job with duplicate prevention
   * Risk Mitigation: Job Duplication - Check for duplicates before creating
   */
  public async createJob(
    data: ICronJobRequest,
    orgId: string,
    userId: string
  ): Promise<ICronJob> {
    try {
      // Validate schedule configuration
      this.timeCalculator.validateSchedule(data);

      // Check for duplicates (Risk Mitigation: Job Duplication)
      if (CronSchedulerConfig.duplicatePrevention.enabled) {
        await this.checkForDuplicates(data, orgId);
      }

      // Convert times to UTC (Risk Mitigation: Timezone Issues)
      const userTimezone = data.timezone || CronSchedulerConfig.timezone.default;
      const nextRunAt = this.timeCalculator.parseScheduleToUTC(data, userTimezone);

      // Create job document
      const job = new CronJob({
        // Unique identifiers
        jobUuid: uuidv4(),

        // Organization and user
        orgId: new Types.ObjectId(orgId),
        projectId: data.projectId ? new Types.ObjectId(data.projectId) : undefined,
        createdBy: new Types.ObjectId(userId),

        // Skill identification
        skillId: data.skillId,

        // Metadata for context
        metadata: data.metadata || {},

        // Job configuration
        name: data.name,
        prompt: data.prompt,
        targetApi: data.targetApi,
        headers: data.headers || {},

        // Schedule configuration
        scheduleType: data.scheduleType,
        userTimezone,
        nextRunAt,

        // Job state
        status: JobStatus.ACTIVE,
        executionCount: 0,
        consecutiveFailures: 0,

        // Rate limiting configuration
        rateLimitConfig: {
          maxRequestsPerMinute: data.rateLimitConfig?.maxRequestsPerMinute ||
                                SCHEDULE_CONSTANTS.DEFAULT_RATE_LIMIT,
          currentBackoff: SCHEDULE_CONSTANTS.MIN_BACKOFF,
          ...data.rateLimitConfig
        },

        // Response configuration
        responseConfig: {
          maxSizeBytes: data.responseConfig?.maxSizeBytes ||
                       SCHEDULE_CONSTANTS.MAX_RESPONSE_SIZE,
          compressResponse: data.responseConfig?.compressResponse !== false,
          storeFullResponse: data.responseConfig?.storeFullResponse || false,
          ...data.responseConfig
        },

        // Duplicate prevention
        idempotencyKey: data.idempotencyKey
      });

      // Set schedule-specific fields
      if (data.scheduleType === 'once' && data.oneTime) {
        job.oneTime = {
          dateTime: nextRunAt
        };
      } else if (data.scheduleType === 'recurring' && data.recurring) {
        const cronExpression = this.timeCalculator.generateCronExpression(
          data.recurring,
          userTimezone
        );

        job.recurring = {
          frequency: data.recurring.frequency,
          time: data.recurring.time,
          startDate: new Date(data.recurring.startDate),
          endDate: data.recurring.endDate ? new Date(data.recurring.endDate) : undefined,
          daysOfWeek: data.recurring.daysOfWeek,
          dayOfMonth: data.recurring.dayOfMonth,
          cronExpression
        };
      }

      // Save to database
      await job.save();

      // Schedule with BullMQ (Phase 4 Integration)
      await this.queueService.scheduleJob(job);

      this.logger.info(`Job created: ${job.jobUuid}`, {
        jobId: job._id,
        orgId,
        name: job.name,
        nextRunAt: job.nextRunAt
      });

      // Emit event for monitoring
      this.emitEvent(CRON_EVENTS.JOB_CREATED, job);

      return job;

    } catch (error: any) {
      this.logger.error('Failed to create job:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get all jobs for an organization with filtering and pagination
   */
  public async getJobs(
    orgId: string,
    filters: JobFilterOptions = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<IApiResponse<ICronJob[]>> {
    try {
      // Build query
      const query: any = { orgId: new Types.ObjectId(orgId) };

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.scheduleType) {
        query.scheduleType = filters.scheduleType;
      }

      if (filters.projectId) {
        query.projectId = new Types.ObjectId(filters.projectId);
      }

      if (filters.fromDate || filters.toDate) {
        query.nextRunAt = {};
        if (filters.fromDate) {
          query.nextRunAt.$gte = filters.fromDate;
        }
        if (filters.toDate) {
          query.nextRunAt.$lte = filters.toDate;
        }
      }

      // Text search
      if (filters.search) {
        query.$text = { $search: filters.search };
      }

      // Calculate pagination
      const page = Math.max(1, pagination.page);
      const limit = Math.min(Math.max(1, pagination.limit), 100);
      const skip = (page - 1) * limit;

      // Build sort
      const sort: any = {};
      const sortField = pagination.sortBy || 'nextRunAt';
      sort[sortField] = pagination.sortOrder === 'desc' ? -1 : 1;

      // Execute queries in parallel
      const [jobs, total] = await Promise.all([
        CronJob.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        CronJob.countDocuments(query)
      ]);

      return {
        success: true,
        data: jobs as ICronJob[],
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error: any) {
      this.logger.error('Failed to get jobs:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get a single job by ID
   */
  public async getJobById(
    jobId: string,
    orgId: string
  ): Promise<ICronJob | null> {
    try {
      const job = await CronJob.findOne({
        _id: new Types.ObjectId(jobId),
        orgId: new Types.ObjectId(orgId)
      }).lean();

      if (!job) {
        throw new Error('Job not found');
      }

      return job as ICronJob;
    } catch (error: any) {
      this.logger.error(`Failed to get job ${jobId}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Update a scheduled job
   */
  public async updateJob(
    jobId: string,
    orgId: string,
    updates: Partial<ICronJobRequest>
  ): Promise<ICronJob> {
    try {
      const job = await CronJob.findOne({
        _id: new Types.ObjectId(jobId),
        orgId: new Types.ObjectId(orgId)
      });

      if (!job) {
        throw new Error('Job not found');
      }

      // Prevent updating completed or failed jobs
      if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
        throw new Error(`Cannot update job with status: ${job.status}`);
      }

      // Update allowed fields
      if (updates.name) job.name = updates.name;
      if (updates.prompt) job.prompt = updates.prompt;
      if (updates.targetApi) job.targetApi = updates.targetApi;
      if (updates.headers) job.headers = updates.headers;
      if (updates.skillId !== undefined) job.skillId = updates.skillId;
      if (updates.metadata) job.metadata = { ...job.metadata, ...updates.metadata };

      // Update schedule if provided
      if (updates.scheduleType || updates.oneTime || updates.recurring) {
        // Validate new schedule
        const scheduleData = {
          ...updates,
          scheduleType: updates.scheduleType || job.scheduleType
        };
        this.timeCalculator.validateSchedule(scheduleData as ICronJobRequest);

        // Recalculate next run time
        const userTimezone = updates.timezone || job.userTimezone;
        const nextRunAt = this.timeCalculator.parseScheduleToUTC(
          scheduleData as ICronJobRequest,
          userTimezone
        );

        job.nextRunAt = nextRunAt;
        job.userTimezone = userTimezone;

        // Update schedule fields
        if (updates.scheduleType) {
          job.scheduleType = updates.scheduleType;
        }

        if (updates.oneTime && updates.scheduleType === 'once') {
          job.oneTime = { dateTime: nextRunAt };
        }

        if (updates.recurring && updates.scheduleType === 'recurring') {
          const cronExpression = this.timeCalculator.generateCronExpression(
            updates.recurring,
            userTimezone
          );

          job.recurring = {
            ...job.recurring,
            ...updates.recurring,
            cronExpression,
            startDate: new Date(updates.recurring.startDate),
            endDate: updates.recurring.endDate ? new Date(updates.recurring.endDate) : undefined
          };
        }

        // Note: Queue update will be done in Phase 4
        // await this.queueService.updateSchedule(job.jobUuid, job);
      }

      // Update configurations
      if (updates.rateLimitConfig) {
        job.rateLimitConfig = {
          ...job.rateLimitConfig,
          ...updates.rateLimitConfig
        };
      }

      if (updates.responseConfig) {
        job.responseConfig = {
          ...job.responseConfig,
          ...updates.responseConfig
        };
      }

      await job.save();

      this.logger.info(`Job updated: ${job.jobUuid}`, { jobId, updates });
      this.emitEvent(CRON_EVENTS.JOB_UPDATED, job);

      return job;

    } catch (error: any) {
      this.logger.error(`Failed to update job ${jobId}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Delete a scheduled job
   */
  public async deleteJob(
    jobId: string,
    orgId: string
  ): Promise<void> {
    try {
      const job = await CronJob.findOne({
        _id: new Types.ObjectId(jobId),
        orgId: new Types.ObjectId(orgId)
      });

      if (!job) {
        throw new Error('Job not found');
      }

      // Note: Queue cancellation will be done in Phase 4
      // await this.queueService.cancelJob(job.jobUuid);

      // Delete the job
      await job.deleteOne();

      // Optionally delete execution history
      if (CronSchedulerConfig.database.maintenance.cleanupEnabled) {
        await CronExecution.deleteMany({ jobId: job._id });
      }

      this.logger.info(`Job deleted: ${job.jobUuid}`, { jobId, orgId });
      this.emitEvent(CRON_EVENTS.JOB_DELETED, { jobId, jobUuid: job.jobUuid });

    } catch (error: any) {
      this.logger.error(`Failed to delete job ${jobId}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Pause an active job
   */
  public async pauseJob(
    jobId: string,
    orgId: string
  ): Promise<ICronJob> {
    try {
      const job = await CronJob.findOne({
        _id: new Types.ObjectId(jobId),
        orgId: new Types.ObjectId(orgId)
      });

      if (!job) {
        throw new Error('Job not found');
      }

      if (job.status !== JobStatus.ACTIVE) {
        throw new Error(`Cannot pause job with status: ${job.status}`);
      }

      // Update status
      job.status = JobStatus.PAUSED;
      await job.save();

      // Remove from queue (Phase 4 Integration)
      await this.queueService.cancelJob(job.jobUuid);

      this.logger.info(`Job paused: ${job.jobUuid}`, { jobId, orgId });
      this.emitEvent(CRON_EVENTS.JOB_PAUSED, job);

      return job;

    } catch (error: any) {
      this.logger.error(`Failed to pause job ${jobId}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Resume a paused job
   */
  public async resumeJob(
    jobId: string,
    orgId: string
  ): Promise<ICronJob> {
    try {
      const job = await CronJob.findOne({
        _id: new Types.ObjectId(jobId),
        orgId: new Types.ObjectId(orgId)
      });

      if (!job) {
        throw new Error('Job not found');
      }

      if (job.status !== JobStatus.PAUSED) {
        throw new Error(`Cannot resume job with status: ${job.status}`);
      }

      // Calculate new next run time
      if (job.scheduleType === 'recurring' && job.recurring) {
        // Verify required fields exist
        if (!job.recurring.startDate) {
          throw new Error('Recurring job missing startDate');
        }

        // Convert Date fields to string format
        // We've verified required fields above, using type assertion as workaround for TypeScript limitation
        const recurringSchedule = {
          frequency: job.recurring.frequency,
          time: job.recurring.time,
          startDate: job.recurring.startDate!.toISOString().split('T')[0],
          endDate: job.recurring.endDate ? job.recurring.endDate.toISOString().split('T')[0] : undefined,
          daysOfWeek: job.recurring.daysOfWeek,
          dayOfMonth: job.recurring.dayOfMonth,
          cronExpression: job.recurring.cronExpression
        } as any;
        job.nextRunAt = this.timeCalculator.calculateNextRun(
          recurringSchedule,
          job.userTimezone
        );
      } else if (job.oneTime) {
        // For one-time jobs, check if the time has passed
        if (job.oneTime.dateTime < new Date()) {
          throw new Error('Scheduled time has already passed');
        }
        job.nextRunAt = job.oneTime.dateTime;
      }

      // Update status
      job.status = JobStatus.ACTIVE;
      await job.save();

      // Re-schedule with BullMQ (Phase 4 Integration)
      await this.queueService.scheduleJob(job);

      this.logger.info(`Job resumed: ${job.jobUuid}`, { jobId, orgId });
      this.emitEvent(CRON_EVENTS.JOB_RESUMED, job);

      return job;

    } catch (error: any) {
      this.logger.error(`Failed to resume job ${jobId}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Get execution history for a job
   */
  public async getExecutionHistory(
    jobId: string,
    orgId: string,
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<IApiResponse<ICronExecution[]>> {
    try {
      // Verify job ownership
      const job = await CronJob.findOne({
        _id: new Types.ObjectId(jobId),
        orgId: new Types.ObjectId(orgId)
      });

      if (!job) {
        throw new Error('Job not found');
      }

      // Calculate pagination
      const page = Math.max(1, pagination.page);
      const limit = Math.min(Math.max(1, pagination.limit), 100);
      const skip = (page - 1) * limit;

      // Get executions
      const [executions, total] = await Promise.all([
        CronExecution.find({ jobId: job._id })
          .sort({ executedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CronExecution.countDocuments({ jobId: job._id })
      ]);

      return {
        success: true,
        data: executions as ICronExecution[],
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error: any) {
      this.logger.error(`Failed to get execution history for job ${jobId}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Get job history (alias for getExecutionHistory for backward compatibility)
   */
  public async getJobHistory(
    jobId: string,
    orgId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<IApiResponse<ICronExecution[]>> {
    return this.getExecutionHistory(jobId, orgId, { page, limit });
  }

  /**
   * Get job statistics for an organization
   */
  public async getJobStatistics(orgId: string): Promise<IJobStatistics> {
    try {
      const stats = await (CronJob as ICronJobModel).getStatistics(orgId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get execution statistics
      const executionStats = await (CronExecution as ICronExecutionModel).getExecutionStatistics(orgId);

      // Calculate success rate
      const successRate = executionStats.total > 0 ?
        (executionStats.success / executionStats.total) * 100 : 0;

      return {
        totalJobs: stats.total,
        activeJobs: stats.active,
        completedJobs: stats.completed,
        failedJobs: stats.failed,
        executionsToday: executionStats.executionsToday,
        successRate,
        averageExecutionTime: executionStats.avgDuration
      };

    } catch (error: any) {
      this.logger.error('Failed to get job statistics:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get next N run times for a job (preview)
   */
  public async getNextRunTimes(
    jobId: string,
    orgId: string,
    count: number = 5
  ): Promise<Date[]> {
    try {
      const job = await CronJob.findOne({
        _id: new Types.ObjectId(jobId),
        orgId: new Types.ObjectId(orgId)
      });

      if (!job) {
        throw new Error('Job not found');
      }

      if (job.scheduleType === 'once') {
        return job.oneTime && job.oneTime.dateTime > new Date() ?
          [job.oneTime.dateTime] : [];
      }

      if (job.scheduleType === 'recurring' && job.recurring) {
        // Verify required fields exist
        if (!job.recurring.startDate) {
          throw new Error('Recurring job missing startDate');
        }

        // Convert Date fields to string format
        // We've verified required fields above, using non-null assertion
        const recurringSchedule = {
          frequency: job.recurring.frequency,
          time: job.recurring.time,
          startDate: job.recurring.startDate!.toISOString().split('T')[0],
          endDate: job.recurring.endDate ? job.recurring.endDate.toISOString().split('T')[0] : undefined,
          daysOfWeek: job.recurring.daysOfWeek,
          dayOfMonth: job.recurring.dayOfMonth,
          cronExpression: job.recurring.cronExpression
        } as any;
        return this.timeCalculator.calculateNextNRuns(
          recurringSchedule,
          job.userTimezone,
          count
        );
      }

      return [];

    } catch (error: any) {
      this.logger.error(`Failed to get next run times for job ${jobId}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Retry a failed job
   */
  public async retryJob(
    jobId: string,
    orgId: string
  ): Promise<ICronJob> {
    try {
      const job = await CronJob.findOne({
        _id: new Types.ObjectId(jobId),
        orgId: new Types.ObjectId(orgId)
      });

      if (!job) {
        throw new Error('Job not found');
      }

      if (job.status !== JobStatus.FAILED) {
        throw new Error(`Can only retry failed jobs. Current status: ${job.status}`);
      }

      // Reset failure count and status
      job.consecutiveFailures = 0;
      job.status = JobStatus.ACTIVE;

      // Calculate next run time
      if (job.scheduleType === 'recurring' && job.recurring) {
        // Verify required fields exist
        if (!job.recurring.startDate) {
          throw new Error('Recurring job missing startDate');
        }

        // Convert Date fields to string format
        // We've verified required fields above, using type assertion as workaround for TypeScript limitation
        const recurringSchedule = {
          frequency: job.recurring.frequency,
          time: job.recurring.time,
          startDate: job.recurring.startDate!.toISOString().split('T')[0],
          endDate: job.recurring.endDate ? job.recurring.endDate.toISOString().split('T')[0] : undefined,
          daysOfWeek: job.recurring.daysOfWeek,
          dayOfMonth: job.recurring.dayOfMonth,
          cronExpression: job.recurring.cronExpression
        } as any;
        job.nextRunAt = this.timeCalculator.calculateNextRun(
          recurringSchedule,
          job.userTimezone
        );
      } else {
        // For one-time jobs, run immediately
        job.nextRunAt = new Date();
      }

      await job.save();

      // Re-schedule for retry (Phase 4 Integration)
      await this.queueService.scheduleJob(job);

      this.logger.info(`Job retry initiated: ${job.jobUuid}`, { jobId, orgId });
      this.emitEvent(CRON_EVENTS.JOB_RETRYING, job);

      return job;

    } catch (error: any) {
      this.logger.error(`Failed to retry job ${jobId}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Mark job as completed (called by worker)
   */
  public async markJobCompleted(jobId: string): Promise<void> {
    try {
      const job = await CronJob.findById(jobId);
      if (!job) return;

      if (job.scheduleType === 'once') {
        job.status = JobStatus.COMPLETED;
      } else if (job.scheduleType === 'recurring' && job.recurring) {
        // Verify required fields exist
        if (!job.recurring.startDate) {
          throw new Error('Recurring job missing startDate');
        }

        // Convert Date fields to string format
        // We've verified required fields above, using non-null assertion
        const recurringSchedule = {
          frequency: job.recurring.frequency,
          time: job.recurring.time,
          startDate: job.recurring.startDate!.toISOString().split('T')[0],
          endDate: job.recurring.endDate ? job.recurring.endDate.toISOString().split('T')[0] : undefined,
          daysOfWeek: job.recurring.daysOfWeek,
          dayOfMonth: job.recurring.dayOfMonth,
          cronExpression: job.recurring.cronExpression
        } as any;
        // Calculate next run
        job.nextRunAt = this.timeCalculator.calculateNextRun(
          recurringSchedule,
          job.userTimezone
        );

        // Check if job has reached end date
        if (job.recurring.endDate && job.nextRunAt > job.recurring.endDate) {
          job.status = JobStatus.COMPLETED;
        }
      }

      job.lastRunAt = new Date();
      job.executionCount += 1;
      job.consecutiveFailures = 0;

      await job.save();
      this.emitEvent(CRON_EVENTS.JOB_COMPLETED, job);

    } catch (error: any) {
      this.logger.error(`Failed to mark job ${jobId} as completed:`, error);
    }
  }

  /**
   * Mark job as failed (called by worker)
   */
  public async markJobFailed(jobId: string): Promise<void> {
    try {
      const job = await CronJob.findById(jobId);
      if (!job) return;

      job.consecutiveFailures += 1;

      // Mark as failed after max consecutive failures
      if (job.consecutiveFailures >= SCHEDULE_CONSTANTS.MAX_CONSECUTIVE_FAILURES) {
        job.status = JobStatus.FAILED;
        this.logger.error(`Job ${job.jobUuid} marked as failed after ${SCHEDULE_CONSTANTS.MAX_CONSECUTIVE_FAILURES} consecutive failures`);
      }

      await job.save();
      this.emitEvent(CRON_EVENTS.JOB_FAILED, job);

    } catch (error: any) {
      this.logger.error(`Failed to mark job ${jobId} as failed:`, error);
    }
  }

  /**
   * Check for duplicate jobs
   */
  private async checkForDuplicates(
    data: ICronJobRequest,
    orgId: string
  ): Promise<void> {
    // Check idempotency key
    if (data.idempotencyKey) {
      const existing = await (CronJob as ICronJobModel).findByIdempotencyKey(
        data.idempotencyKey,
        orgId
      );

      if (existing) {
        this.logger.info('Duplicate job prevented by idempotency key', {
          idempotencyKey: data.idempotencyKey,
          existingJobId: existing._id
        });
        throw new Error('Duplicate job detected (idempotency key)');
      }
    }

    // Check fingerprint
    if (CronSchedulerConfig.duplicatePrevention.checkFingerprint) {
      // Create a temporary job to generate fingerprint
      const tempJob = new CronJob({
        orgId: new Types.ObjectId(orgId),
        prompt: data.prompt,
        targetApi: data.targetApi,
        scheduleType: data.scheduleType,
        oneTime: data.oneTime,
        recurring: data.recurring
      } as any);

      // The pre-save hook will generate the fingerprint
      await tempJob.validate();

      const duplicate = await (CronJob as ICronJobModel).checkDuplicate(
        tempJob.jobFingerprint,
        CronSchedulerConfig.duplicatePrevention.timeWindowMinutes
      );

      if (duplicate) {
        this.logger.warn('Duplicate job detected within time window', {
          fingerprint: tempJob.jobFingerprint,
          existingJobId: duplicate._id
        });
        throw new Error(`Duplicate job detected. Please wait ${CronSchedulerConfig.duplicatePrevention.timeWindowMinutes} minutes before creating a similar job.`);
      }
    }
  }

  /**
   * Handle and format errors
   */
  private handleError(error: any): Error {
    if (error.name === 'ValidationError') {
      return new Error(`Validation failed: ${error.message}`);
    }

    if (error.name === 'CastError') {
      return new Error('Invalid ID format');
    }

    if (error.code === 11000) {
      return new Error('Duplicate job detected');
    }

    return error;
  }

  /**
   * Emit events for monitoring (placeholder for event emitter)
   */
  private emitEvent(event: string, data: any): void {
    // This would integrate with an event emitter for real-time monitoring
    // For now, just log the event
    this.logger.debug(`Event: ${event}`, { data });
  }
}