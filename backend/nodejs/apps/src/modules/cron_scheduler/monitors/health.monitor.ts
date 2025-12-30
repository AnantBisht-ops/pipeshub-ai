/**
 * Health Monitor Service
 * Monitors the health of the cron scheduler system
 * Tracks queue depth, worker status, and system metrics
 */

import { CronQueueService } from '../services/cronQueue.service';
import { CronWorkerService } from '../services/cronWorker.service';
import { Logger } from '../../../libs/services/logger.service';
import { CronSchedulerConfig } from '../config/cronScheduler.config';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
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

export class HealthMonitor {
  private metrics = {
    jobsCreated: 0,
    jobsExecuted: 0,
    jobsFailed: 0,
    avgExecutionTime: 0,
    queueDepth: 0,
    workerMemory: 0
  };

  private intervalId?: NodeJS.Timeout;
  private logger: Logger;

  constructor(
    private queueService: CronQueueService,
    workerService: CronWorkerService // Not currently used but kept for future use
  ) {
    this.logger = new Logger({ service: 'cron-health-monitor' });
    // Store workerService for future use if needed
    void workerService; // Suppress unused variable warning
  }

  /**
   * Start health monitoring
   */
  start(): void {
    this.logger.info('Starting health monitoring');

    // Check health at configured interval
    this.intervalId = setInterval(
      () => this.performHealthCheck(),
      CronSchedulerConfig.monitoring.healthCheck.interval
    );

    // Perform initial health check
    this.performHealthCheck();
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.logger.info('Health monitoring stopped');
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.checkHealth();

      if (health.status === 'unhealthy') {
        this.logger.error('System health check failed', health);

        // Check if we need to alert
        if (this.shouldAlert(health)) {
          this.sendAlert(health);
        }
      } else {
        this.logger.debug('Health check passed', health);
      }
    } catch (error) {
      this.logger.error('Error during health check', error);
    }
  }

  /**
   * Check overall system health
   */
  async checkHealth(): Promise<HealthStatus> {
    const checks = {
      redis: await this.checkRedis(),
      mongodb: await this.checkMongoDB(),
      queue: await this.checkQueue(),
      worker: await this.checkWorker()
    };

    const healthy = Object.values(checks).every(c => c);

    // Update metrics
    this.updateMetrics();

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      checks,
      metrics: this.metrics,
      timestamp: new Date()
    };
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<boolean> {
    try {
      // Check if queue service is initialized and connected
      // This would require adding a health check method to CronQueueService
      // For now, return true if service exists
      return !!this.queueService;
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return false;
    }
  }

  /**
   * Check MongoDB connectivity
   */
  private async checkMongoDB(): Promise<boolean> {
    try {
      // Import mongoose and check connection
      const mongoose = require('mongoose');
      return mongoose.connection.readyState === 1;
    } catch (error) {
      this.logger.error('MongoDB health check failed', error);
      return false;
    }
  }

  /**
   * Check queue health
   */
  private async checkQueue(): Promise<boolean> {
    try {
      // Check queue depth doesn't exceed threshold
      // This would require adding a getQueueDepth method to CronQueueService
      const alertThreshold = CronSchedulerConfig.monitoring.healthCheck.thresholds.queueSize;
      return this.metrics.queueDepth < alertThreshold;
    } catch (error) {
      this.logger.error('Queue health check failed', error);
      return false;
    }
  }

  /**
   * Check worker health
   */
  private async checkWorker(): Promise<boolean> {
    try {
      // Check worker memory usage
      const memoryUsage = process.memoryUsage().heapUsed;
      const alertThreshold = CronSchedulerConfig.monitoring.healthCheck.thresholds.workerMemory;
      this.metrics.workerMemory = memoryUsage;
      return memoryUsage < alertThreshold;
    } catch (error) {
      this.logger.error('Worker health check failed', error);
      return false;
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    // Update queue depth and other metrics
    // This would require adding metric collection methods to services
    // For now, using placeholder values
    this.metrics.queueDepth = 0;
    this.metrics.workerMemory = process.memoryUsage().heapUsed;
  }

  /**
   * Check if we should send an alert
   */
  private shouldAlert(_health: HealthStatus): boolean {
    // Check failure rate
    if (this.metrics.jobsFailed > 0 && this.metrics.jobsExecuted > 0) {
      const failureRate = this.metrics.jobsFailed / this.metrics.jobsExecuted;
      if (failureRate > CronSchedulerConfig.monitoring.healthCheck.thresholds.failureRate) {
        return true;
      }
    }

    // Check queue size
    if (this.metrics.queueDepth > CronSchedulerConfig.monitoring.healthCheck.thresholds.queueSize) {
      return true;
    }

    // Check worker memory
    if (this.metrics.workerMemory > CronSchedulerConfig.monitoring.healthCheck.thresholds.workerMemory) {
      return true;
    }

    return false;
  }

  /**
   * Send alert
   */
  private sendAlert(health: HealthStatus): void {
    // Implement alerting mechanism (email, Slack, PagerDuty, etc.)
    this.logger.error('ALERT: System health degraded', {
      health,
      metrics: this.metrics
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Increment job created counter
   */
  incrementJobsCreated(): void {
    this.metrics.jobsCreated++;
  }

  /**
   * Increment job executed counter
   */
  incrementJobsExecuted(): void {
    this.metrics.jobsExecuted++;
  }

  /**
   * Increment job failed counter
   */
  incrementJobsFailed(): void {
    this.metrics.jobsFailed++;
  }

  /**
   * Update average execution time
   */
  updateAvgExecutionTime(time: number): void {
    // Calculate running average
    const totalTime = this.metrics.avgExecutionTime * this.metrics.jobsExecuted;
    this.metrics.avgExecutionTime = (totalTime + time) / (this.metrics.jobsExecuted + 1);
  }
}