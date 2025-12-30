/**
 * Migration: Add Cron Scheduler Collections and Indexes
 * This migration creates the necessary collections and indexes for the cron scheduler module
 * Includes all indexes required for performance optimization and risk mitigation
 */

module.exports = {
  async up(db, client) {
    console.log('Starting cron scheduler migration...');

    try {
      // 1. Create cronjobs collection
      console.log('Creating cronjobs collection...');
      await db.createCollection('cronjobs');

      // 2. Create cronexecutions collection
      console.log('Creating cronexecutions collection...');
      await db.createCollection('cronexecutions');

      // 3. Create indexes for cronjobs collection
      console.log('Creating indexes for cronjobs collection...');
      const cronJobsCollection = db.collection('cronjobs');

      // Unique index for job UUID (Risk Mitigation: Job Duplication)
      await cronJobsCollection.createIndex(
        { jobUuid: 1 },
        {
          unique: true,
          name: 'jobUuid_unique'
        }
      );

      // Compound index for main scheduler query
      await cronJobsCollection.createIndex(
        { orgId: 1, status: 1, nextRunAt: 1 },
        {
          name: 'scheduler_query_index'
        }
      );

      // Index for duplicate detection (Risk Mitigation: Job Duplication)
      await cronJobsCollection.createIndex(
        { jobFingerprint: 1, createdAt: -1 },
        {
          name: 'duplicate_detection_index'
        }
      );

      // Partial index for active jobs (Performance optimization)
      await cronJobsCollection.createIndex(
        { nextRunAt: 1, status: 1 },
        {
          name: 'active_jobs_index',
          partialFilterExpression: {
            status: { $in: ['active'] }
          }
        }
      );

      // Job lookup index
      await cronJobsCollection.createIndex(
        { jobUuid: 1, orgId: 1 },
        {
          name: 'job_lookup_index'
        }
      );

      // Organization jobs listing index
      await cronJobsCollection.createIndex(
        { orgId: 1, createdAt: -1 },
        {
          name: 'org_jobs_listing_index'
        }
      );

      // Status filtering index
      await cronJobsCollection.createIndex(
        { status: 1 },
        {
          name: 'status_index'
        }
      );

      // Schedule type index
      await cronJobsCollection.createIndex(
        { scheduleType: 1 },
        {
          name: 'schedule_type_index'
        }
      );

      // Project-based queries index
      await cronJobsCollection.createIndex(
        { projectId: 1, status: 1 },
        {
          name: 'project_jobs_index',
          sparse: true
        }
      );

      // Idempotency key index (Risk Mitigation: Job Duplication)
      await cronJobsCollection.createIndex(
        { idempotencyKey: 1, orgId: 1 },
        {
          name: 'idempotency_key_index',
          sparse: true
        }
      );

      // Last run time index for monitoring
      await cronJobsCollection.createIndex(
        { lastRunAt: -1 },
        {
          name: 'last_run_index',
          sparse: true
        }
      );

      // Recurring jobs cron expression index
      await cronJobsCollection.createIndex(
        { 'recurring.cronExpression': 1 },
        {
          name: 'cron_expression_index',
          sparse: true
        }
      );

      // Created by user index
      await cronJobsCollection.createIndex(
        { createdBy: 1 },
        {
          name: 'created_by_index'
        }
      );

      // 4. Create indexes for cronexecutions collection
      console.log('Creating indexes for cronexecutions collection...');
      const cronExecutionsCollection = db.collection('cronexecutions');

      // Unique index for execution UUID
      await cronExecutionsCollection.createIndex(
        { executionUuid: 1 },
        {
          unique: true,
          name: 'executionUuid_unique'
        }
      );

      // Main query index for execution history
      await cronExecutionsCollection.createIndex(
        { jobId: 1, executedAt: -1 },
        {
          name: 'execution_history_index'
        }
      );

      // Organization-based queries
      await cronExecutionsCollection.createIndex(
        { orgId: 1, status: 1, executedAt: -1 },
        {
          name: 'org_executions_index'
        }
      );

      // Job UUID lookup
      await cronExecutionsCollection.createIndex(
        { jobUuid: 1, executedAt: -1 },
        {
          name: 'job_uuid_executions_index'
        }
      );

      // Status aggregation index
      await cronExecutionsCollection.createIndex(
        { status: 1, executedAt: -1 },
        {
          name: 'status_aggregation_index'
        }
      );

      // Performance monitoring index
      await cronExecutionsCollection.createIndex(
        { duration: 1, status: 1 },
        {
          name: 'performance_monitoring_index'
        }
      );

      // TTL Index - Auto-delete old executions after 30 days (Risk Mitigation: Storage Management)
      await cronExecutionsCollection.createIndex(
        { createdAt: 1 },
        {
          expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
          name: 'execution_ttl_index'
        }
      );

      // Rate limit tracking index (Risk Mitigation: API Rate Limits)
      await cronExecutionsCollection.createIndex(
        { 'rateLimitInfo.reset': 1 },
        {
          name: 'rate_limit_tracking_index',
          sparse: true
        }
      );

      // Error tracking index
      await cronExecutionsCollection.createIndex(
        { 'error.retryable': 1, status: 1 },
        {
          name: 'error_tracking_index',
          sparse: true
        }
      );

      // Response size tracking index (Risk Mitigation: Large Responses)
      await cronExecutionsCollection.createIndex(
        { 'response.dataSize': 1 },
        {
          name: 'response_size_index',
          sparse: true
        }
      );

      // Scheduled time index for SLA monitoring
      await cronExecutionsCollection.createIndex(
        { scheduledFor: 1 },
        {
          name: 'scheduled_time_index'
        }
      );

      // Attempts tracking for retry analysis
      await cronExecutionsCollection.createIndex(
        { attempts: 1, status: 1 },
        {
          name: 'attempts_tracking_index'
        }
      );

      // 5. Create text indexes for search functionality
      console.log('Creating text indexes for search...');

      // Text index on job names and prompts for search
      await cronJobsCollection.createIndex(
        {
          name: 'text',
          prompt: 'text'
        },
        {
          name: 'job_search_index',
          weights: {
            name: 10,
            prompt: 5
          }
        }
      );

      // 6. Add migration tracking record
      console.log('Recording migration completion...');
      await db.collection('migrations_changelog').insertOne({
        name: '004_add_cron_scheduler',
        executedAt: new Date(),
        success: true,
        collections: ['cronjobs', 'cronexecutions'],
        indexesCreated: {
          cronjobs: 14,
          cronexecutions: 12
        }
      });

      console.log('Cron scheduler migration completed successfully!');
      console.log('Created 2 collections with 26 indexes total');

    } catch (error) {
      console.error('Error during cron scheduler migration:', error);
      throw error;
    }
  },

  async down(db, client) {
    console.log('Rolling back cron scheduler migration...');

    try {
      // Drop collections
      console.log('Dropping cronjobs collection...');
      await db.collection('cronjobs').drop();

      console.log('Dropping cronexecutions collection...');
      await db.collection('cronexecutions').drop();

      // Remove migration record
      await db.collection('migrations_changelog').deleteOne({
        name: '004_add_cron_scheduler'
      });

      console.log('Cron scheduler migration rolled back successfully');

    } catch (error) {
      // Collections might not exist if migration failed halfway
      if (error.code === 26) { // NamespaceNotFound
        console.log('Collections already dropped');
      } else {
        console.error('Error during rollback:', error);
        throw error;
      }
    }
  }
};