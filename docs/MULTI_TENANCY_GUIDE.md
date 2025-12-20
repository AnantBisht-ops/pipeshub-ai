# Multi-Tenancy Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [For End Users](#for-end-users)
3. [For Developers](#for-developers)
4. [For Administrators](#for-administrators)
5. [Migration Guide](#migration-guide)
6. [Troubleshooting](#troubleshooting)

---

## Overview

PipesHub AI now supports multi-tenancy with organization and project-based data isolation. This guide covers everything you need to know about using and managing the multi-tenant system.

### Architecture
```
Organization (Company/Team)
    └── Projects (Workspaces)
        └── Resources (Documents, Conversations, etc.)
```

### Key Features
- **Complete Data Isolation**: Each organization's data is completely isolated
- **Project-Based Organization**: Resources are organized into projects
- **Flexible Permissions**: Granular control at organization and project levels
- **Performance Optimized**: Redis caching for fast access
- **Backward Compatible**: Existing data automatically migrated

---

## For End Users

### Getting Started

#### Logging In
When you log in, you'll automatically be placed in your default organization and project.

#### Understanding the Interface
- **Organization Switcher**: Top-left corner, shows current organization
- **Project Selector**: Below organization, shows current project or "All Projects"
- **Data Scope Indicator**: Shows whether you're viewing project-specific or all data

### Managing Organizations

#### Switching Organizations
1. Click the organization name in the top-left corner
2. Select from your available organizations
3. The interface will refresh with the selected organization's data

#### Creating a New Organization
1. Click the organization switcher
2. Select "Create New Organization"
3. Fill in the organization details:
   - Organization Name (required)
   - Type: Individual, Team, Business, or Enterprise
   - Domain (optional)
4. Click "Create Organization"

#### Inviting Members to Organization
1. Go to Settings → Organization
2. Click "Members" tab
3. Click "Invite Members"
4. Enter email addresses (comma-separated for multiple)
5. Select role (Member or Admin)
6. Click "Send Invitations"

### Managing Projects

#### Understanding Projects
- **Default Project**: Every organization has a "General" project
- **Project Isolation**: Data in projects is isolated from other projects
- **All Projects View**: Select "All Projects" to see data across all projects

#### Creating a New Project
1. Click the project selector
2. Select "Create New Project"
3. Enter project details:
   - Project Name (required)
   - Description (optional)
   - Privacy: Public (all org members) or Private (invited only)
4. Click "Create Project"

#### Switching Projects
1. Click the current project name
2. Select a project or "All Projects"
3. The data view updates to show only that project's resources

#### Managing Project Members
1. Go to Settings → Projects
2. Select your project
3. Click "Members" tab
4. Add or remove members
5. Assign project admin roles

### Working with Data

#### Documents
- Documents are now associated with projects
- Upload documents to specific projects
- Use "All Projects" view to search across projects

#### Conversations
- Each conversation belongs to a project
- Start conversations within project context
- Historical conversations remain in their original projects

#### Sharing and Collaboration
- Share project access instead of individual documents
- Collaborate with project members in real-time
- Project admins can manage all project resources

### Best Practices

1. **Organize by Purpose**: Create projects for different use cases
   - "Marketing Content"
   - "Product Documentation"
   - "Customer Support"

2. **Use Descriptive Names**: Make projects easy to identify
   - ✅ "Q4 2024 Marketing Campaign"
   - ❌ "Project 1"

3. **Regular Cleanup**: Archive completed projects to maintain organization

4. **Permission Management**: Regularly review project members and permissions

---

## For Developers

### API Changes

#### Authentication Headers
All API requests now require organization context:

```javascript
// Required headers
{
  "Authorization": "Bearer <token>",
  "X-Organization-Id": "<org-id>",  // Required
  "X-Project-Id": "<project-id>"     // Optional (defaults to all projects)
}
```

#### Base Endpoints

##### Organizations
```typescript
GET    /api/organizations              // List user's organizations
POST   /api/organizations              // Create new organization
GET    /api/organizations/:id          // Get organization details
PUT    /api/organizations/:id          // Update organization
DELETE /api/organizations/:id          // Delete organization (admin only)
```

##### Projects
```typescript
GET    /api/organizations/:orgId/projects       // List projects
POST   /api/organizations/:orgId/projects       // Create project
GET    /api/projects/:id                        // Get project details
PUT    /api/projects/:id                        // Update project
DELETE /api/projects/:id                        // Delete project
POST   /api/projects/:id/members                // Add project member
DELETE /api/projects/:id/members/:userId        // Remove member
```

##### Resources with Project Context
```typescript
// All resource endpoints now support projectId
GET /api/documents?projectId=<id>          // Filter by project
GET /api/conversations?projectId=<id>      // Filter by project
GET /api/search?projectId=<id>&q=<query>   // Search within project
```

### Frontend Integration

#### Using Organization Context
```typescript
import { useOrganization } from '@/contexts/OrganizationContext';

function MyComponent() {
  const {
    currentOrganization,
    organizations,
    switchOrganization,
    isLoading
  } = useOrganization();

  const handleOrgSwitch = async (orgId: string) => {
    await switchOrganization(orgId);
    // Component automatically re-renders with new data
  };
}
```

#### Using Project Context
```typescript
import { useProject } from '@/contexts/ProjectContext';

function ProjectAwareComponent() {
  const {
    currentProject,
    projects,
    setCurrentProject,
    isAllProjects
  } = useProject();

  // Data hooks automatically filter by project
  const documents = useDocuments(); // Returns project-filtered documents
}
```

#### Data Hooks with Context
```typescript
// Hooks automatically use organization and project context
function useDocuments() {
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();

  return useQuery({
    queryKey: ['documents', currentOrganization?.id, currentProject?.id],
    queryFn: () => fetchDocuments({
      orgId: currentOrganization?.id,
      projectId: currentProject?.id
    }),
    enabled: !!currentOrganization
  });
}
```

### Backend Implementation

#### Middleware for Project Context
```typescript
// Automatically extracts project context
app.use(ProjectContextMiddleware.extractProjectContext);

// In your controller
async getDocuments(req: Request, res: Response) {
  const { projectId } = (req as any).project;

  const filter: any = {
    orgId: req.user.currentOrgId,
    isDeleted: false
  };

  // Backward compatible filtering
  if (projectId) {
    filter.projectId = projectId;
  } else {
    filter.projectId = { $in: [null, undefined] };
  }

  const documents = await DocumentModel.find(filter);
  res.json(documents);
}
```

#### Database Schema Updates

##### Organization Schema
```typescript
{
  _id: ObjectId,
  slug: String (unique),
  registeredName: String,
  settings: {
    maxProjects: Number,
    maxUsers: Number,
    features: [String]
  },
  metadata: {
    projectCount: Number,
    userCount: Number
  }
}
```

##### Project Schema
```typescript
{
  _id: ObjectId,
  orgId: ObjectId (required),
  slug: String,
  name: String,
  description: String,
  members: [ObjectId],
  admins: [ObjectId],
  settings: {
    isPrivate: Boolean,
    features: [String]
  },
  metadata: {
    documentCount: Number,
    conversationCount: Number,
    lastActivity: Date
  }
}
```

##### Resource Schema Updates
All resource collections now include:
```typescript
{
  orgId: ObjectId,      // Organization ID
  projectId: ObjectId,  // Project ID
  // ... existing fields
}
```

### Testing

#### Unit Test Example
```javascript
describe('Multi-Tenant Data Isolation', () => {
  test('Should isolate data between organizations', async () => {
    const org1Doc = await createDocument({ orgId: org1._id });
    const org2Doc = await createDocument({ orgId: org2._id });

    const org1Results = await searchDocuments({ orgId: org1._id });

    expect(org1Results).toContainEqual(org1Doc);
    expect(org1Results).not.toContainEqual(org2Doc);
  });
});
```

#### Integration Test Example
```javascript
test('Should switch organization context', async () => {
  const response = await request(app)
    .post('/api/auth/switch-org')
    .set('Authorization', `Bearer ${token}`)
    .send({ organizationId: newOrg._id });

  expect(response.status).toBe(200);
  expect(response.body.currentOrganization.id).toBe(newOrg._id);
});
```

---

## For Administrators

### Organization Management

#### Setting Organization Limits
```javascript
// In organization settings
{
  "settings": {
    "maxProjects": 10,        // Maximum projects allowed
    "maxUsers": 50,           // Maximum users allowed
    "maxStorage": 10737418240, // 10GB in bytes
    "features": [
      "multi-project",
      "advanced-permissions",
      "api-access",
      "custom-integrations"
    ]
  }
}
```

#### Monitoring Usage

##### Database Queries
```javascript
// Get organization statistics
db.projects.aggregate([
  { $match: { orgId: ObjectId("...") } },
  { $group: {
    _id: "$orgId",
    projectCount: { $sum: 1 },
    totalDocuments: { $sum: "$metadata.documentCount" }
  }}
]);

// Get user activity
db.users.find({
  organizations: ObjectId("..."),
  lastActive: { $gte: new Date(Date.now() - 30*24*60*60*1000) }
}).count();
```

##### Redis Monitoring
```bash
# Check cache statistics
redis-cli INFO stats

# Monitor cache hit rate
redis-cli --stat

# View cache keys
redis-cli KEYS "mt:org:*"
```

### Deployment Management

#### Pre-Deployment Checklist
- [ ] Backup production database
- [ ] Test migration on staging
- [ ] Verify rollback procedure
- [ ] Update monitoring dashboards
- [ ] Notify users of maintenance window

#### Environment Variables
```bash
# Required for multi-tenancy
MULTI_TENANT_ENABLED=true
REDIS_URL=redis://localhost:6379
DEFAULT_ORG_PROJECTS_LIMIT=5
DEFAULT_ORG_USERS_LIMIT=20
ENABLE_ORG_CREATION=true
ENABLE_PROJECT_CREATION=true
```

#### Performance Tuning

##### MongoDB Indexes
```javascript
// Ensure these indexes exist
db.projects.createIndex({ orgId: 1, slug: 1 }, { unique: true });
db.documents.createIndex({ orgId: 1, projectId: 1, isDeleted: 1 });
db.conversations.createIndex({ orgId: 1, projectId: 1, userId: 1 });
db.users.createIndex({ organizations: 1, defaultOrgId: 1 });
```

##### Redis Configuration
```conf
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### Monitoring & Alerts

#### Key Metrics to Monitor
1. **Organization Metrics**
   - Active organizations
   - Organizations approaching limits
   - Failed organization operations

2. **Project Metrics**
   - Projects per organization
   - Project member count
   - Inactive projects

3. **Performance Metrics**
   - API response times by organization
   - Cache hit rates
   - Database query performance

4. **Security Metrics**
   - Cross-organization access attempts
   - Failed permission checks
   - Unusual data access patterns

#### Alert Configuration
```yaml
alerts:
  - name: "High Organization Limit Usage"
    condition: "project_count / max_projects > 0.9"
    severity: "warning"

  - name: "Cache Hit Rate Low"
    condition: "cache_hit_rate < 0.7"
    severity: "warning"

  - name: "Cross-Org Access Attempt"
    condition: "cross_org_access_attempts > 0"
    severity: "critical"
```

### Backup and Recovery

#### Backup Strategy
```bash
#!/bin/bash
# Daily backup script

# Backup MongoDB
mongodump --uri="$MONGODB_URI" --out="/backups/$(date +%Y%m%d)"

# Backup Redis
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb "/backups/redis-$(date +%Y%m%d).rdb"

# Compress and encrypt
tar -czf "/backups/backup-$(date +%Y%m%d).tar.gz" "/backups/$(date +%Y%m%d)"
gpg --encrypt --recipient backup@company.com "/backups/backup-$(date +%Y%m%d).tar.gz"
```

#### Recovery Procedure
1. Stop application servers
2. Restore MongoDB: `mongorestore --uri="$MONGODB_URI" /backups/[date]`
3. Restore Redis: `cp /backups/redis-[date].rdb /var/lib/redis/dump.rdb`
4. Clear application caches
5. Start application servers
6. Verify data integrity

---

## Migration Guide

### Pre-Migration Steps

1. **Audit Current Data**
```javascript
// Check data distribution
db.documents.aggregate([
  { $group: { _id: null, count: { $sum: 1 } } }
]);
```

2. **Backup Everything**
```bash
./scripts/backup.sh
```

3. **Test Migration**
```bash
./scripts/run-migration.sh --dry-run
```

### Running Migration

#### Automatic Migration
```bash
# Run the migration script
./scripts/run-migration.sh

# Verify migration
node ./scripts/verify-migration.js
```

#### Manual Migration Steps
1. Create default organizations
2. Create default projects
3. Update user associations
4. Update resource associations
5. Verify data integrity

### Post-Migration

1. **Verify Data Integrity**
```bash
node ./scripts/verify-migration.js
```

2. **Update Application Configuration**
```bash
MULTI_TENANT_ENABLED=true
```

3. **Clear Caches**
```bash
redis-cli FLUSHDB
```

4. **Monitor for Issues**
- Check error logs
- Monitor performance metrics
- Review user feedback

### Rollback Procedure

If issues occur:
```bash
# 1. Stop application
docker-compose down

# 2. Restore backup
cd /backups/latest
./restore.sh

# 3. Disable multi-tenancy
MULTI_TENANT_ENABLED=false

# 4. Restart application
docker-compose up -d
```

---

## Troubleshooting

### Common Issues

#### Issue: "Organization not found"
**Cause**: User not associated with any organization
**Solution**:
```javascript
// Associate user with default org
await UserModel.findByIdAndUpdate(userId, {
  $push: { organizations: defaultOrgId },
  defaultOrgId: defaultOrgId
});
```

#### Issue: "Cannot access project"
**Cause**: User not a member of the project
**Solution**:
1. Check project membership
2. Add user to project members
3. Clear cache for user

#### Issue: "Data not appearing after switch"
**Cause**: Cache not invalidated
**Solution**:
```bash
# Clear user cache
redis-cli DEL "mt:user:${userId}:*"
```

#### Issue: "Slow performance after migration"
**Cause**: Missing indexes
**Solution**:
```javascript
// Create necessary indexes
db.documents.createIndex({ orgId: 1, projectId: 1 });
db.conversations.createIndex({ orgId: 1, projectId: 1 });
```

### Debug Commands

```bash
# Check user's organizations
mongo es --eval "db.users.findOne({email: 'user@example.com'}).organizations"

# Check project members
mongo es --eval "db.projects.findOne({slug: 'project-slug'}).members"

# Check cache keys
redis-cli KEYS "mt:*" | head -20

# Check recent errors
tail -f /var/log/app/error.log | grep -i "multi-tenant"
```

### Support Resources

- **Documentation**: https://docs.pipeshub.ai/multi-tenancy
- **API Reference**: https://api.pipeshub.ai/docs
- **Support Email**: support@pipeshub.ai
- **Community Forum**: https://community.pipeshub.ai

---

## Appendix

### Glossary

- **Organization**: Top-level container for users and projects
- **Project**: Workspace within an organization for grouping resources
- **Resource**: Any data object (document, conversation, etc.)
- **Member**: User associated with an organization or project
- **Admin**: User with management permissions
- **Context**: Current organization and project selection

### Version History

- **v2.0.0** - Initial multi-tenancy implementation
- **v2.0.1** - Performance optimizations with Redis caching
- **v2.0.2** - Enhanced permission system
- **v2.1.0** - Project templates and bulk operations

### License

Copyright (c) 2024 PipesHub AI. All rights reserved.