/**
 * Cron Scheduler Module
 * Main export file for the cron scheduler module
 */

// Export types and interfaces
export * from './types/cronScheduler.types';

// Export schemas
export { CronJob } from './schema/cronJob.schema';
export { CronExecution } from './schema/cronExecution.schema';

// Export configuration
export { CronSchedulerConfig, validateConfig } from './config/cronScheduler.config';

// Export constants
export * from './constants/cronScheduler.constants';

// Note: Services, controllers, and other components will be exported after implementation in Phase 2+

/**
 * Module metadata
 */
export const MODULE_INFO = {
  name: 'cron_scheduler',
  version: '1.0.0',
  description: 'Production-ready cron job scheduler with MongoDB persistence and BullMQ processing',
  author: 'PipesHub AI',
  features: [
    'One-time and recurring job scheduling',
    'Multi-tenancy support',
    'Rate limiting protection',
    'Large response handling',
    'Automatic timezone conversion to UTC',
    'Duplicate job prevention',
    'Comprehensive error handling',
    'Health monitoring and metrics',
    'Auto-cleanup of old executions',
    'Redis failover support',
    'Worker crash recovery'
  ],
  riskMitigations: [
    'Redis Sentinel/Cluster support',
    'PM2 auto-restart for workers',
    'API rate limiting with exponential backoff',
    'Response size limits and compression',
    'UTC storage for all timestamps',
    'UUID and fingerprint-based duplicate prevention'
  ]
};