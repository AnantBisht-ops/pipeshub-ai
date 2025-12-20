/**
 * Performance Benchmarks for Multi-Tenant System
 * Measures performance improvements with caching
 */

const mongoose = require('mongoose');
const redis = require('redis');
const { performance } = require('perf_hooks');

// Import services (adjust paths as needed)
// const { cachedDataService } = require('../../backend/nodejs/apps/src/services/cached-data.service');
// const { OrganizationModel } = require('../../backend/nodejs/apps/src/modules/organizations/models/organization.model');

// Benchmark results storage
const results = {
  withoutCache: {},
  withCache: {},
  improvement: {},
};

// Test data
const testData = {
  organizations: [],
  projects: [],
  users: [],
  documents: [],
};

// Benchmark configuration
const config = {
  numOrganizations: 10,
  numProjectsPerOrg: 5,
  numUsersPerOrg: 20,
  numDocumentsPerProject: 100,
  numIterations: 100,
  warmupIterations: 10,
};

class PerformanceBenchmark {
  constructor() {
    this.db = null;
    this.redisClient = null;
  }

  async setup() {
    console.log('\n📊 Setting up performance benchmark environment...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/es_benchmark';
    await mongoose.connect(mongoUri);
    this.db = mongoose.connection.db;

    // Connect to Redis
    this.redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    await this.redisClient.connect();

    console.log('✅ Connected to MongoDB and Redis\n');
  }

  async generateTestData() {
    console.log('🔄 Generating test data...');

    // Clear existing data
    await this.clearDatabase();

    // Generate organizations
    for (let i = 0; i < config.numOrganizations; i++) {
      const org = {
        _id: new mongoose.Types.ObjectId(),
        slug: `org-${i}`,
        registeredName: `Organization ${i}`,
        shortName: `Org${i}`,
        settings: {
          maxProjects: 10,
          maxUsers: 100,
          features: ['multi-project', 'advanced-permissions'],
        },
        metadata: {
          projectCount: config.numProjectsPerOrg,
          userCount: config.numUsersPerOrg,
        },
      };

      await this.db.collection('orgs').insertOne(org);
      testData.organizations.push(org);

      // Generate projects for this org
      for (let j = 0; j < config.numProjectsPerOrg; j++) {
        const project = {
          _id: new mongoose.Types.ObjectId(),
          orgId: org._id,
          slug: `project-${i}-${j}`,
          name: `Project ${j}`,
          members: [],
          admins: [],
          metadata: {
            documentCount: config.numDocumentsPerProject,
            conversationCount: 0,
          },
        };

        await this.db.collection('projects').insertOne(project);
        testData.projects.push(project);

        // Generate documents for this project
        const documents = [];
        for (let k = 0; k < config.numDocumentsPerProject; k++) {
          documents.push({
            _id: new mongoose.Types.ObjectId(),
            orgId: org._id,
            projectId: project._id,
            documentName: `Document ${k}`,
            content: `Content for document ${k}`,
            createdAt: new Date(),
          });
        }

        if (documents.length > 0) {
          await this.db.collection('documents').insertMany(documents);
          testData.documents.push(...documents);
        }
      }

      // Generate users for this org
      const users = [];
      for (let j = 0; j < config.numUsersPerOrg; j++) {
        users.push({
          _id: new mongoose.Types.ObjectId(),
          organizations: [org._id],
          defaultOrgId: org._id,
          email: `user${i}-${j}@org${i}.com`,
          fullName: `User ${j} Org ${i}`,
        });
      }

      if (users.length > 0) {
        await this.db.collection('users').insertMany(users);
        testData.users.push(...users);
      }
    }

    console.log(`✅ Generated test data:
  • ${testData.organizations.length} organizations
  • ${testData.projects.length} projects
  • ${testData.users.length} users
  • ${testData.documents.length} documents\n`);
  }

  async clearDatabase() {
    const collections = ['orgs', 'projects', 'users', 'documents', 'conversations'];
    for (const collection of collections) {
      await this.db.collection(collection).deleteMany({});
    }
    await this.redisClient.flushDb();
  }

  // ================= BENCHMARK TESTS =================

  async benchmarkOrganizationFetch() {
    console.log('\n📈 Benchmarking Organization Fetch...');

    const orgId = testData.organizations[0]._id;
    const iterations = config.numIterations;

    // Without cache
    await this.redisClient.flushDb();
    const withoutCacheStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      await this.db.collection('orgs').findOne({ _id: orgId });
    }

    const withoutCacheEnd = performance.now();
    const withoutCacheTime = withoutCacheEnd - withoutCacheStart;

    // With cache (first iteration populates cache)
    const withCacheStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      const cached = await this.redisClient.get(`org:${orgId}`);
      if (!cached) {
        const org = await this.db.collection('orgs').findOne({ _id: orgId });
        await this.redisClient.setEx(`org:${orgId}`, 3600, JSON.stringify(org));
      }
    }

    const withCacheEnd = performance.now();
    const withCacheTime = withCacheEnd - withCacheStart;

    results.withoutCache.organizationFetch = withoutCacheTime;
    results.withCache.organizationFetch = withCacheTime;
    results.improvement.organizationFetch =
      ((withoutCacheTime - withCacheTime) / withoutCacheTime * 100).toFixed(2);

    console.log(`  Without cache: ${withoutCacheTime.toFixed(2)}ms`);
    console.log(`  With cache: ${withCacheTime.toFixed(2)}ms`);
    console.log(`  Improvement: ${results.improvement.organizationFetch}%`);
  }

  async benchmarkProjectList() {
    console.log('\n📈 Benchmarking Project List Fetch...');

    const orgId = testData.organizations[0]._id;
    const iterations = config.numIterations;

    // Without cache
    await this.redisClient.flushDb();
    const withoutCacheStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      await this.db.collection('projects').find({ orgId: orgId }).toArray();
    }

    const withoutCacheEnd = performance.now();
    const withoutCacheTime = withoutCacheEnd - withoutCacheStart;

    // With cache
    const withCacheStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      const cacheKey = `projects:${orgId}`;
      const cached = await this.redisClient.get(cacheKey);

      if (!cached) {
        const projects = await this.db.collection('projects').find({ orgId: orgId }).toArray();
        await this.redisClient.setEx(cacheKey, 3600, JSON.stringify(projects));
      }
    }

    const withCacheEnd = performance.now();
    const withCacheTime = withCacheEnd - withCacheStart;

    results.withoutCache.projectList = withoutCacheTime;
    results.withCache.projectList = withCacheTime;
    results.improvement.projectList =
      ((withoutCacheTime - withCacheTime) / withoutCacheTime * 100).toFixed(2);

    console.log(`  Without cache: ${withoutCacheTime.toFixed(2)}ms`);
    console.log(`  With cache: ${withCacheTime.toFixed(2)}ms`);
    console.log(`  Improvement: ${results.improvement.projectList}%`);
  }

  async benchmarkUserPermissions() {
    console.log('\n📈 Benchmarking User Permissions Check...');

    const userId = testData.users[0]._id;
    const orgId = testData.organizations[0]._id;
    const projectId = testData.projects[0]._id;
    const iterations = config.numIterations;

    // Without cache (complex permission calculation)
    await this.redisClient.flushDb();
    const withoutCacheStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      // Simulate permission calculation
      const user = await this.db.collection('users').findOne({ _id: userId });
      const org = await this.db.collection('orgs').findOne({ _id: orgId });
      const project = await this.db.collection('projects').findOne({ _id: projectId });

      // Permission logic
      const isOrgAdmin = org.admins?.includes(userId);
      const isProjectAdmin = project.admins?.includes(userId);
      const isProjectMember = project.members?.includes(userId);
    }

    const withoutCacheEnd = performance.now();
    const withoutCacheTime = withoutCacheEnd - withoutCacheStart;

    // With cache
    const withCacheStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      const cacheKey = `perms:${userId}:${orgId}:${projectId}`;
      const cached = await this.redisClient.get(cacheKey);

      if (!cached) {
        // Calculate once and cache
        const user = await this.db.collection('users').findOne({ _id: userId });
        const org = await this.db.collection('orgs').findOne({ _id: orgId });
        const project = await this.db.collection('projects').findOne({ _id: projectId });

        const permissions = {
          isOrgAdmin: org.admins?.includes(userId),
          isProjectAdmin: project.admins?.includes(userId),
          isProjectMember: project.members?.includes(userId),
        };

        await this.redisClient.setEx(cacheKey, 1800, JSON.stringify(permissions));
      }
    }

    const withCacheEnd = performance.now();
    const withCacheTime = withCacheEnd - withCacheStart;

    results.withoutCache.permissions = withoutCacheTime;
    results.withCache.permissions = withCacheTime;
    results.improvement.permissions =
      ((withoutCacheTime - withCacheTime) / withoutCacheTime * 100).toFixed(2);

    console.log(`  Without cache: ${withoutCacheTime.toFixed(2)}ms`);
    console.log(`  With cache: ${withCacheTime.toFixed(2)}ms`);
    console.log(`  Improvement: ${results.improvement.permissions}%`);
  }

  async benchmarkDocumentQuery() {
    console.log('\n📈 Benchmarking Document Query with Project Filter...');

    const projectId = testData.projects[0]._id;
    const iterations = config.numIterations / 10; // Fewer iterations for heavy queries

    // Without cache
    await this.redisClient.flushDb();
    const withoutCacheStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      await this.db.collection('documents')
        .find({ projectId: projectId })
        .limit(50)
        .toArray();
    }

    const withoutCacheEnd = performance.now();
    const withoutCacheTime = withoutCacheEnd - withoutCacheStart;

    // With cache
    const withCacheStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      const cacheKey = `docs:${projectId}:50`;
      const cached = await this.redisClient.get(cacheKey);

      if (!cached) {
        const docs = await this.db.collection('documents')
          .find({ projectId: projectId })
          .limit(50)
          .toArray();
        await this.redisClient.setEx(cacheKey, 600, JSON.stringify(docs));
      }
    }

    const withCacheEnd = performance.now();
    const withCacheTime = withCacheEnd - withCacheStart;

    results.withoutCache.documentQuery = withoutCacheTime;
    results.withCache.documentQuery = withCacheTime;
    results.improvement.documentQuery =
      ((withoutCacheTime - withCacheTime) / withoutCacheTime * 100).toFixed(2);

    console.log(`  Without cache: ${withoutCacheTime.toFixed(2)}ms`);
    console.log(`  With cache: ${withCacheTime.toFixed(2)}ms`);
    console.log(`  Improvement: ${results.improvement.documentQuery}%`);
  }

  async benchmarkConcurrentAccess() {
    console.log('\n📈 Benchmarking Concurrent Access...');

    const numConcurrentUsers = 10;
    const requestsPerUser = 10;

    // Without cache
    await this.redisClient.flushDb();
    const withoutCacheStart = performance.now();

    const withoutCachePromises = [];
    for (let user = 0; user < numConcurrentUsers; user++) {
      for (let req = 0; req < requestsPerUser; req++) {
        const orgId = testData.organizations[user % testData.organizations.length]._id;
        withoutCachePromises.push(
          this.db.collection('orgs').findOne({ _id: orgId })
        );
      }
    }
    await Promise.all(withoutCachePromises);

    const withoutCacheEnd = performance.now();
    const withoutCacheTime = withoutCacheEnd - withoutCacheStart;

    // With cache
    const withCacheStart = performance.now();

    const withCachePromises = [];
    for (let user = 0; user < numConcurrentUsers; user++) {
      for (let req = 0; req < requestsPerUser; req++) {
        const orgId = testData.organizations[user % testData.organizations.length]._id;
        withCachePromises.push(
          (async () => {
            const cached = await this.redisClient.get(`org:${orgId}`);
            if (!cached) {
              const org = await this.db.collection('orgs').findOne({ _id: orgId });
              await this.redisClient.setEx(`org:${orgId}`, 3600, JSON.stringify(org));
            }
          })()
        );
      }
    }
    await Promise.all(withCachePromises);

    const withCacheEnd = performance.now();
    const withCacheTime = withCacheEnd - withCacheStart;

    results.withoutCache.concurrent = withoutCacheTime;
    results.withCache.concurrent = withCacheTime;
    results.improvement.concurrent =
      ((withoutCacheTime - withCacheTime) / withoutCacheTime * 100).toFixed(2);

    console.log(`  Without cache: ${withoutCacheTime.toFixed(2)}ms`);
    console.log(`  With cache: ${withCacheTime.toFixed(2)}ms`);
    console.log(`  Improvement: ${results.improvement.concurrent}%`);
  }

  async runMemoryAnalysis() {
    console.log('\n📊 Memory Usage Analysis...');

    // Get Redis memory usage
    const redisInfo = await this.redisClient.info('memory');
    const usedMemory = redisInfo.match(/used_memory_human:(.+)/)?.[1];

    // Get cache key count
    const dbSize = await this.redisClient.dbSize();

    console.log(`  Redis memory usage: ${usedMemory || 'N/A'}`);
    console.log(`  Total cached keys: ${dbSize}`);

    // Calculate average memory per key
    if (dbSize > 0 && usedMemory) {
      const memoryBytes = parseInt(redisInfo.match(/used_memory:(\d+)/)?.[1] || '0');
      const avgPerKey = (memoryBytes / dbSize / 1024).toFixed(2);
      console.log(`  Average memory per key: ${avgPerKey}KB`);
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');

    await this.clearDatabase();
    await mongoose.disconnect();
    await this.redisClient.disconnect();

    console.log('✅ Cleanup complete\n');
  }

  printSummary() {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║          PERFORMANCE BENCHMARK SUMMARY              ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('\n📊 Test Configuration:');
    console.log(`  Organizations: ${config.numOrganizations}`);
    console.log(`  Projects per org: ${config.numProjectsPerOrg}`);
    console.log(`  Users per org: ${config.numUsersPerOrg}`);
    console.log(`  Documents per project: ${config.numDocumentsPerProject}`);
    console.log(`  Test iterations: ${config.numIterations}`);

    console.log('\n⚡ Performance Results:');
    console.log('');
    console.log('  Operation               | No Cache  | With Cache | Improvement');
    console.log('  ----------------------- | --------- | ---------- | -----------');

    const operations = [
      ['Organization Fetch', 'organizationFetch'],
      ['Project List', 'projectList'],
      ['User Permissions', 'permissions'],
      ['Document Query', 'documentQuery'],
      ['Concurrent Access', 'concurrent'],
    ];

    for (const [name, key] of operations) {
      const noCache = (results.withoutCache[key] || 0).toFixed(2);
      const withCache = (results.withCache[key] || 0).toFixed(2);
      const improvement = results.improvement[key] || '0.00';

      console.log(
        `  ${name.padEnd(23)} | ${noCache.padStart(7)}ms | ${withCache.padStart(8)}ms | ${improvement.padStart(9)}%`
      );
    }

    // Calculate average improvement
    const improvements = Object.values(results.improvement).map(v => parseFloat(v));
    const avgImprovement = (
      improvements.reduce((a, b) => a + b, 0) / improvements.length
    ).toFixed(2);

    console.log('\n📈 Overall Performance:');
    console.log(`  Average improvement with caching: ${avgImprovement}%`);

    if (parseFloat(avgImprovement) > 50) {
      console.log(`  🎉 Excellent performance gain!`);
    } else if (parseFloat(avgImprovement) > 30) {
      console.log(`  ✅ Good performance improvement`);
    } else {
      console.log(`  ⚠️  Moderate improvement - consider optimization`);
    }

    console.log('\n💡 Recommendations:');

    if (results.improvement.permissions > 70) {
      console.log('  • Permission caching is highly effective - ensure proper invalidation');
    }

    if (results.improvement.documentQuery < 30) {
      console.log('  • Consider indexing projectId field for better query performance');
    }

    if (results.improvement.concurrent > 60) {
      console.log('  • Caching significantly helps with concurrent access patterns');
    }

    console.log('\n');
  }

  async run() {
    try {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════╗');
      console.log('║       MULTI-TENANT PERFORMANCE BENCHMARK            ║');
      console.log('╚══════════════════════════════════════════════════════╝');

      await this.setup();
      await this.generateTestData();

      // Run benchmarks
      await this.benchmarkOrganizationFetch();
      await this.benchmarkProjectList();
      await this.benchmarkUserPermissions();
      await this.benchmarkDocumentQuery();
      await this.benchmarkConcurrentAccess();
      await this.runMemoryAnalysis();

      this.printSummary();

      await this.cleanup();
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Run benchmark if executed directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.run().catch(console.error);
}

module.exports = PerformanceBenchmark;