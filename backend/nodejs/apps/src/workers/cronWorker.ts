/**
 * Standalone Cron Worker Process
 * This file starts the cron worker as a separate process
 * Can be run with PM2 for automatic restart and scaling
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { Logger } from '../libs/services/logger.service';
import { CronWorkerService } from '../modules/cron_scheduler/services/cronWorker.service';
import { RateLimiterService } from '../modules/cron_scheduler/services/rateLimiter.service';
import { ResponseCompressorService } from '../modules/cron_scheduler/services/responseCompressor.service';
import { TimeCalculatorService } from '../modules/cron_scheduler/services/timeCalculator.service';
import mongoose from 'mongoose';

const logger = new Logger({ service: 'cron-worker-process' });

async function startWorker(): Promise<void> {
  try {
    logger.info('Starting Cron Worker Process');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cronscheduler';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Create dependency injection container
    const container = new Container();

    // Bind dependencies
    container.bind<Logger>('Logger').toConstantValue(logger);

    container.bind<TimeCalculatorService>('TimeCalculatorService')
      .to(TimeCalculatorService).inSingletonScope();

    container.bind<RateLimiterService>('RateLimiterService')
      .to(RateLimiterService).inSingletonScope();

    container.bind<ResponseCompressorService>('ResponseCompressorService')
      .to(ResponseCompressorService).inSingletonScope();

    container.bind<CronWorkerService>('CronWorkerService')
      .to(CronWorkerService).inSingletonScope();

    // Start the worker - service starts automatically on instantiation
    container.get<CronWorkerService>('CronWorkerService');
    logger.info('Cron Worker started successfully');

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await mongoose.connection.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await mongoose.connection.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start Cron Worker', error);
    process.exit(1);
  }
}

// Start the worker
startWorker().catch(error => {
  logger.error('Unhandled error in worker startup', error);
  process.exit(1);
});