/**
 * PM2 Configuration for Cron Scheduler Worker
 * This configuration ensures worker auto-restart and proper process management
 * Risk Mitigation: Worker Crash - Auto-restart with PM2
 */

module.exports = {
  apps: [{
    name: 'cron-worker',
    script: './dist/workers/cronWorker.js',
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    error_file: './logs/cron-worker-error.log',
    out_file: './logs/cron-worker-out.log',
    merge_logs: true,
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    env: {
      NODE_ENV: 'production'
    }
  }]
};