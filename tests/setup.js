/**
 * Test Environment Setup
 * Configures the test environment for all test suites
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const redis = require('redis-mock');

// Global test variables
global.testDb = null;
global.mongoServer = null;
global.redisClient = null;

// Test utilities
global.testUtils = {
  // Generate random ID
  generateId: () => new mongoose.Types.ObjectId(),

  // Generate test organization
  createTestOrg: (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    slug: `test-org-${Date.now()}`,
    registeredName: 'Test Organization',
    shortName: 'TestOrg',
    domain: 'test.com',
    contactEmail: 'test@example.com',
    accountType: 'business',
    settings: {
      maxProjects: 100,
      maxUsers: 500,
      features: ['multi_project', 'advanced_analytics'],
    },
    metadata: {
      projectCount: 0,
      userCount: 0,
      storageUsed: 0,
    },
    subscription: {
      plan: 'pro',
    },
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // Generate test project
  createTestProject: (orgId, overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    slug: `test-project-${Date.now()}`,
    orgId: orgId,
    name: 'Test Project',
    description: 'Test project description',
    members: [],
    admins: [],
    settings: {
      isPublic: false,
      allowGuestAccess: false,
      defaultPermissions: 'read',
    },
    metadata: {
      conversationCount: 0,
      documentCount: 0,
      lastActivityAt: new Date(),
    },
    createdBy: new mongoose.Types.ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    ...overrides,
  }),

  // Generate test user
  createTestUser: (orgId, overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    email: `test${Date.now()}@example.com`,
    fullName: 'Test User',
    organizations: [orgId],
    defaultOrgId: orgId,
    lastAccessedOrgId: orgId,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // Generate test document
  createTestDocument: (orgId, projectId, overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    orgId: orgId,
    projectId: projectId,
    documentName: `Document ${Date.now()}`,
    documentPath: `/test/path/${Date.now()}.pdf`,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // Generate test conversation
  createTestConversation: (orgId, projectId, userId, overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    orgId: orgId,
    projectId: projectId,
    userId: userId,
    title: `Conversation ${Date.now()}`,
    messages: [],
    isDeleted: false,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};

// Setup before all tests
beforeAll(async () => {
  // Setup in-memory MongoDB
  if (process.env.NODE_ENV === 'test') {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    global.testDb = mongoose.connection.db;
  }

  // Setup Redis mock
  global.redisClient = redis.createClient();

  // Suppress console logs during tests
  if (process.env.SUPPRESS_LOGS === 'true') {
    global.console = {
      ...console,
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Close MongoDB connection
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  // Stop MongoDB server
  if (mongoServer) {
    await mongoServer.stop();
  }

  // Close Redis mock
  if (global.redisClient) {
    global.redisClient.quit();
  }
});

// Reset database between tests
afterEach(async () => {
  if (global.testDb) {
    const collections = await global.testDb.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
});

// Add custom matchers
expect.extend({
  toBeValidObjectId(received) {
    const pass = mongoose.Types.ObjectId.isValid(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid ObjectId`
          : `Expected ${received} to be a valid ObjectId`,
    };
  },

  toHaveMultiTenantFields(received) {
    const hasOrgId = received.orgId !== undefined;
    const hasProjectId = received.projectId !== undefined;
    const pass = hasOrgId && hasProjectId;

    return {
      pass,
      message: () =>
        pass
          ? `Expected object not to have multi-tenant fields`
          : `Expected object to have orgId and projectId fields`,
    };
  },
});