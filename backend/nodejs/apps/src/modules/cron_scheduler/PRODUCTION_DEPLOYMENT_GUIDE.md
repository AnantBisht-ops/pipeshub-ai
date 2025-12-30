# Production Deployment Guide - Cron Scheduler

## Overview
This guide provides step-by-step instructions for deploying the Cron Scheduler to production at `https://web.openanalyst.com`.

## Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Production MongoDB instance configured
- [ ] Production Redis instance configured
- [ ] SSL certificates installed
- [ ] Domain configured: `web.openanalyst.com`
- [ ] Load balancer configured (if using multiple instances)

### 2. Credentials & API Keys
- [ ] Get production API key from Deepak
- [ ] Generate secure JWT secrets (minimum 32 characters)
- [ ] Configure MongoDB connection string
- [ ] Configure Redis connection credentials
- [ ] Set up monitoring credentials (if applicable)

---

## Step-by-Step Deployment

### Step 1: Prepare Environment File

1. Copy the production environment template:
```bash
cp .env.production .env
```

2. Update critical values in `.env`:
```bash
# Production URLs
API_BASE_URL=https://web.openanalyst.com
SCHEDULER_BASE_URL=https://web.openanalyst.com/api/v1/cron

# Database (Replace with your MongoDB Atlas or production MongoDB)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pipeshub?retryWrites=true&w=majority

# Redis (Replace with your production Redis endpoint)
REDIS_HOST=your-redis-endpoint.cache.amazonaws.com
REDIS_PASSWORD=your-secure-redis-password

# Deepak's API Credentials (Get from Deepak)
OPENANALYST_API_KEY=YOUR_PRODUCTION_API_KEY
OPENANALYST_USER_ID=YOUR_PRODUCTION_USER_ID

# Security (Generate secure random strings)
JWT_SECRET=<generate-32-char-random-string>
JWT_REFRESH_SECRET=<generate-another-32-char-random-string>
INTERNAL_API_KEY=<generate-secure-api-key>

# CORS (Restrict to your domains)
CORS_ORIGIN=https://app.openanalyst.com,https://web.openanalyst.com
```

### Step 2: Generate Secure Secrets

Generate secure random strings for JWT secrets:
```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate INTERNAL_API_KEY
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

### Step 3: Install Dependencies

```bash
cd backend/nodejs/apps
npm install --production
```

### Step 4: Build TypeScript

```bash
npm run build
```

### Step 5: Run Database Migrations

```bash
# Run migrations to create indexes and initial data
npm run migrate:up
```

### Step 6: Configure PM2 for Production

Create PM2 ecosystem file:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'cron-scheduler',
      script: './dist/app.js',
      instances: process.env.PM2_INSTANCES || 4,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/cron-scheduler/error.log',
      out_file: '/var/log/cron-scheduler/out.log',
      log_file: '/var/log/cron-scheduler/combined.log',
      time: true,
      merge_logs: true,
      autorestart: true,
      watch: false
    },
    {
      name: 'cron-worker',
      script: './dist/workers/cronWorker.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/cron-worker/error.log',
      out_file: '/var/log/cron-worker/out.log',
      time: true,
      autorestart: true
    }
  ]
};
```

### Step 7: Start Services with PM2

```bash
# Start all services
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

### Step 8: Configure Nginx (Reverse Proxy)

```nginx
# /etc/nginx/sites-available/openanalyst
server {
    listen 443 ssl http2;
    server_name web.openanalyst.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/openanalyst.crt;
    ssl_certificate_key /etc/ssl/private/openanalyst.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Logging
    access_log /var/log/nginx/openanalyst-access.log;
    error_log /var/log/nginx/openanalyst-error.log;

    # API Routes
    location /api/v1/cron {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Body size (for large prompts)
        client_max_body_size 10M;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/api/v1/cron/health;
        access_log off;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name web.openanalyst.com;
    return 301 https://$server_name$request_uri;
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/openanalyst /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Step 9: Setup Monitoring

#### 9.1 Health Check Script
```bash
#!/bin/bash
# /usr/local/bin/cron-scheduler-health.sh

HEALTH_URL="https://web.openanalyst.com/api/v1/cron/health"
ALERT_EMAIL="devops@openanalyst.com"

response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $response -ne 200 ]; then
    echo "Cron Scheduler health check failed with status $response" | \
    mail -s "ALERT: Cron Scheduler Health Check Failed" $ALERT_EMAIL
fi
```

#### 9.2 Add to Crontab
```bash
# Check health every 5 minutes
*/5 * * * * /usr/local/bin/cron-scheduler-health.sh
```

### Step 10: Setup Log Rotation

Create logrotate configuration:
```bash
# /etc/logrotate.d/cron-scheduler
/var/log/cron-scheduler/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}

/var/log/cron-worker/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## Post-Deployment Verification

### 1. Test Health Endpoint
```bash
curl https://web.openanalyst.com/api/v1/cron/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "redis": "connected",
    "queue": "active",
    "worker": "running"
  }
}
```

### 2. Test Authentication with Deepak's API
```bash
# Get Bearer token
curl -X POST "https://api.openanalyst.com:3456/api/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"userId": "YOUR_USER_ID", "apiKey": "YOUR_API_KEY"}'
```

### 3. Create Test Job
```bash
curl -X POST "https://web.openanalyst.com/api/v1/cron/schedule" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Test Job",
    "prompt": "Test prompt",
    "targetApi": "https://api.openanalyst.com:3456/api/agent/run",
    "scheduleType": "once",
    "timezone": "UTC",
    "oneTime": {
      "date": "2025-01-27",
      "time": "12:00"
    },
    "metadata": {
      "conversationId": "test_conv",
      "sessionId": "test_sess",
      "chatboxId": "test_chat"
    },
    "headers": {
      "Authorization": "Bearer YOUR_TOKEN_HERE"
    }
  }'
```

### 4. Monitor PM2 Processes
```bash
# Check process status
pm2 status

# Monitor in real-time
pm2 monit

# Check logs
pm2 logs cron-scheduler
pm2 logs cron-worker
```

### 5. Check Redis Queue
```bash
redis-cli
> INFO keyspace
> KEYS bull:cron-jobs:*
```

---

## Troubleshooting

### Issue: 502 Bad Gateway
**Solution**: Check if Node.js app is running
```bash
pm2 status
pm2 restart cron-scheduler
```

### Issue: Database Connection Failed
**Solution**: Verify MongoDB connection string and network access
```bash
# Test MongoDB connection
npm run test:db
```

### Issue: Redis Connection Failed
**Solution**: Check Redis credentials and network
```bash
# Test Redis connection
redis-cli -h your-redis-host -p 6379 -a your-password ping
```

### Issue: Jobs Not Executing
**Solution**: Check worker status
```bash
pm2 logs cron-worker
pm2 restart cron-worker
```

---

## Rollback Procedure

If deployment fails:

1. **Keep previous version backup**:
```bash
cp -r /app/cron-scheduler /app/cron-scheduler.backup
```

2. **Quick rollback**:
```bash
# Stop current services
pm2 stop all

# Restore backup
rm -rf /app/cron-scheduler
mv /app/cron-scheduler.backup /app/cron-scheduler

# Restart services
pm2 restart all
```

---

## Security Checklist

- [ ] All secrets are environment variables (not hardcoded)
- [ ] JWT secrets are at least 32 characters
- [ ] MongoDB has authentication enabled
- [ ] Redis has password protection
- [ ] SSL certificates are valid and not expired
- [ ] CORS is restricted to your domains only
- [ ] Rate limiting is enabled
- [ ] Logs don't contain sensitive information
- [ ] File permissions are correctly set (644 for files, 755 for directories)
- [ ] Firewall rules configured (only allow required ports)

---

## Performance Optimization

### 1. Enable Redis Persistence
```bash
# In redis.conf
save 900 1
save 300 10
save 60 10000
appendonly yes
```

### 2. MongoDB Indexes
Ensure these indexes exist:
```javascript
// Run in MongoDB shell
db.cronjobs.createIndex({ orgId: 1, status: 1 });
db.cronjobs.createIndex({ nextRunAt: 1, status: 1 });
db.cronjobs.createIndex({ jobUuid: 1 }, { unique: true });
db.cronexecutions.createIndex({ jobId: 1, executedAt: -1 });
```

### 3. Node.js Memory Settings
```bash
# In PM2 config or .env
NODE_OPTIONS=--max-old-space-size=4096
```

---

## Monitoring Dashboard URLs

After deployment, access:
- Health Check: `https://web.openanalyst.com/api/v1/cron/health`
- API Docs: `https://web.openanalyst.com/api/v1/cron/docs`
- Metrics (if enabled): `https://web.openanalyst.com/api/v1/cron/metrics`

---

## Contact Information

- **Rishabh**: Backend/Deployment issues
- **Deepak**: OpenAnalyst API issues
- **Harsh**: Frontend integration
- **Aayush**: Chatbox/UI issues

---

## Important Notes

1. **Never commit `.env` files to version control**
2. **Always test in staging before production deployment**
3. **Keep backups before major updates**
4. **Monitor logs for the first 24 hours after deployment**
5. **Document any custom changes or configurations**

---

*Last Updated: January 2025*
*Version: 1.0.0*