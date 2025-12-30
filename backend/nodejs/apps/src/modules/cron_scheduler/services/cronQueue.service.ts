/**
 * Cron Queue Service
 * Manages BullMQ queue for job scheduling with Redis failover support
 * Risk Mitigation: Redis Failure - Implements reconnection and monitoring
 */

import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { injectable, inject } from 'inversify';
import { CronSchedulerConfig } from '../config/cronScheduler.config';
import { ICronJob } from '../types/cronScheduler.types';
import { Logger } from '../../../libs/services/logger.service';

@injectable()
export class CronQueueService {
  private queue!: Queue;
  private queueEvents!: QueueEvents;
  private redisConnection!: IORedis;

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
    this.queueEvents.on('completed', ({ jobId }) => {
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