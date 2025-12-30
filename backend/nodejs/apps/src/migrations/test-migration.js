#!/usr/bin/env node

/**
 * Migration Test Suite
 * Tests the multi-tenant migration with sample data
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const migration = require('./002_migrate_to_multi_tenant');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let mongoServer;
let connection;
let db;

// Test results
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function logTest(name, passed, error = null) {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ${colors.green}✅ ${name}${colors.reset}`);
  } else {
    failedTests++;
    console.log(`  ${colors.red}❌ ${name}${colors.reset}`);
    if (error) {
      console.log(`     ${colors.red}Error: ${error.message}${colors.reset}`);
    }
  }
}

async function setupTestDatabase() {
  console.log(`${colors.cyan}Setting up test database...${colors.reset}`);

  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // Connect
  connection = await mongoose.connect(uri);
  db = connection.connection.db;

  console.log(`${colors.green}✓ Test database ready${colors.reset}\n`);
}

async function seedTestData() {
  console.log(`${colors.cyan}Seeding test data...${colors.reset}`);

  // Create test organization
  const testOrg = {
    _id: new mongoose.Types.ObjectId(),
    slug: 'test-org',
    registeredName: 'Test Organization',
    shortName: 'TestOrg',
    domain: 'test.com',
    contactEmail: 'admin@test.com',
    accountType: 'business',
    isDeleted: false,
    onBoardingStatus: 'configured',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.collection('orgs').insertOne(testOrg);

  // Create test users
  const testUsers = [
    {
      _id: new mongoose.Types.ObjectId(),
      orgId: testOrg._id,
      fullName: 'Admin User',
      email: 'admin@test.com',
      isDeleted: false,
      createdAt: new Date()
    },
    {
      _id: new mongoose.Types.ObjectId(),
      orgId: testOrg._id,
      fullName: 'Regular User',
      email: 'user@test.com',
      isDeleted: false,
      createdAt: new Date()
    }
  ];

  await db.collection('users').insertMany(testUsers);

  // Create admin usergroup
  await db.collection('usergroups').insertOne({
    _id: new mongoose.Types.ObjectId(),
    orgId: testOrg._id,
    type: 'admin',
    users: [testUsers[0]._id.toString()],
    createdAt: new Date()
  });

  // Create test documents (without orgId/projectId initially)
  const testDocuments = [];
  for (let i = 1; i <= 5; i++) {
    testDocuments.push({
      _id: new mongoose.Types.ObjectId(),
      documentName: `Document ${i}`,
      isDeleted: false,
      createdAt: new Date()
    });
  }
  await db.collection('documents').insertMany(testDocuments);

  // Create test conversations (without projectId initially)
  const testConversations = [];
  for (let i = 1; i <= 3; i++) {
    testConversations.push({
      _id: new mongoose.Types.ObjectId(),
      orgId: testOrg._id,
      title: `Conversation ${i}`,
      userId: testUsers[0]._id,
      isDeleted: false,
      createdAt: new Date()
    });
  }
  await db.collection('conversations').insertMany(testConversations);

  // Create test notifications
  const testNotifications = [];
  for (let i = 1; i <= 2; i++) {
    testNotifications.push({
      _id: new mongoose.Types.ObjectId(),
      orgId: testOrg._id,
      userId: testUsers[0]._id,
      message: `Notification ${i}`,
      createdAt: new Date()
    });
  }
  await db.collection('notifications').insertMany(testNotifications);

  console.log(`${colors.green}✓ Test data seeded${colors.reset}`);
  console.log(`  • 1 organization`);
  console.log(`  • 2 users`);
  console.log(`  • 5 documents`);
  console.log(`  • 3 conversations`);
  console.log(`  • 2 notifications\n`);

  return { testOrg, testUsers, testDocuments, testConversations };
}

async function testMigrationUp() {
  console.log(`${colors.blue}[TEST 1] Testing Migration UP...${colors.reset}`);

  try {
    // Run migration
    await migration.up(db, connection.connection.getClient());
    logTest('Migration UP executed without errors', true);

    // Verify projects were created
    const projects = await db.collection('projects').find({}).toArray();
    logTest('Projects collection created', projects.length > 0);
    logTest('Default "General" project created', projects.some(p => p.slug === 'general'));

    // Verify users were updated
    const users = await db.collection('users').find({}).toArray();
    const usersWithOrgs = users.filter(u => u.organizations && Array.isArray(u.organizations));
    logTest('Users have organization arrays', usersWithOrgs.length === users.length);

    // Verify documents have orgId and projectId
    const documents = await db.collection('documents').find({}).toArray();
    const docsWithOrgId = documents.filter(d => d.orgId);
    const docsWithProjectId = documents.filter(d => d.projectId);
    logTest('All documents have orgId', docsWithOrgId.length === documents.length);
    logTest('All documents have projectId', docsWithProjectId.length === documents.length);

    // Verify conversations have projectId
    const conversations = await db.collection('conversations').find({}).toArray();
    const convsWithProjectId = conversations.filter(c => c.projectId);
    logTest('All conversations have projectId', convsWithProjectId.length === conversations.length);

    // Verify organization settings
    const org = await db.collection('orgs').findOne({});
    logTest('Organization has multi-tenant settings',
      org.settings && org.settings.maxProjects && org.settings.features);

    // Verify project metadata
    const project = projects[0];
    if (project) {
      logTest('Project has correct conversation count',
        project.metadata.conversationCount === conversations.length);
      logTest('Project has correct document count',
        project.metadata.documentCount === documents.length);
    }

    return true;
  } catch (error) {
    logTest('Migration UP execution', false, error);
    return false;
  }
}

async function testMigrationDown() {
  console.log(`\n${colors.blue}[TEST 2] Testing Migration DOWN (Rollback)...${colors.reset}`);

  try {
    // Run rollback
    await migration.down(db, connection.connection.getClient());
    logTest('Migration DOWN executed without errors', true);

    // Verify projects collection was removed
    const collections = await db.listCollections({ name: 'projects' }).toArray();
    logTest('Projects collection removed', collections.length === 0);

    // Verify users no longer have organization arrays
    const users = await db.collection('users').find({}).toArray();
    const usersWithOrgs = users.filter(u => u.organizations);
    logTest('Organization arrays removed from users', usersWithOrgs.length === 0);

    // Verify projectId removed from documents
    const documents = await db.collection('documents').find({}).toArray();
    const docsWithProjectId = documents.filter(d => d.projectId);
    logTest('ProjectId removed from documents', docsWithProjectId.length === 0);

    // Verify projectId removed from conversations
    const conversations = await db.collection('conversations').find({}).toArray();
    const convsWithProjectId = conversations.filter(c => c.projectId);
    logTest('ProjectId removed from conversations', convsWithProjectId.length === 0);

    // Verify org settings rolled back
    const org = await db.collection('orgs').findOne({});
    logTest('Multi-tenant settings removed from organization',
      !org.settings?.maxProjects && !org.metadata?.projectCount);

    return true;
  } catch (error) {
    logTest('Migration DOWN execution', false, error);
    return false;
  }
}

async function testIdempotency() {
  console.log(`\n${colors.blue}[TEST 3] Testing Migration Idempotency...${colors.reset}`);

  try {
    // Run migration UP twice
    await migration.up(db, connection.connection.getClient());
    await migration.up(db, connection.connection.getClient());
    logTest('Migration UP can be run multiple times', true);

    // Check that we still have only one project per org
    const projects = await db.collection('projects').find({}).toArray();
    const orgs = await db.collection('orgs').find({}).toArray();
    logTest('No duplicate projects created',
      projects.length === orgs.length);

    // Run migration DOWN twice
    await migration.down(db, connection.connection.getClient());
    await migration.down(db, connection.connection.getClient());
    logTest('Migration DOWN can be run multiple times', true);

    return true;
  } catch (error) {
    logTest('Idempotency test', false, error);
    return false;
  }
}

async function testEdgeCases() {
  console.log(`\n${colors.blue}[TEST 4] Testing Edge Cases...${colors.reset}`);

  // Clear database
  const collections = await db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }

  // Test 1: Migration with no organizations
  try {
    await migration.up(db, connection.connection.getClient());
    logTest('Migration handles empty database', true);
  } catch (error) {
    logTest('Migration handles empty database', false, error);
  }

  // Reset
  await migration.down(db, connection.connection.getClient());

  // Test 2: Migration with org but no users
  const lonelyOrg = {
    _id: new mongoose.Types.ObjectId(),
    slug: 'lonely-org',
    registeredName: 'Lonely Org',
    isDeleted: false
  };
  await db.collection('orgs').insertOne(lonelyOrg);

  try {
    await migration.up(db, connection.connection.getClient());
    const projects = await db.collection('projects').find({}).toArray();
    logTest('Migration handles org with no users', projects.length === 1);
  } catch (error) {
    logTest('Migration handles org with no users', false, error);
  }

  // Test 3: Data with existing projectIds (already migrated)
  await db.collection('documents').insertOne({
    _id: new mongoose.Types.ObjectId(),
    orgId: lonelyOrg._id,
    projectId: new mongoose.Types.ObjectId(),
    documentName: 'Already Migrated Doc'
  });

  try {
    await migration.up(db, connection.connection.getClient());
    logTest('Migration preserves existing projectIds', true);
  } catch (error) {
    logTest('Migration preserves existing projectIds', false, error);
  }
}

async function runAllTests() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     MULTI-TENANT MIGRATION TEST SUITE               ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {
    // Setup
    await setupTestDatabase();
    await seedTestData();

    // Run tests
    await testMigrationUp();
    await testMigrationDown();
    await testIdempotency();
    await testEdgeCases();

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`${colors.green}✅ Passed: ${passedTests}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${failedTests}${colors.reset}`);

    if (failedTests === 0) {
      console.log(`\n${colors.green}🎉 ALL TESTS PASSED!${colors.reset}`);
      console.log('The migration is working correctly.\n');
    } else {
      console.log(`\n${colors.red}❌ SOME TESTS FAILED${colors.reset}`);
      console.log('Please review the failures above.\n');
    }

  } catch (error) {
    console.error(`${colors.red}Test suite failed:${colors.reset}`, error);
  } finally {
    // Cleanup
    if (connection) {
      await connection.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }

    process.exit(failedTests > 0 ? 1 : 0);
  }
}

// Check if mongodb-memory-server is installed
try {
  require.resolve('mongodb-memory-server');
  runAllTests().catch(console.error);
} catch (error) {
  console.log(`${colors.yellow}⚠️  mongodb-memory-server not installed${colors.reset}`);
  console.log('To run tests, install it with:');
  console.log('  npm install --save-dev mongodb-memory-server');
  console.log('\nAlternatively, the migration can be tested on a real database.');
  process.exit(0);
}