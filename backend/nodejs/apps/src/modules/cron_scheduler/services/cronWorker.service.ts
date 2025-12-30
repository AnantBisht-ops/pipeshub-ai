/**
 * Cron Worker Service
 * Processes scheduled jobs with comprehensive error handling and risk mitigation
 * Implements all 10 steps of job execution pipeline
 */

import { Worker, Job } from 'bullmq';
import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import IORedis from 'ioredis';
import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { CronSchedulerConfig } from '../config/cronScheduler.config';
import { RateLimiterService } from './rateLimiter.service';
import { ResponseCompressorService } from './responseCompressor.service';
import { TimeCalculatorService } from './timeCalculator.service';
import { CronJob } from '../schema/cronJob.schema';
import { CronExecution } from '../schema/cronExecution.schema';
import { Logger } from '../../../libs/services/logger.service';

@injectable()
export class CronWorkerService {
  private worker!: Worker;

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
      // Extract values from stored config with defaults for missing fields
      const rateLimitConfig = {
        maxRequestsPerMinute: cronJob.rateLimitConfig.maxRequestsPerMinute || 60,
        backoffMultiplier: (cronJob.rateLimitConfig as any).backoffMultiplier || 2,
        maxBackoff: (cronJob.rateLimitConfig as any).maxBackoff || 32000
      };
      const canProceed = await this.rateLimiter.canMakeRequest(
        cronJob.targetApi,
        rateLimitConfig
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

      // 5. Make HTTP request with context
      this.logger.info(`Executing job ${jobUuid} to ${cronJob.targetApi}`);

      // Build request payload for Deepak's OpenAnalyst API
      const requestPayload = {
        prompt: cronJob.prompt,
        // Use projectId from metadata (provided by Harsh)
        projectId: cronJob.metadata?.deepakProjectId || cronJob.metadata?.projectId,
        // Include model if specified
        model: cronJob.metadata?.model || "claude-3-5-sonnet-20241022",
        // Pass context so the execution endpoint knows where to send response
        context: {
          jobId: cronJob._id.toString(),
          jobUuid: cronJob.jobUuid,
          userId: cronJob.createdBy.toString(),
          orgId: cronJob.orgId.toString(),
          skillId: cronJob.skillId,
          isScheduledExecution: true,
          timezone: cronJob.userTimezone,
          conversationId: cronJob.metadata?.conversationId,
          sessionId: cronJob.metadata?.sessionId,
          chatboxId: cronJob.metadata?.chatboxId,
          userEmail: cronJob.metadata?.userEmail,
          userName: cronJob.metadata?.userName
        }
      };

      const response = await httpClient.post(
        cronJob.targetApi,
        requestPayload,
        {
          headers: {
            ...cronJob.headers || {},
            'X-Cron-Job-Id': cronJob.jobUuid,
            'X-Original-User': cronJob.createdBy.toString(),
            'X-Skill-Id': cronJob.skillId || '',
            'X-Source': 'cron-scheduler'
          }
        }
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
        dataSize: compressed.compressedSize,
        isCompressed: compressed.isCompressed,
        isTruncated: compressed.compressedSize >= cronJob.responseConfig.maxSizeBytes
      };

      await execution.save();

      // 8. Update rate limiter
      this.rateLimiter.recordRequest(cronJob.targetApi, response.headers as any);

      // 9. Update job status
      cronJob.lastRunAt = new Date();
      cronJob.executionCount += 1;
      cronJob.consecutiveFailures = 0;  // Reset on success

      // 10. Calculate next run for recurring jobs
      if (cronJob.scheduleType === 'recurring' && cronJob.recurring) {
        const recurring = cronJob.recurring;

        // Type guard: ensure we have all required fields
        if (!recurring.startDate || !recurring.frequency || !recurring.time) {
          this.logger.error(`Recurring job missing required fields: ${jobUuid}`);
          cronJob.status = 'failed';
          await cronJob.save();
          return;
        }

        // MongoDB sometimes returns dates as strings, ensure we have Date objects
        // and convert them to string format for the time calculator
        const startDate = new Date(recurring.startDate);
        const endDate = recurring.endDate ? new Date(recurring.endDate) : null;

        // Create date strings in YYYY-MM-DD format
        // Using explicit type assertion to ensure TypeScript knows these are strings
        const startDateStr: string = startDate.toISOString().split('T')[0]!; // Non-null assertion
        const endDateStr: string | undefined = endDate
          ? endDate.toISOString().split('T')[0]
          : undefined;

        // Build recurring config with properly typed values
        // Use type assertion to satisfy IRecurringSchedule interface
        const recurringConfig: {
          frequency: 'daily' | 'weekly' | 'monthly';
          time: string;
          startDate: string;
          endDate?: string;
          daysOfWeek?: number[];
          dayOfMonth?: number;
        } = {
          frequency: String(recurring.frequency) as ('daily' | 'weekly' | 'monthly'),
          time: String(recurring.time),
          startDate: startDateStr, // Now TypeScript knows this is definitely a string
          endDate: endDateStr,
          daysOfWeek: recurring.daysOfWeek,
          dayOfMonth: recurring.dayOfMonth
        };

        cronJob.nextRunAt = this.timeCalculator.calculateNextRun(
          recurringConfig,
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