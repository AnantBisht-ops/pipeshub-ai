# Multi-Tenancy API Migration Guide

## Breaking Changes & Migration Path

### Overview
This guide helps developers migrate existing integrations to the new multi-tenant API.

---

## API Versioning

### Version Headers
```http
GET /api/documents
X-API-Version: 2.0
Authorization: Bearer <token>
X-Organization-Id: <org-id>
X-Project-Id: <project-id>  # Optional
```

### Backward Compatibility
- **v1 endpoints**: Deprecated, will be removed in v3.0
- **v2 endpoints**: Current, multi-tenant aware
- **Migration period**: 6 months

---

## Authentication Changes

### Before (v1)
```javascript
// Simple token auth
const headers = {
  'Authorization': 'Bearer ' + token
};
```

### After (v2)
```javascript
// Token + organization context
const headers = {
  'Authorization': 'Bearer ' + token,
  'X-Organization-Id': currentOrgId,
  'X-Project-Id': currentProjectId  // Optional
};
```

### Getting Organization ID
```javascript
// Get user's organizations
const response = await fetch('/api/users/me/organizations', {
  headers: { 'Authorization': 'Bearer ' + token }
});

const orgs = await response.json();
const defaultOrg = orgs.find(org => org.isDefault) || orgs[0];
```

---

## Endpoint Changes

### Documents API

#### Create Document
**Before (v1):**
```javascript
POST /api/documents
{
  "name": "Document Name",
  "content": "..."
}
```

**After (v2):**
```javascript
POST /api/documents
{
  "name": "Document Name",
  "content": "...",
  "projectId": "project-id"  // Required
}
```

#### List Documents
**Before (v1):**
```javascript
GET /api/documents
// Returns all user's documents
```

**After (v2):**
```javascript
GET /api/documents?projectId=<id>
// Returns documents in specific project

GET /api/documents
// Returns documents across all projects in organization
```

#### Search Documents
**Before (v1):**
```javascript
GET /api/search?q=query
```

**After (v2):**
```javascript
GET /api/search?q=query&projectId=<id>
// Search within project

GET /api/search?q=query
// Search across organization
```

---

### Conversations API

#### Create Conversation
**Before (v1):**
```javascript
POST /api/conversations
{
  "title": "Conversation Title",
  "message": "First message"
}
```

**After (v2):**
```javascript
POST /api/conversations
{
  "title": "Conversation Title",
  "message": "First message",
  "projectId": "project-id"  // Required
}
```

#### List Conversations
**Before (v1):**
```javascript
GET /api/conversations
```

**After (v2):**
```javascript
GET /api/conversations?projectId=<id>
// Project-specific conversations

GET /api/conversations
// All conversations in organization
```

---

## New Endpoints

### Organizations
```javascript
// List user's organizations
GET /api/organizations

// Get organization details
GET /api/organizations/:id

// Create organization (if enabled)
POST /api/organizations
{
  "name": "Organization Name",
  "type": "business|team|individual",
  "domain": "example.com"
}

// Update organization (admin only)
PUT /api/organizations/:id
{
  "settings": {
    "maxProjects": 10,
    "maxUsers": 50
  }
}

// Switch active organization
POST /api/auth/switch-organization
{
  "organizationId": "org-id"
}
```

### Projects
```javascript
// List projects in organization
GET /api/organizations/:orgId/projects

// Get project details
GET /api/projects/:id

// Create project
POST /api/organizations/:orgId/projects
{
  "name": "Project Name",
  "description": "Project Description",
  "isPrivate": false
}

// Update project
PUT /api/projects/:id
{
  "name": "Updated Name",
  "settings": {...}
}

// Add project member
POST /api/projects/:id/members
{
  "userId": "user-id",
  "role": "member|admin"
}

// Remove project member
DELETE /api/projects/:id/members/:userId
```

---

## Response Format Changes

### Before (v1)
```javascript
{
  "data": [...],
  "total": 100
}
```

### After (v2)
```javascript
{
  "data": [...],
  "total": 100,
  "context": {
    "organizationId": "org-id",
    "organizationName": "Org Name",
    "projectId": "project-id",
    "projectName": "Project Name"
  },
  "metadata": {
    "filtered": true,
    "scope": "project|organization"
  }
}
```

---

## Error Handling

### New Error Codes
```javascript
{
  "error": {
    "code": "ORG_NOT_FOUND",
    "message": "Organization not found",
    "statusCode": 404
  }
}

// Multi-tenancy specific errors
- ORG_NOT_FOUND (404)
- ORG_ACCESS_DENIED (403)
- PROJECT_NOT_FOUND (404)
- PROJECT_ACCESS_DENIED (403)
- ORG_LIMIT_EXCEEDED (429)
- PROJECT_LIMIT_EXCEEDED (429)
- CROSS_ORG_ACCESS_DENIED (403)
```

---

## Migration Examples

### Example 1: Document Upload
```javascript
// Old implementation (v1)
async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  return fetch('/api/documents/upload', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    body: formData
  });
}

// New implementation (v2)
async function uploadDocument(file, projectId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('projectId', projectId);

  return fetch('/api/documents/upload', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'X-Organization-Id': currentOrgId,
      'X-Project-Id': projectId
    },
    body: formData
  });
}
```

### Example 2: Search Implementation
```javascript
// Old implementation (v1)
async function searchDocuments(query) {
  return fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
}

// New implementation (v2)
async function searchDocuments(query, options = {}) {
  const params = new URLSearchParams({
    q: query,
    ...(options.projectId && { projectId: options.projectId }),
    ...(options.limit && { limit: options.limit })
  });

  return fetch(`/api/search?${params}`, {
    headers: {
      'Authorization': 'Bearer ' + token,
      'X-Organization-Id': currentOrgId,
      ...(options.projectId && { 'X-Project-Id': options.projectId })
    }
  });
}
```

### Example 3: Full Migration
```javascript
// Complete migration example for a document service

class DocumentService {
  constructor() {
    this.baseUrl = '/api';
    this.token = null;
    this.currentOrg = null;
    this.currentProject = null;
  }

  async initialize() {
    // Get user's organizations
    const orgs = await this.getOrganizations();
    this.currentOrg = orgs.find(o => o.isDefault) || orgs[0];

    // Get projects in organization
    const projects = await this.getProjects(this.currentOrg.id);
    this.currentProject = projects.find(p => p.isDefault) || projects[0];
  }

  getHeaders(includeProject = true) {
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'X-Organization-Id': this.currentOrg.id
    };

    if (includeProject && this.currentProject) {
      headers['X-Project-Id'] = this.currentProject.id;
    }

    return headers;
  }

  async getOrganizations() {
    const response = await fetch(`${this.baseUrl}/organizations`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    return response.json();
  }

  async getProjects(orgId) {
    const response = await fetch(
      `${this.baseUrl}/organizations/${orgId}/projects`,
      {
        headers: this.getHeaders(false)
      }
    );
    return response.json();
  }

  async createDocument(data) {
    const response = await fetch(`${this.baseUrl}/documents`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        ...data,
        projectId: this.currentProject.id
      })
    });
    return response.json();
  }

  async getDocuments(projectId = null) {
    const url = projectId
      ? `${this.baseUrl}/documents?projectId=${projectId}`
      : `${this.baseUrl}/documents`;

    const response = await fetch(url, {
      headers: this.getHeaders(!!projectId)
    });
    return response.json();
  }

  async searchDocuments(query, projectId = null) {
    const params = new URLSearchParams({ q: query });
    if (projectId) {
      params.append('projectId', projectId);
    }

    const response = await fetch(
      `${this.baseUrl}/search?${params}`,
      {
        headers: this.getHeaders(!!projectId)
      }
    );
    return response.json();
  }

  async switchOrganization(orgId) {
    const response = await fetch(
      `${this.baseUrl}/auth/switch-organization`,
      {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ organizationId: orgId })
      }
    );

    if (response.ok) {
      this.currentOrg = await response.json();
      // Reset project selection
      const projects = await this.getProjects(orgId);
      this.currentProject = projects[0];
    }

    return this.currentOrg;
  }

  async switchProject(projectId) {
    // Validate project belongs to current org
    const project = await fetch(
      `${this.baseUrl}/projects/${projectId}`,
      {
        headers: this.getHeaders(false)
      }
    );

    if (project.ok) {
      this.currentProject = await project.json();
    }

    return this.currentProject;
  }
}
```

---

## Testing Your Migration

### Test Checklist
- [ ] Authentication works with organization context
- [ ] Can list and switch organizations
- [ ] Can list and switch projects
- [ ] Documents are created in correct project
- [ ] Search respects project boundaries
- [ ] Permissions are properly enforced
- [ ] Error handling for missing org/project
- [ ] Performance is acceptable

### Test Script
```javascript
async function testMigration() {
  const service = new DocumentService();
  service.token = 'your-token';

  try {
    // Initialize
    await service.initialize();
    console.log('✅ Initialization successful');

    // Test organization listing
    const orgs = await service.getOrganizations();
    console.log(`✅ Found ${orgs.length} organizations`);

    // Test project listing
    const projects = await service.getProjects(orgs[0].id);
    console.log(`✅ Found ${projects.length} projects`);

    // Test document creation
    const doc = await service.createDocument({
      name: 'Test Document',
      content: 'Test content'
    });
    console.log('✅ Document created:', doc.id);

    // Test search
    const results = await service.searchDocuments('test');
    console.log(`✅ Search returned ${results.data.length} results`);

    // Test project filtering
    const projectDocs = await service.getDocuments(projects[0].id);
    console.log(`✅ Project has ${projectDocs.data.length} documents`);

    console.log('\n🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}
```

---

## Deprecation Timeline

### Phase 1 (Current)
- v2 API is live
- v1 API still functional
- Console warnings for v1 usage

### Phase 2 (3 months)
- v1 API returns deprecation headers
- Email notifications to v1 users
- Migration tools available

### Phase 3 (6 months)
- v1 API returns 410 Gone
- Forced migration
- Support for migration issues

---

## Support

### Resources
- Migration Tool: https://tools.pipeshub.ai/api-migration
- API Playground: https://api.pipeshub.ai/playground
- Support: api-support@pipeshub.ai

### Common Issues

**Issue**: Getting 403 on all requests
**Solution**: Ensure X-Organization-Id header is present

**Issue**: Documents not appearing
**Solution**: Check if projectId filter is too restrictive

**Issue**: Cannot create resources
**Solution**: Verify user has permission in the project

**Issue**: Performance degradation
**Solution**: Implement caching for organization/project lists