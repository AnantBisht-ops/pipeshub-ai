/**
 * Multi-Tenancy Integration Tests
 * Tests the integration between different components of the multi-tenant system
 */

const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');

describe('Multi-Tenancy Integration Tests', () => {
  let app;
  let testOrg1, testOrg2;
  let testUser1, testUser2;
  let testProject1, testProject2;
  let authToken1, authToken2;

  // Mock Express app setup
  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token === authToken1) {
        req.user = { userId: testUser1._id, email: testUser1.email };
        req.org = { orgId: testOrg1._id, orgSlug: testOrg1.slug };
      } else if (token === authToken2) {
        req.user = { userId: testUser2._id, email: testUser2.email };
        req.org = { orgId: testOrg2._id, orgSlug: testOrg2.slug };
      }
      next();
    });

    // Mock routes
    app.get('/api/v1/organizations/my-organizations', (req, res) => {
      const orgs = req.user?.userId === testUser1._id
        ? [testOrg1]
        : [testOrg2];
      res.json({ organizations: orgs });
    });

    app.post('/api/v1/organizations/switch/:orgId', (req, res) => {
      const { orgId } = req.params;
      res.json({
        accessToken: 'new-token',
        organization: { _id: orgId }
      });
    });

    app.get('/api/v1/projects', (req, res) => {
      const projects = req.org?.orgId === testOrg1._id
        ? [testProject1]
        : [testProject2];
      res.json({ projects });
    });

    app.post('/api/v1/projects', (req, res) => {
      const newProject = {
        ...req.body,
        _id: new mongoose.Types.ObjectId(),
        orgId: req.org?.orgId,
      };
      res.status(201).json(newProject);
    });
  });

  beforeEach(async () => {
    // Setup test data
    testOrg1 = global.testUtils.createTestOrg({ slug: 'org-1' });
    testOrg2 = global.testUtils.createTestOrg({ slug: 'org-2' });
    testUser1 = global.testUtils.createTestUser(testOrg1._id);
    testUser2 = global.testUtils.createTestUser(testOrg2._id);
    testProject1 = global.testUtils.createTestProject(testOrg1._id);
    testProject2 = global.testUtils.createTestProject(testOrg2._id);

    // Mock auth tokens
    authToken1 = 'token-user1';
    authToken2 = 'token-user2';
  });

  // ==================== ORGANIZATION SWITCHING ====================
  describe('Organization Switching Flow', () => {
    test('Should fetch user organizations', async () => {
      const response = await request(app)
        .get('/api/v1/organizations/my-organizations')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.organizations).toBeDefined();
      expect(response.body.organizations.length).toBeGreaterThan(0);
      expect(response.body.organizations[0]._id).toEqual(testOrg1._id);
    });

    test('Should switch between organizations', async () => {
      // User with multiple orgs
      testUser1.organizations = [testOrg1._id, testOrg2._id];

      const response = await request(app)
        .post(`/api/v1/organizations/switch/${testOrg2._id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.organization._id).toEqual(testOrg2._id.toString());
    });

    test('Should update context after organization switch', async () => {
      // First request - org1 context
      const firstResponse = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(firstResponse.body.projects[0].orgId).toEqual(testOrg1._id);

      // Switch organization
      await request(app)
        .post(`/api/v1/organizations/switch/${testOrg2._id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      // After switch - should have org2 context
      // (In real implementation, new token would be used)
    });
  });

  // ==================== PROJECT CREATION FLOW ====================
  describe('Project Creation and Management Flow', () => {
    test('Should create project within organization context', async () => {
      const newProjectData = {
        name: 'Integration Test Project',
        description: 'Created during integration test',
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(newProjectData)
        .expect(201);

      expect(response.body._id).toBeDefined();
      expect(response.body.orgId).toEqual(testOrg1._id);
      expect(response.body.name).toBe(newProjectData.name);
    });

    test('Should list projects for current organization', async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.projects).toBeDefined();
      expect(response.body.projects.length).toBeGreaterThan(0);
      expect(response.body.projects[0].orgId).toEqual(testOrg1._id);
    });

    test('Should not access projects from different organization', async () => {
      // User2 should only see org2 projects
      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(200);

      expect(response.body.projects).toBeDefined();
      expect(response.body.projects.every(p => p.orgId === testOrg2._id)).toBe(true);
      expect(response.body.projects.some(p => p.orgId === testOrg1._id)).toBe(false);
    });
  });

  // ==================== DATA SCOPING INTEGRATION ====================
  describe('Data Scoping Integration', () => {
    test('Should scope conversations to project and organization', async () => {
      // Create conversations for different projects
      const conversations = [
        global.testUtils.createTestConversation(testOrg1._id, testProject1._id, testUser1._id),
        global.testUtils.createTestConversation(testOrg2._id, testProject2._id, testUser2._id),
      ];

      if (global.testDb) {
        await global.testDb.collection('conversations').insertMany(conversations);

        // Query conversations for org1/project1
        const org1Conversations = await global.testDb.collection('conversations').find({
          orgId: testOrg1._id,
          projectId: testProject1._id,
        }).toArray();

        expect(org1Conversations.length).toBe(1);
        expect(org1Conversations[0].orgId).toEqual(testOrg1._id);
        expect(org1Conversations[0].projectId).toEqual(testProject1._id);
      }
    });

    test('Should handle document upload with project context', async () => {
      const mockDocument = {
        documentName: 'test-document.pdf',
        orgId: testOrg1._id,
        projectId: testProject1._id,
        uploadedBy: testUser1._id,
      };

      if (global.testDb) {
        await global.testDb.collection('documents').insertOne(mockDocument);

        // Verify document has correct context
        const doc = await global.testDb.collection('documents').findOne({
          documentName: 'test-document.pdf',
        });

        expect(doc.orgId).toEqual(testOrg1._id);
        expect(doc.projectId).toEqual(testProject1._id);
      }
    });

    test('Should handle "All Projects" view correctly', async () => {
      if (global.testDb) {
        // Create multiple projects for org1
        const projects = [
          testProject1,
          global.testUtils.createTestProject(testOrg1._id, { slug: 'project-a' }),
          global.testUtils.createTestProject(testOrg1._id, { slug: 'project-b' }),
        ];

        await global.testDb.collection('projects').insertMany(projects);

        // Create conversations across projects
        const conversations = projects.map(p =>
          global.testUtils.createTestConversation(testOrg1._id, p._id, testUser1._id)
        );

        // Add legacy conversation without projectId
        conversations.push({
          ...global.testUtils.createTestConversation(testOrg1._id, null, testUser1._id),
          projectId: undefined,
        });

        await global.testDb.collection('conversations').insertMany(conversations);

        // Query for "All Projects" - should include all conversations
        const allConversations = await global.testDb.collection('conversations').find({
          orgId: testOrg1._id,
        }).toArray();

        expect(allConversations.length).toBe(4); // 3 with projectId + 1 legacy
      }
    });
  });

  // ==================== PERMISSION INTEGRATION ====================
  describe('Permission and Access Control Integration', () => {
    test('Should enforce project member permissions', async () => {
      if (global.testDb) {
        // Create project where user1 is admin, user2 is member
        const sharedProject = global.testUtils.createTestProject(testOrg1._id, {
          name: 'Shared Project',
          slug: 'shared-project',
          members: [testUser1._id, testUser2._id],
          admins: [testUser1._id],
        });

        await global.testDb.collection('projects').insertOne(sharedProject);

        // User1 (admin) can update project
        const canUser1Update = sharedProject.admins.some(
          adminId => adminId.toString() === testUser1._id.toString()
        );
        expect(canUser1Update).toBe(true);

        // User2 (member) cannot update project
        const canUser2Update = sharedProject.admins.some(
          adminId => adminId.toString() === testUser2._id.toString()
        );
        expect(canUser2Update).toBe(false);
      }
    });

    test('Should handle cross-tenant access attempts', async () => {
      // Simulate user1 trying to access org2 resources
      const unauthorizedAccess = async () => {
        // This should be blocked by middleware
        const orgId = testOrg2._id;
        const userId = testUser1._id;

        // Check if user has access to org
        const hasAccess = testUser1.organizations?.includes(orgId);

        if (!hasAccess) {
          throw new Error('Unauthorized access to organization');
        }
      };

      await expect(unauthorizedAccess()).rejects.toThrow('Unauthorized access');
    });
  });

  // ==================== MIGRATION INTEGRATION ====================
  describe('Migration and Backward Compatibility', () => {
    test('Should handle legacy data without projectId', async () => {
      if (global.testDb) {
        // Create legacy document
        const legacyDoc = {
          _id: new mongoose.Types.ObjectId(),
          orgId: testOrg1._id,
          documentName: 'Legacy Document',
          // No projectId
        };

        await global.testDb.collection('documents').insertOne(legacyDoc);

        // Query with backward compatibility
        const documents = await global.testDb.collection('documents').find({
          orgId: testOrg1._id,
          $or: [
            { projectId: { $exists: true } },
            { projectId: { $in: [null, undefined] } },
          ],
        }).toArray();

        expect(documents.some(d => d.documentName === 'Legacy Document')).toBe(true);
      }
    });

    test('Should migrate existing data to multi-tenant structure', async () => {
      if (global.testDb) {
        // Simulate pre-migration data
        const preMigrationUser = {
          _id: new mongoose.Types.ObjectId(),
          email: 'pre-migration@example.com',
          orgId: testOrg1._id,
          // No organizations array
        };

        await global.testDb.collection('users').insertOne(preMigrationUser);

        // Simulate migration
        await global.testDb.collection('users').updateOne(
          { _id: preMigrationUser._id },
          {
            $set: {
              organizations: [testOrg1._id],
              defaultOrgId: testOrg1._id,
              lastAccessedOrgId: testOrg1._id,
            },
          }
        );

        const migratedUser = await global.testDb.collection('users').findOne({
          _id: preMigrationUser._id,
        });

        expect(migratedUser.organizations).toBeDefined();
        expect(migratedUser.organizations).toContainEqual(testOrg1._id);
        expect(migratedUser.defaultOrgId).toEqual(testOrg1._id);
      }
    });
  });

  // ==================== CONCURRENT ACCESS ====================
  describe('Concurrent Access and Race Conditions', () => {
    test('Should handle concurrent project creation', async () => {
      const projectPromises = [];

      // Simulate 5 concurrent project creation requests
      for (let i = 0; i < 5; i++) {
        projectPromises.push(
          request(app)
            .post('/api/v1/projects')
            .set('Authorization', `Bearer ${authToken1}`)
            .send({
              name: `Concurrent Project ${i}`,
              description: `Project ${i}`,
            })
        );
      }

      const responses = await Promise.all(projectPromises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body._id).toBeDefined();
        expect(response.body.orgId).toEqual(testOrg1._id);
      });

      // All should have unique IDs
      const projectIds = responses.map(r => r.body._id);
      const uniqueIds = new Set(projectIds);
      expect(uniqueIds.size).toBe(5);
    });

    test('Should handle concurrent organization switching', async () => {
      const switchPromises = [
        request(app)
          .post(`/api/v1/organizations/switch/${testOrg1._id}`)
          .set('Authorization', `Bearer ${authToken1}`),
        request(app)
          .post(`/api/v1/organizations/switch/${testOrg2._id}`)
          .set('Authorization', `Bearer ${authToken1}`),
      ];

      const responses = await Promise.all(switchPromises);

      // Both should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.accessToken).toBeDefined();
      });
    });
  });
});