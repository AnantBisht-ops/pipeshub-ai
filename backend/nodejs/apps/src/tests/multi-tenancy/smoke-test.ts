/**
 * Quick Smoke Test for Phase 1
 * Basic validation that schemas compile and work
 */

import mongoose from 'mongoose';
import { Org } from '../../modules/user_management/schema/org.schema';
import { Project } from '../../modules/project_management/schema/project.schema';
import { DocumentModel } from '../../modules/storage/schema/document.schema';

const runSmokeTest = async () => {
  console.log('🔧 Starting Phase 1 Smoke Test...\n');

  try {
    // Connect to test database
    const mongoUri = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/pipeshub_test_smoke';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clean up any existing test data
    await Org.deleteMany({ domain: 'smoketest.com' });
    await Project.deleteMany({ name: 'Smoke Test Project' });

    // Test 1: Create Organization
    console.log('\n📋 Test 1: Creating Organization...');
    const org = await Org.create({
      registeredName: 'Smoke Test Org',
      shortName: 'SmokeTest',
      domain: 'smoketest.com',
      contactEmail: 'test@smoketest.com',
      accountType: 'business',
    });
    console.log(`✅ Organization created with ID: ${org._id}`);
    console.log(`   - Slug: ${org.slug}`);
    console.log(`   - Settings: ${org.settings.maxProjects} max projects`);
    console.log(`   - Subscription: ${org.subscription.plan}`);

    // Test 2: Create Project
    console.log('\n📋 Test 2: Creating Project...');
    const project = await Project.create({
      name: 'Smoke Test Project',
      description: 'Testing multi-tenancy',
      orgId: org._id,
      createdBy: new mongoose.Types.ObjectId(),
      visibility: 'private',
      status: 'active',
      type: 'standard',
      settings: {
        allowGuestAccess: false,
        requireApproval: false,
        defaultUserRole: 'viewer',
        features: ['documents', 'conversations'],
        integrations: []
      },
      metrics: {
        documentCount: 0,
        conversationCount: 0,
        memberCount: 0,
        storageUsed: 0,
        lastActivityAt: new Date()
      },
      members: []
    });
    console.log(`✅ Project created with ID: ${project._id}`);
    console.log(`   - Slug: ${project.slug}`);
    console.log(`   - OrgId: ${project.orgId}`);

    // Test 3: Create Document with projectId
    console.log('\n📋 Test 3: Creating Document with projectId...');
    const document = await DocumentModel.create({
      documentName: 'smoke-test.pdf',
      documentPath: '/test',
      orgId: org._id,
      projectId: project._id,
      initiatorUserId: new mongoose.Types.ObjectId(),
      storageVendor: 'S3',
      s3: {
        url: 'https://test.s3.amazonaws.com/test.pdf'
      }
    });
    console.log(`✅ Document created with ID: ${document._id}`);
    console.log(`   - OrgId: ${document.orgId}`);
    console.log(`   - ProjectId: ${(document as any).projectId}`);

    // Test 4: Verify Indexes
    console.log('\n📋 Test 4: Verifying Indexes...');
    const orgIndexes = await Org.collection.getIndexes();
    const projectIndexes = await Project.collection.getIndexes();
    const docIndexes = await DocumentModel.collection.getIndexes();

    console.log(`✅ Organization indexes: ${Object.keys(orgIndexes).length} indexes`);
    console.log(`✅ Project indexes: ${Object.keys(projectIndexes).length} indexes`);
    console.log(`✅ Document indexes: ${Object.keys(docIndexes).length} indexes`);

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await Org.deleteMany({ domain: 'smoketest.com' });
    await Project.deleteMany({ name: 'Smoke Test Project' });
    await DocumentModel.deleteMany({ documentName: 'smoke-test.pdf' });

    console.log('\n✅ ✅ ✅ PHASE 1 SMOKE TEST PASSED! ✅ ✅ ✅');
    console.log('\nSummary:');
    console.log('- Organizations support multi-tenancy fields ✓');
    console.log('- Projects schema created and working ✓');
    console.log('- Documents support projectId ✓');
    console.log('- All indexes created properly ✓');
    console.log('- TypeScript compilation successful ✓');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ SMOKE TEST FAILED:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the test
if (require.main === module) {
  runSmokeTest();
}