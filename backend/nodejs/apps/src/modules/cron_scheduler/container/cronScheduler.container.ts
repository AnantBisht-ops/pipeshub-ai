/**
 * Cron Scheduler Container
 * Dependency injection container setup for the cron scheduler module
 * Binds all services and controllers for the module
 */

import { Container } from 'inversify';
import { Logger } from '../../../libs/services/logger.service';
import { TimeCalculatorService } from '../services/timeCalculator.service';
import { RateLimiterService } from '../services/rateLimiter.service';
import { ResponseCompressorService } from '../services/responseCompressor.service';
import { CronQueueService } from '../services/cronQueue.service';
import { CronWorkerService } from '../services/cronWorker.service';
import { CronSchedulerService } from '../services/cronScheduler.service';
import { CronSchedulerController } from '../controllers/cronScheduler.controller';
import { CronSchedulerConfig } from '../config/cronScheduler.config';
import { HealthMonitor } from '../monitors/health.monitor';

export interface AppConfig {
  // Add any app configuration properties needed
  environment?: string;
  port?: number;
  [key: string]: any;
}

export class CronSchedulerContainer {
  private static container: Container;

  static async initialize(config: AppConfig): Promise<Container> {
    const container = new Container();

    // Bind configuration
    container.bind<AppConfig>('AppConfig').toConstantValue(config);
    container.bind<Logger>('Logger').toConstantValue(new Logger({ service: 'cron-scheduler' }));

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

  /**
   * Dispose of the container and cleanup resources
   */
  static async dispose(): Promise<void> {
    // Cleanup any resources if needed
    console.log('CronScheduler container disposed');
  }
}