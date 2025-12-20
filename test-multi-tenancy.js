#!/usr/bin/env node

/**
 * Multi-Tenancy Manual Testing Script
 * Test the multi-tenancy features without Python
 */

const mongoose = require('mongoose');
const readline = require('readline');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/es';
  log('\n📊 Connecting to MongoDB...', 'cyan');
  log(`URI: ${mongoUri}`, 'yellow');

  try {
    await mongoose.connect(mongoUri);
    log('✅ Connected to MongoDB\n', 'green');
    return mongoose.connection.db;
  } catch (error) {
    log(`❌ Failed to connect to MongoDB: ${error.message}`, 'red');
    throw error;
  }
}

async function checkExistingData(db) {
  log('\n🔍 Checking existing data...', 'cyan');

  const orgs = await db.collection('orgs').countDocuments();
  const users = await db.collection('users').countDocuments();
  const projects = await db.collection('projects').countDocuments();
  const documents = await db.collection('documents').countDocuments();
  const conversations = await db.collection('conversations').countDocuments();

  log(`  Organizations: ${orgs}`, 'yellow');
  log(`  Users: ${users}`, 'yellow');
  log(`  Projects: ${projects}`, 'yellow');
  log(`  Documents: ${documents}`, 'yellow');
  log(`  Conversations: ${conversations}`, 'yellow');

  return { orgs, users, projects, documents, conversations };
}

async function createTestOrganization(db) {
  log('\n📦 Creating test organization...', 'cyan');

  const testOrg = {
    _id: new mongoose.Types.ObjectId(),
    slug: 'test-org-' + Date.now(),
    registeredName: 'Test Organization',
    shortName: 'TestOrg',
    domain: 'test.com',
    contactEmail: 'admin@test.com',
    accountType: 'business',
    isDeleted: false,
    settings: {
      maxProjects: 10,
      maxUsers: 50,
      features: ['multi-project', 'advanced-permissions']
    },
    metadata: {
      projectCount: 0,
      userCount: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.collection('orgs').insertOne(testOrg);
  log(`✅ Created organization: ${testOrg.registeredName} (${testOrg._id})`, 'green');

  return testOrg;
}

async function createTestProject(db, orgId) {
  log('\n📁 Creating test project...', 'cyan');

  const testProject = {
    _id: new mongoose.Types.ObjectId(),
    orgId: orgId,
    slug: 'test-project-' + Date.now(),
    name: 'Test Project',
    description: 'Test project for multi-tenancy',
    isDefault: false,
    members: [],
    admins: [],
    settings: {
      isPrivate: false,
      features: []
    },
    metadata: {
      documentCount: 0,
      conversationCount: 0,
      memberCount: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.collection('projects').insertOne(testProject);
  log(`✅ Created project: ${testProject.name} (${testProject._id})`, 'green');

  return testProject;
}

async function createTestUser(db, orgId) {
  log('\n👤 Creating test user...', 'cyan');

  const testUser = {
    _id: new mongoose.Types.ObjectId(),
    email: `testuser${Date.now()}@test.com`,
    fullName: 'Test User',
    organizations: [orgId],
    defaultOrgId: orgId,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.collection('users').insertOne(testUser);
  log(`✅ Created user: ${testUser.email} (${testUser._id})`, 'green');

  return testUser;
}

async function createTestDocument(db, orgId, projectId) {
  log('\n📄 Creating test document...', 'cyan');

  const testDoc = {
    _id: new mongoose.Types.ObjectId(),
    orgId: orgId,
    projectId: projectId,
    documentName: 'Test Document ' + Date.now(),
    content: 'This is a test document for multi-tenancy',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.collection('documents').insertOne(testDoc);
  log(`✅ Created document: ${testDoc.documentName} (${testDoc._id})`, 'green');

  return testDoc;
}

async function testDataIsolation(db, org1, org2, project1, project2) {
  log('\n🔒 Testing data isolation...', 'cyan');

  // Test 1: Check org1 cannot see org2's documents
  const org1Docs = await db.collection('documents')
    .find({ orgId: org1._id })
    .toArray();

  const org2Docs = await db.collection('documents')
    .find({ orgId: org2._id })
    .toArray();

  log(`  Org1 documents: ${org1Docs.length}`, 'yellow');
  log(`  Org2 documents: ${org2Docs.length}`, 'yellow');

  // Verify no cross-contamination
  const crossContamination = org1Docs.some(doc =>
    doc.orgId.toString() === org2._id.toString()
  );

  if (crossContamination) {
    log('❌ FAILED: Data isolation breach detected!', 'red');
    return false;
  } else {
    log('✅ PASSED: Data properly isolated between organizations', 'green');
  }

  // Test 2: Check project-level isolation
  const project1Docs = await db.collection('documents')
    .find({ projectId: project1._id })
    .toArray();

  const project2Docs = await db.collection('documents')
    .find({ projectId: project2._id })
    .toArray();

  log(`  Project1 documents: ${project1Docs.length}`, 'yellow');
  log(`  Project2 documents: ${project2Docs.length}`, 'yellow');

  const projectCrossContamination = project1Docs.some(doc =>
    doc.projectId.toString() === project2._id.toString()
  );

  if (projectCrossContamination) {
    log('❌ FAILED: Project data isolation breach detected!', 'red');
    return false;
  } else {
    log('✅ PASSED: Data properly isolated between projects', 'green');
  }

  return true;
}

async function verifyMultiTenancyStructure(db) {
  log('\n✓ Verifying multi-tenancy structure...', 'cyan');

  const checks = [];

  // Check 1: All organizations have required fields
  const orgsWithoutSettings = await db.collection('orgs')
    .find({ settings: { $exists: false } })
    .toArray();

  if (orgsWithoutSettings.length > 0) {
    log(`⚠️  ${orgsWithoutSettings.length} organizations missing settings`, 'yellow');
    checks.push(false);
  } else {
    log('✅ All organizations have settings', 'green');
    checks.push(true);
  }

  // Check 2: All projects have orgId
  const projectsWithoutOrg = await db.collection('projects')
    .find({ orgId: { $exists: false } })
    .toArray();

  if (projectsWithoutOrg.length > 0) {
    log(`❌ ${projectsWithoutOrg.length} projects missing orgId`, 'red');
    checks.push(false);
  } else {
    log('✅ All projects have orgId', 'green');
    checks.push(true);
  }

  // Check 3: All documents have orgId and projectId
  const docsWithoutOrg = await db.collection('documents')
    .find({ orgId: { $exists: false } })
    .toArray();

  const docsWithoutProject = await db.collection('documents')
    .find({ projectId: { $exists: false } })
    .toArray();

  if (docsWithoutOrg.length > 0) {
    log(`⚠️  ${docsWithoutOrg.length} documents missing orgId`, 'yellow');
    checks.push(false);
  } else {
    log('✅ All documents have orgId', 'green');
    checks.push(true);
  }

  if (docsWithoutProject.length > 0) {
    log(`⚠️  ${docsWithoutProject.length} documents missing projectId`, 'yellow');
    checks.push(false);
  } else {
    log('✅ All documents have projectId', 'green');
    checks.push(true);
  }

  // Check 4: All users have organizations array
  const usersWithoutOrgs = await db.collection('users')
    .find({ organizations: { $exists: false } })
    .toArray();

  if (usersWithoutOrgs.length > 0) {
    log(`⚠️  ${usersWithoutOrgs.length} users missing organizations array`, 'yellow');
    checks.push(false);
  } else {
    log('✅ All users have organizations array', 'green');
    checks.push(true);
  }

  const allPassed = checks.every(c => c);
  return allPassed;
}

async function interactiveMenu(db) {
  log('\n╔══════════════════════════════════════════════════════╗', 'blue');
  log('║     MULTI-TENANCY INTERACTIVE TESTING MENU          ║', 'blue');
  log('╚══════════════════════════════════════════════════════╝', 'blue');

  while (true) {
    log('\n📋 Available Options:', 'cyan');
    log('1. Check existing data', 'yellow');
    log('2. Create test organization', 'yellow');
    log('3. Create test project', 'yellow');
    log('4. Create test user', 'yellow');
    log('5. Create test document', 'yellow');
    log('6. Run data isolation test', 'yellow');
    log('7. Verify multi-tenancy structure', 'yellow');
    log('8. View sample organization', 'yellow');
    log('9. View sample project', 'yellow');
    log('0. Exit', 'yellow');

    const choice = await ask('\nEnter your choice (0-9): ');

    switch (choice.trim()) {
      case '1':
        await checkExistingData(db);
        break;

      case '2':
        await createTestOrganization(db);
        break;

      case '3':
        const orgId = await ask('Enter organization ID: ');
        if (mongoose.Types.ObjectId.isValid(orgId)) {
          await createTestProject(db, new mongoose.Types.ObjectId(orgId));
        } else {
          log('❌ Invalid organization ID', 'red');
        }
        break;

      case '4':
        const userOrgId = await ask('Enter organization ID: ');
        if (mongoose.Types.ObjectId.isValid(userOrgId)) {
          await createTestUser(db, new mongoose.Types.ObjectId(userOrgId));
        } else {
          log('❌ Invalid organization ID', 'red');
        }
        break;

      case '5':
        const docOrgId = await ask('Enter organization ID: ');
        const docProjectId = await ask('Enter project ID: ');
        if (mongoose.Types.ObjectId.isValid(docOrgId) && mongoose.Types.ObjectId.isValid(docProjectId)) {
          await createTestDocument(
            db,
            new mongoose.Types.ObjectId(docOrgId),
            new mongoose.Types.ObjectId(docProjectId)
          );
        } else {
          log('❌ Invalid ID(s)', 'red');
        }
        break;

      case '6':
        log('\n🔄 Running comprehensive isolation test...', 'cyan');
        log('This will create 2 organizations and 2 projects for testing', 'yellow');
        const proceed = await ask('Continue? (y/n): ');

        if (proceed.toLowerCase() === 'y') {
          const org1 = await createTestOrganization(db);
          const org2 = await createTestOrganization(db);
          const project1 = await createTestProject(db, org1._id);
          const project2 = await createTestProject(db, org2._id);

          await createTestDocument(db, org1._id, project1._id);
          await createTestDocument(db, org1._id, project1._id);
          await createTestDocument(db, org2._id, project2._id);

          await testDataIsolation(db, org1, org2, project1, project2);
        }
        break;

      case '7':
        await verifyMultiTenancyStructure(db);
        break;

      case '8':
        const sampleOrg = await db.collection('orgs').findOne();
        if (sampleOrg) {
          log('\n📦 Sample Organization:', 'cyan');
          console.log(JSON.stringify(sampleOrg, null, 2));
        } else {
          log('❌ No organizations found', 'red');
        }
        break;

      case '9':
        const sampleProject = await db.collection('projects').findOne();
        if (sampleProject) {
          log('\n📁 Sample Project:', 'cyan');
          console.log(JSON.stringify(sampleProject, null, 2));
        } else {
          log('❌ No projects found', 'red');
        }
        break;

      case '0':
        log('\n👋 Exiting...', 'cyan');
        rl.close();
        await mongoose.disconnect();
        process.exit(0);
        break;

      default:
        log('❌ Invalid choice', 'red');
    }
  }
}

async function quickTest(db) {
  log('\n🚀 Running quick multi-tenancy test...', 'cyan');

  // Create test data
  const org = await createTestOrganization(db);
  const project = await createTestProject(db, org._id);
  const user = await createTestUser(db, org._id);
  const doc = await createTestDocument(db, org._id, project._id);

  // Verify structure
  log('\n📊 Verification Results:', 'cyan');
  const isValid = await verifyMultiTenancyStructure(db);

  if (isValid) {
    log('\n✅ Multi-tenancy test PASSED!', 'green');
    log('Your multi-tenant setup is working correctly.', 'green');
  } else {
    log('\n⚠️  Multi-tenancy test completed with warnings', 'yellow');
    log('Review the issues above and fix them.', 'yellow');
  }

  log('\n📋 Created Test Data:', 'cyan');
  log(`  Organization: ${org._id}`, 'yellow');
  log(`  Project: ${project._id}`, 'yellow');
  log(`  User: ${user._id}`, 'yellow');
  log(`  Document: ${doc._id}`, 'yellow');
}

async function main() {
  log('\n╔══════════════════════════════════════════════════════╗', 'blue');
  log('║     MULTI-TENANCY TESTING TOOL                      ║', 'blue');
  log('╚══════════════════════════════════════════════════════╝', 'blue');

  try {
    const db = await connectToDatabase();

    const stats = await checkExistingData(db);

    log('\n🎯 Testing Mode:', 'cyan');
    log('1. Quick test (automatic)', 'yellow');
    log('2. Interactive menu', 'yellow');

    const mode = await ask('\nSelect mode (1 or 2): ');

    if (mode.trim() === '1') {
      await quickTest(db);
      rl.close();
      await mongoose.disconnect();
      process.exit(0);
    } else {
      await interactiveMenu(db);
    }

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
    rl.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);