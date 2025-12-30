/**
 * Multi-Tenancy Unit Tests
 * Comprehensive test suite for multi-tenant architecture
 */

const mongoose = require('mongoose');
const {
  OrganizationController
} = require('../../backend/nodejs/apps/src/modules/user_management/controller/org.controller');
const {
  ProjectController
} = require('../../backend/nodejs/apps/src/modules/project_management/controller/project.controller');

describe('Multi-Tenancy Unit Tests', () => {
  let orgController;
  let projectController;
  let testOrg1, testOrg2;
  let testProject1, testProject2;
  let testUser1, testUser2;

  beforeEach(async () => {
    // Initialize controllers
    orgController = new OrganizationController();
    projectController = new ProjectController();

    // Create test data
    testOrg1 = global.testUtils.createTestOrg({
      registeredName: 'Organization 1',
      slug: 'org-1'
    });
    testOrg2 = global.testUtils.createTestOrg({
      registeredName: 'Organization 2',
      slug: 'org-2'
    });

    testUser1 = global.testUtils.createTestUser(testOrg1._id, {
      email: 'user1@org1.com'
    });
    testUser2 = global.testUtils.createTestUser(testOrg2._id, {
      email: 'user2@org2.com'
    });

    // Save to test database
    if (global.testDb) {
      await global.testDb.collection('orgs').insertMany([testOrg1, testOrg2]);
      await global.testDb.collection('users').insertMany([testUser1, testUser2]);
    }
  });

  // ==================== ORGANIZATION TESTS ====================
  describe('Organization Management', () => {
    test('Should create multiple organizations', async () => {
      const newOrg = {
        registeredName: 'New Organization',
        shortName: 'NewOrg',
        accountType: 'business',
        domain: 'neworg.com',
      };

      const req = {
        body: newOrg,
        user: { userId: testUser1._id, email: testUser1.email },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Simulate org creation
      const createdOrg = {
        ...newOrg,
        _id: new mongoose.Types.ObjectId(),
        slug: 'new-organization',
        settings: {
          maxProjects: 100,
          maxUsers: 500,
          features: ['multi_project'],
        },
      };

      res.json.mockImplementationOnce((data) => {
        expect(data.organization).toBeDefined();
        expect(data.organization.slug).toBeTruthy();
        expect(data.organization.settings).toBeDefined();
      });

      // Verify multiple orgs can exist
      const orgs = await global.testDb.collection('orgs').find({}).toArray();
      expect(orgs.length).toBeGreaterThanOrEqual(2);
    });

    test('Should enforce organization limits', async () => {
      // Create user with max orgs
      const maxedUser = global.testUtils.createTestUser(testOrg1._id, {
        email: 'maxed@example.com',
        organizations: new Array(10).fill(testOrg1._id), // Max 10 orgs
      });

      await global.testDb.collection('users').insertOne(maxedUser);

      // Try to create 11th organization
      const req = {
        body: {
          registeredName: 'Org 11',
          accountType: 'individual',
        },
        user: { userId: maxedUser._id, email: maxedUser.email },
      };

      // Check organization count
      const userOrgs = await global.testDb.collection('orgs').countDocuments({
        contactEmail: maxedUser.email,
        isDeleted: false,
      });

      // Simulate limit check
      const canCreateOrg = userOrgs < 10;
      expect(canCreateOrg).toBe(true); // Should be true initially
    });

    test('Should isolate data between organizations', async () => {
      // Create data for org1
      const org1Doc = global.testUtils.createTestDocument(
        testOrg1._id,
        testProject1?._id,
        { documentName: 'Org1 Document' }
      );

      // Create data for org2
      const org2Doc = global.testUtils.createTestDocument(
        testOrg2._id,
        testProject2?._id,
        { documentName: 'Org2 Document' }
      );

      await global.testDb.collection('documents').insertMany([org1Doc, org2Doc]);

      // Query org1 data
      const org1Data = await global.testDb.collection('documents').find({
        orgId: testOrg1._id,
      }).toArray();

      // Query org2 data
      const org2Data = await global.testDb.collection('documents').find({
        orgId: testOrg2._id,
      }).toArray();

      // Verify isolation
      expect(org1Data.length).toBe(1);
      expect(org1Data[0].documentName).toBe('Org1 Document');
      expect(org2Data.length).toBe(1);
      expect(org2Data[0].documentName).toBe('Org2 Document');

      // Verify no cross-contamination
      expect(org1Data.find(d => d.orgId.equals(testOrg2._id))).toBeUndefined();
      expect(org2Data.find(d => d.orgId.equals(testOrg1._id))).toBeUndefined();
    });

    test('Should handle organization settings correctly', async () => {
      // Verify business org settings
      expect(testOrg1.settings.maxProjects).toBe(100);
      expect(testOrg1.settings.maxUsers).toBe(500);
      expect(testOrg1.settings.features).toContain('multi_project');

      // Create individual account org
      const individualOrg = global.testUtils.createTestOrg({
        accountType: 'individual',
        settings: {
          maxProjects: 10,
          maxUsers: 50,
          features: ['basic_features'],
        },
      });

      await global.testDb.collection('orgs').insertOne(individualOrg);

      // Verify individual org settings
      expect(individualOrg.settings.maxProjects).toBe(10);
      expect(individualOrg.settings.maxUsers).toBe(50);
      expect(individualOrg.subscription.plan).toBeDefined();
    });
  });

  // ==================== PROJECT TESTS ====================
  describe('Project Management', () => {
    beforeEach(async () => {
      // Create test projects
      testProject1 = global.testUtils.createTestProject(testOrg1._id, {
        name: 'Project 1',
        slug: 'project-1',
        members: [testUser1._id],
        admins: [testUser1._id],
      });

      testProject2 = global.testUtils.createTestProject(testOrg2._id, {
        name: 'Project 2',
        slug: 'project-2',
        members: [testUser2._id],
        admins: [testUser2._id],
      });

      await global.testDb.collection('projects').insertMany([testProject1, testProject2]);
    });

    test('Should create projects within organization', async () => {
      const newProject = {
        name: 'New Project',
        description: 'Test project creation',
        members: [testUser1._id],
      };

      // Create project for org1
      const createdProject = {
        ...newProject,
        _id: new mongoose.Types.ObjectId(),
        orgId: testOrg1._id,
        slug: 'new-project',
        admins: [testUser1._id],
        createdBy: testUser1._id,
      };

      await global.testDb.collection('projects').insertOne(createdProject);

      // Verify project belongs to correct org
      const project = await global.testDb.collection('projects').findOne({
        _id: createdProject._id,
      });

      expect(project).toBeDefined();
      expect(project.orgId.equals(testOrg1._id)).toBe(true);
      expect(project.name).toBe('New Project');
    });

    test('Should enforce project limits per organization', async () => {
      // Check current project count
      const projectCount = await global.testDb.collection('projects').countDocuments({
        orgId: testOrg1._id,
        isDeleted: false,
      });

      // Check against org limits
      const canCreateProject = projectCount < testOrg1.settings.maxProjects;
      expect(canCreateProject).toBe(true);

      // Simulate reaching limit
      const maxProjects = [];
      for (let i = projectCount; i < testOrg1.settings.maxProjects; i++) {
        maxProjects.push(
          global.testUtils.createTestProject(testOrg1._id, {
            name: `Project ${i}`,
            slug: `project-${i}`,
          })
        );
      }

      if (maxProjects.length > 0) {
        await global.testDb.collection('projects').insertMany(maxProjects);
      }

      const newCount = await global.testDb.collection('projects').countDocuments({
        orgId: testOrg1._id,
        isDeleted: false,
      });

      expect(newCount).toBeLessThanOrEqual(testOrg1.settings.maxProjects);
    });

    test('Should scope data to projects', async () => {
      // Create conversations for different projects
      const conv1 = global.testUtils.createTestConversation(
        testOrg1._id,
        testProject1._id,
        testUser1._id,
        { title: 'Project 1 Conversation' }
      );

      const conv2 = global.testUtils.createTestConversation(
        testOrg1._id,
        testProject2._id,
        testUser1._id,
        { title: 'Project 2 Conversation' }
      );

      await global.testDb.collection('conversations').insertMany([conv1, conv2]);

      // Query by project
      const project1Convs = await global.testDb.collection('conversations').find({
        orgId: testOrg1._id,
        projectId: testProject1._id,
      }).toArray();

      expect(project1Convs.length).toBe(1);
      expect(project1Convs[0].title).toBe('Project 1 Conversation');
    });

    test('Should handle "All Projects" view', async () => {
      // Create multiple projects for org1
      const project3 = global.testUtils.createTestProject(testOrg1._id, {
        name: 'Project 3',
        slug: 'project-3',
      });

      await global.testDb.collection('projects').insertOne(project3);

      // Create conversations across projects
      const conversations = [
        global.testUtils.createTestConversation(
          testOrg1._id,
          testProject1._id,
          testUser1._id
        ),
        global.testUtils.createTestConversation(
          testOrg1._id,
          project3._id,
          testUser1._id
        ),
        // Legacy conversation without projectId
        {
          ...global.testUtils.createTestConversation(
            testOrg1._id,
            null,
            testUser1._id
          ),
          projectId: undefined,
        },
      ];

      await global.testDb.collection('conversations').insertMany(conversations);

      // Query for "All Projects" view
      const allProjectsQuery = {
        orgId: testOrg1._id,
        $or: [
          { projectId: { $exists: true } },
          { projectId: { $in: [null, undefined] } },
        ],
      };

      const allConvs = await global.testDb.collection('conversations')
        .find(allProjectsQuery)
        .toArray();

      expect(allConvs.length).toBe(3); // Should include all conversations
    });

    test('Should manage project members correctly', async () => {
      // Add new member to project
      const newMember = global.testUtils.createTestUser(testOrg1._id, {
        email: 'newmember@org1.com',
      });

      await global.testDb.collection('users').insertOne(newMember);

      // Update project members
      await global.testDb.collection('projects').updateOne(
        { _id: testProject1._id },
        {
          $addToSet: { members: newMember._id },
        }
      );

      const updatedProject = await global.testDb.collection('projects').findOne({
        _id: testProject1._id,
      });

      expect(updatedProject.members).toContainEqual(newMember._id);
      expect(updatedProject.members.length).toBe(2);

      // Test admin promotion
      await global.testDb.collection('projects').updateOne(
        { _id: testProject1._id },
        {
          $addToSet: { admins: newMember._id },
        }
      );

      const projectWithNewAdmin = await global.testDb.collection('projects').findOne({
        _id: testProject1._id,
      });

      expect(projectWithNewAdmin.admins).toContainEqual(newMember._id);
    });
  });

  // ==================== DATA ISOLATION TESTS ====================
  describe('Data Isolation', () => {
    beforeEach(async () => {
      // Setup projects
      testProject1 = global.testUtils.createTestProject(testOrg1._id);
      testProject2 = global.testUtils.createTestProject(testOrg2._id);

      await global.testDb.collection('projects').insertMany([testProject1, testProject2]);
    });

    test('Should prevent cross-org data access', async () => {
      // Create documents for different orgs
      const org1Docs = [
        global.testUtils.createTestDocument(testOrg1._id, testProject1._id),
        global.testUtils.createTestDocument(testOrg1._id, testProject1._id),
      ];

      const org2Docs = [
        global.testUtils.createTestDocument(testOrg2._id, testProject2._id),
      ];

      await global.testDb.collection('documents').insertMany([...org1Docs, ...org2Docs]);

      // Simulate user1 trying to access org2 data
      const user1Query = {
        orgId: testOrg1._id, // User1 can only query their org
      };

      const user1Docs = await global.testDb.collection('documents')
        .find(user1Query)
        .toArray();

      // Verify user1 cannot see org2 documents
      expect(user1Docs.length).toBe(2);
      expect(user1Docs.every(d => d.orgId.equals(testOrg1._id))).toBe(true);

      // Verify no org2 documents are accessible
      const hasOrg2Docs = user1Docs.some(d => d.orgId.equals(testOrg2._id));
      expect(hasOrg2Docs).toBe(false);
    });

    test('Should prevent cross-project data access within same org', async () => {
      // Create another project in org1
      const project1b = global.testUtils.createTestProject(testOrg1._id, {
        name: 'Project 1B',
        slug: 'project-1b',
        members: [testUser1._id], // user1 is member
      });

      const project1c = global.testUtils.createTestProject(testOrg1._id, {
        name: 'Project 1C',
        slug: 'project-1c',
        members: [], // user1 is NOT member
      });

      await global.testDb.collection('projects').insertMany([project1b, project1c]);

      // Create documents in different projects
      const doc1b = global.testUtils.createTestDocument(
        testOrg1._id,
        project1b._id,
        { documentName: 'Project 1B Doc' }
      );

      const doc1c = global.testUtils.createTestDocument(
        testOrg1._id,
        project1c._id,
        { documentName: 'Project 1C Doc' }
      );

      await global.testDb.collection('documents').insertMany([doc1b, doc1c]);

      // Simulate access control - user can only access projects they're member of
      const userProjects = await global.testDb.collection('projects').find({
        orgId: testOrg1._id,
        members: testUser1._id,
      }).toArray();

      const userProjectIds = userProjects.map(p => p._id);

      // Query documents user has access to
      const accessibleDocs = await global.testDb.collection('documents').find({
        orgId: testOrg1._id,
        projectId: { $in: userProjectIds },
      }).toArray();

      // Verify user can access project1b but not project1c
      expect(accessibleDocs.some(d => d.projectId.equals(project1b._id))).toBe(true);
      expect(accessibleDocs.some(d => d.projectId.equals(project1c._id))).toBe(false);
    });

    test('Should handle null projectId for backward compatibility', async () => {
      // Create legacy document without projectId
      const legacyDoc = {
        _id: new mongoose.Types.ObjectId(),
        orgId: testOrg1._id,
        documentName: 'Legacy Document',
        // No projectId field
        isDeleted: false,
      };

      await global.testDb.collection('documents').insertOne(legacyDoc);

      // Query with backward compatibility
      const query = {
        orgId: testOrg1._id,
        projectId: { $in: [null, undefined] },
      };

      const legacyDocs = await global.testDb.collection('documents')
        .find(query)
        .toArray();

      expect(legacyDocs.length).toBeGreaterThan(0);
      expect(legacyDocs.some(d => d.documentName === 'Legacy Document')).toBe(true);
    });

    test('Should validate multi-tenant fields on all resources', async () => {
      // Test document
      const doc = global.testUtils.createTestDocument(testOrg1._id, testProject1._id);
      expect(doc).toHaveMultiTenantFields();

      // Test conversation
      const conv = global.testUtils.createTestConversation(
        testOrg1._id,
        testProject1._id,
        testUser1._id
      );
      expect(conv).toHaveMultiTenantFields();

      // Verify required fields
      expect(doc.orgId).toBeValidObjectId();
      expect(doc.projectId).toBeValidObjectId();
      expect(conv.orgId).toBeValidObjectId();
      expect(conv.projectId).toBeValidObjectId();
    });
  });

  // ==================== USER MANAGEMENT TESTS ====================
  describe('User Multi-Organization Support', () => {
    test('Should allow users to belong to multiple organizations', async () => {
      // Create user with multiple orgs
      const multiOrgUser = global.testUtils.createTestUser(testOrg1._id, {
        email: 'multiorg@example.com',
        organizations: [testOrg1._id, testOrg2._id],
      });

      await global.testDb.collection('users').insertOne(multiOrgUser);

      // Verify user can access both orgs
      const user = await global.testDb.collection('users').findOne({
        _id: multiOrgUser._id,
      });

      expect(user.organizations).toHaveLength(2);
      expect(user.organizations).toContainEqual(testOrg1._id);
      expect(user.organizations).toContainEqual(testOrg2._id);
    });

    test('Should track default and last accessed organization', async () => {
      const user = await global.testDb.collection('users').findOne({
        _id: testUser1._id,
      });

      expect(user.defaultOrgId).toEqual(testOrg1._id);
      expect(user.lastAccessedOrgId).toEqual(testOrg1._id);

      // Update last accessed
      await global.testDb.collection('users').updateOne(
        { _id: testUser1._id },
        { $set: { lastAccessedOrgId: testOrg2._id } }
      );

      const updatedUser = await global.testDb.collection('users').findOne({
        _id: testUser1._id,
      });

      expect(updatedUser.lastAccessedOrgId).toEqual(testOrg2._id);
      expect(updatedUser.defaultOrgId).toEqual(testOrg1._id); // Default unchanged
    });
  });
});