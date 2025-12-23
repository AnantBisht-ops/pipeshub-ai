# Multi-Tenancy Rollback Procedures

## Emergency Rollback Guide

### Quick Reference
**Rollback Time:** 15-30 minutes
**Data Loss Risk:** None (with proper backup)
**Downtime:** 5-10 minutes

---

## Table of Contents
1. [When to Rollback](#when-to-rollback)
2. [Pre-Rollback Checklist](#pre-rollback-checklist)
3. [Rollback Procedures](#rollback-procedures)
4. [Post-Rollback Verification](#post-rollback-verification)
5. [Root Cause Analysis](#root-cause-analysis)

---

## When to Rollback

### Critical Issues Requiring Immediate Rollback
- ❌ **Data Loss**: Users cannot access existing data
- ❌ **Authentication Failure**: Users cannot log in (>10% affected)
- ❌ **Cross-Organization Data Leak**: Security boundary breach
- ❌ **Database Corruption**: Data integrity compromised
- ❌ **Complete Service Outage**: All API endpoints failing

### Issues That May Not Require Rollback
- ⚠️ Performance degradation (<20%)
- ⚠️ UI glitches (non-functional)
- ⚠️ Cache-related issues
- ⚠️ Individual feature failures

---

## Pre-Rollback Checklist

### 1. Assess the Situation (2 minutes)
```bash
# Check service status
./scripts/health-check.sh production

# Check error rates
curl -s $PROMETHEUS_URL/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])

# Check active users
redis-cli GET active_users_count

# Check database status
mongosh --eval "db.serverStatus()" | grep ok
```

### 2. Notify Stakeholders (1 minute)
- [ ] Alert on-call team
- [ ] Update status page
- [ ] Notify key customers (if critical)
- [ ] Post in #incidents Slack channel

### 3. Capture Current State (2 minutes)
```bash
# Save current logs
docker logs backend > /tmp/backend-logs-$(date +%Y%m%d-%H%M%S).log
docker logs frontend > /tmp/frontend-logs-$(date +%Y%m%d-%H%M%S).log

# Capture metrics snapshot
curl -s $PROMETHEUS_URL/api/v1/query_range?query=up > /tmp/metrics-$(date +%Y%m%d-%H%M%S).json

# Document issue
echo "Issue: [Description]" > /tmp/incident-$(date +%Y%m%d-%H%M%S).txt
echo "Time: $(date)" >> /tmp/incident-$(date +%Y%m%d-%H%M%S).txt
echo "Affected Services: [List]" >> /tmp/incident-$(date +%Y%m%d-%H%M%S).txt
```

---

## Rollback Procedures

### Option 1: Automated Rollback (Recommended)

#### For Kubernetes Deployment
```bash
#!/bin/bash
# Quick rollback script

echo "🔄 Starting automated rollback..."

# 1. Rollback deployments
kubectl rollout undo deployment/backend -n production
kubectl rollout undo deployment/frontend -n production

# 2. Wait for rollout to complete
kubectl rollout status deployment/backend -n production --timeout=300s
kubectl rollout status deployment/frontend -n production --timeout=300s

# 3. Verify pods are running
kubectl get pods -n production

# 4. Clear Redis cache
redis-cli FLUSHDB

echo "✅ Rollback completed"
```

#### For Docker Deployment
```bash
#!/bin/bash

# 1. Stop current containers
docker-compose -f docker-compose.prod.yml down

# 2. Pull previous version
docker pull pipeshub/backend:v1.9.0
docker pull pipeshub/frontend:v1.9.0

# 3. Update docker-compose to use previous version
sed -i 's/:multi-tenant/:v1.9.0/g' docker-compose.prod.yml

# 4. Start services with previous version
docker-compose -f docker-compose.prod.yml up -d

# 5. Clear cache
docker exec redis redis-cli FLUSHDB
```

### Option 2: Database Rollback

⚠️ **WARNING**: This will revert all data changes since backup

```bash
#!/bin/bash

# 1. Stop application services
docker-compose -f docker-compose.prod.yml stop backend frontend

# 2. Create safety backup of current state
mongodump --uri="$MONGODB_URI" --out=/backups/pre-rollback-$(date +%Y%m%d-%H%M%S)

# 3. Drop affected collections
mongosh $MONGODB_URI << EOF
use es;
db.projects.drop();
db.organizations.drop();
// DO NOT drop users or documents - we'll revert these
EOF

# 4. Restore from backup
mongorestore --uri="$MONGODB_URI" /backups/latest --drop

# 5. Run rollback migration
node backend/nodejs/apps/src/migrations/002_migrate_to_multi_tenant.js down

# 6. Restart services
docker-compose -f docker-compose.prod.yml start backend frontend
```

### Option 3: Feature Flag Disable

For partial rollback without full deployment rollback:

```javascript
// 1. Disable multi-tenancy via environment variable
MULTI_TENANT_ENABLED=false

// 2. Update API to bypass multi-tenant logic
// In backend/nodejs/apps/src/app.ts
if (process.env.MULTI_TENANT_ENABLED === 'false') {
  app.use('/api', legacyRoutes);
} else {
  app.use('/api', multiTenantRoutes);
}

// 3. Restart services
pm2 restart all
```

---

## Detailed Step-by-Step Rollback

### Phase 1: Preparation (5 minutes)

```bash
# 1. Set maintenance mode
redis-cli SET maintenance_mode "true"
redis-cli SET maintenance_message "System maintenance in progress. Please try again in 15 minutes."

# 2. Stop accepting new requests (graceful shutdown)
kubectl scale deployment/backend --replicas=0 -n production
sleep 30  # Wait for in-flight requests to complete

# 3. Backup current state
./scripts/backup.sh emergency
```

### Phase 2: Rollback Execution (10 minutes)

```bash
# 1. Restore database to pre-migration state
echo "Restoring database..."
mongorestore --uri="$MONGODB_URI" /backups/pre-multi-tenant --drop

# 2. Revert code deployment
echo "Reverting application code..."
git checkout v1.9.0
docker build -t pipeshub/backend:rollback ./backend
docker build -t pipeshub/frontend:rollback ./frontend

# 3. Deploy previous version
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.rollback.yml up -d

# 4. Clear all caches
redis-cli FLUSHALL
```

### Phase 3: Verification (5 minutes)

```bash
# 1. Verify services are running
./scripts/health-check.sh production

# 2. Test critical endpoints
curl -X GET $API_URL/health
curl -X GET $API_URL/api/documents -H "Authorization: Bearer $TEST_TOKEN"

# 3. Check error rates
tail -f /var/log/app/error.log | grep -i error

# 4. Disable maintenance mode
redis-cli DEL maintenance_mode
redis-cli DEL maintenance_message
```

---

## Post-Rollback Verification

### Immediate Checks (First 30 minutes)

```bash
#!/bin/bash
# Post-rollback monitoring script

while true; do
  clear
  echo "=== Post-Rollback Monitoring ==="
  echo "Time: $(date)"

  # Check service health
  echo -n "API Health: "
  curl -s -o /dev/null -w "%{http_code}" $API_URL/health

  # Check error rate
  echo -n "Error Rate: "
  curl -s $PROMETHEUS_URL/api/v1/query?query=rate(http_requests_total{status=~"5.."}[1m]) | jq '.data.result[0].value[1]'

  # Check active users
  echo -n "Active Users: "
  redis-cli GET active_users_count

  # Check database connections
  echo -n "DB Connections: "
  mongosh --eval "db.serverStatus().connections.current" --quiet

  sleep 10
done
```

### Extended Monitoring (First 24 hours)

Monitor these metrics closely:
- API response times
- Error rates
- User login success rate
- Database query performance
- Cache hit rates
- Memory usage
- CPU usage

### User Communication

```markdown
# Status Page Update

## Issue Resolved

We've successfully rolled back the recent update to address the issues some users were experiencing.

**Current Status:** ✅ All systems operational

**What Happened:**
- Issue detected at [TIME]
- Rollback initiated at [TIME]
- Services restored at [TIME]

**Impact:**
- Affected users: [NUMBER]
- Duration: [MINUTES] minutes
- Data loss: None

**Next Steps:**
- We're investigating the root cause
- A fix will be deployed after thorough testing
- Full incident report will be published within 24 hours

We apologize for any inconvenience caused.
```

---

## Root Cause Analysis

### Data Collection

```bash
# Create incident directory
mkdir -p /incidents/$(date +%Y%m%d)
cd /incidents/$(date +%Y%m%d)

# Collect all relevant data
cp /tmp/*-logs-*.log ./
cp /tmp/metrics-*.json ./
cp /tmp/incident-*.txt ./

# Get deployment details
kubectl describe deployment/backend -n production > deployment-details.txt
docker inspect pipeshub/backend:multi-tenant > container-inspect.json

# Database state
mongosh --eval "db.stats()" > db-stats.json
mongosh --eval "db.projects.stats()" > projects-stats.json

# Redis state
redis-cli INFO > redis-info.txt
```

### Analysis Template

```markdown
# Incident Report: Multi-Tenancy Rollback

## Summary
- **Date:** [DATE]
- **Duration:** [MINUTES] minutes
- **Severity:** [Critical/High/Medium/Low]
- **Services Affected:** [List]

## Timeline
- HH:MM - Issue first detected
- HH:MM - Alert triggered
- HH:MM - Team notified
- HH:MM - Rollback decision made
- HH:MM - Rollback initiated
- HH:MM - Services restored
- HH:MM - Incident resolved

## Root Cause
[Detailed explanation of what caused the issue]

## Impact
- Users affected: [NUMBER]
- Data loss: [Yes/No]
- Revenue impact: [AMOUNT]
- SLA impact: [PERCENTAGE]

## Resolution
[Steps taken to resolve]

## Lessons Learned
1. What went well
2. What went wrong
3. What was lucky

## Action Items
- [ ] Fix identified bug
- [ ] Add missing tests
- [ ] Update monitoring
- [ ] Update documentation
- [ ] Review deployment process
```

---

## Rollback Decision Matrix

| Symptom | Severity | Rollback? | Alternative |
|---------|----------|-----------|-------------|
| 5xx errors >50% | Critical | Yes | None |
| Data corruption | Critical | Yes | None |
| Auth failures >10% | Critical | Yes | None |
| Performance degradation >50% | High | Yes | Scale up first |
| UI issues | Medium | No | Hot fix |
| Cache issues | Low | No | Clear cache |
| Single org affected | Medium | No | Targeted fix |

---

## Emergency Contacts

### On-Call Team
- Primary: [Name] - [Phone] - [Email]
- Secondary: [Name] - [Phone] - [Email]
- Manager: [Name] - [Phone] - [Email]

### External Support
- MongoDB Support: [Ticket URL]
- AWS Support: [Case URL]
- Redis Support: [Contact]

### Communication Channels
- Incident Channel: #incidents
- Status Page: https://status.pipeshub.ai
- Customer Support: support@pipeshub.ai

---

## Appendix

### Quick Commands Reference

```bash
# Check deployment status
kubectl get deployments -n production

# View recent logs
kubectl logs -l app=backend -n production --tail=100

# Database connection test
mongosh $MONGODB_URI --eval "db.runCommand({ping: 1})"

# Redis connection test
redis-cli ping

# Force cache clear
redis-cli FLUSHALL

# Restart services
kubectl rollout restart deployment/backend -n production

# Emergency scale down
kubectl scale deployment/backend --replicas=0 -n production

# View metrics
curl $PROMETHEUS_URL/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'
```

### Rollback Verification Checklist

- [ ] All services are running
- [ ] Health checks passing
- [ ] No 5xx errors in last 5 minutes
- [ ] Users can log in
- [ ] Data is accessible
- [ ] Search functionality works
- [ ] File uploads work
- [ ] Cache is functioning
- [ ] Database queries are normal
- [ ] No security alerts
- [ ] Monitoring is active
- [ ] Logs are being collected

---

Last Updated: 2024-12-21
Version: 1.0.0