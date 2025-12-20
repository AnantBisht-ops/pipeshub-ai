#!/usr/bin/env node

/**
 * Migration Verification Script
 * Validates that the multi-tenant migration was successful
 */

const mongoose = require('mongoose');
const { Types } = mongoose;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Verification results
let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
let warnings = [];
let errors = [];

function logCheck(name, passed, message = '') {
  totalChecks++;
  if (passed) {
    passedChecks++;
    console.log(`  ${colors.green}✅ ${name}${colors.reset}`);
  } else {
    failedChecks++;
    console.log(`  ${colors.red}❌ ${name}${colors.reset}`);
    if (message) {
      console.log(`     ${colors.red}${message}${colors.reset}`);
      errors.push(`${name}: ${message}`);
    }
  }
}

function logWarning(message) {
  warnings.push(message);
  console.log(`  ${colors.yellow}⚠️  ${message}${colors.reset}`);
}

async function verifyMigration() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║          MULTI-TENANT MIGRATION VERIFICATION        ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {
    // Connect to MongoDB
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/es';
    console.log(`${colors.cyan}Connecting to MongoDB...${colors.reset}`);
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    console.log(`${colors.green}✓ Connected to database${colors.reset}\n`);

    // ================== ORGANIZATION CHECKS ==================
    console.log(`${colors.blue}[1/7] Checking Organizations...${colors.reset}`);

    const orgs = await db.collection('orgs').find({ isDeleted: false }).toArray();
    logCheck('Organizations exist', orgs.length > 0,
      orgs.length === 0 ? 'No organizations found in database' : '');

    for (const org of orgs) {
      const hasSettings = org.settings &&
        org.settings.maxProjects !== undefined &&
        org.settings.maxUsers !== undefined &&
        org.settings.features !== undefined;
      logCheck(`Org "${org.registeredName || org.shortName}" has multi-tenant settings`,
        hasSettings,
        !hasSettings ? 'Missing settings.maxProjects, maxUsers, or features' : '');

      const hasMetadata = org.metadata &&
        org.metadata.projectCount !== undefined &&
        org.metadata.userCount !== undefined;
      logCheck(`Org "${org.registeredName || org.shortName}" has metadata`,
        hasMetadata,
        !hasMetadata ? 'Missing metadata.projectCount or userCount' : '');
    }

    // ================== PROJECT CHECKS ==================
    console.log(`\n${colors.blue}[2/7] Checking Projects...${colors.reset}`);

    const projects = await db.collection('projects').find({}).toArray();
    logCheck('Projects collection exists and has documents', projects.length > 0,
      projects.length === 0 ? 'No projects found - migration may have failed' : '');

    // Check each org has at least one project
    for (const org of orgs) {
      const orgProjects = projects.filter(p =>
        p.orgId && p.orgId.toString() === org._id.toString()
      );
      logCheck(`Org "${org.registeredName || org.shortName}" has at least one project`,
        orgProjects.length > 0,
        orgProjects.length === 0 ? 'Organization has no projects' : '');

      // Check for default "General" project
      const hasGeneralProject = orgProjects.some(p => p.slug === 'general');
      if (!hasGeneralProject) {
        logWarning(`Org "${org.registeredName || org.shortName}" missing default "General" project`);
      }
    }

    // Validate project structure
    for (const project of projects.slice(0, 3)) { // Check first 3 projects
      const hasRequiredFields = project.slug &&
        project.orgId &&
        project.name &&
        project.settings &&
        project.metadata;
      logCheck(`Project "${project.name}" has required fields`,
        hasRequiredFields,
        !hasRequiredFields ? 'Missing required fields' : '');
    }

    // ================== USER CHECKS ==================
    console.log(`\n${colors.blue}[3/7] Checking Users...${colors.reset}`);

    const users = await db.collection('users').find({ isDeleted: false }).toArray();
    const migratedUsers = users.filter(u => u.organizations && Array.isArray(u.organizations));

    logCheck('Users have organization arrays',
      migratedUsers.length > 0,
      migratedUsers.length === 0 ? 'No users with organization arrays found' : '');

    const usersWithDefaults = users.filter(u => u.defaultOrgId);
    logCheck('Users have default organization',
      usersWithDefaults.length > 0,
      usersWithDefaults.length === 0 ? 'No users with defaultOrgId' : '');

    // Sample check on first few users
    for (const user of users.slice(0, 5)) {
      if (user.orgId && (!user.organizations || !user.organizations.includes(user.orgId))) {
        logWarning(`User ${user.email || user._id} orgId not in organizations array`);
      }
    }

    // ================== DOCUMENT CHECKS ==================
    console.log(`\n${colors.blue}[4/7] Checking Documents...${colors.reset}`);

    const documents = await db.collection('documents').find({ isDeleted: false }).limit(100).toArray();

    const docsWithOrgId = documents.filter(d => d.orgId);
    logCheck('Documents have orgId',
      docsWithOrgId.length === documents.length,
      `${documents.length - docsWithOrgId.length} documents missing orgId`);

    const docsWithProjectId = documents.filter(d => d.projectId);
    logCheck('Documents have projectId',
      docsWithProjectId.length === documents.length,
      `${documents.length - docsWithProjectId.length} documents missing projectId`);

    // ================== CONVERSATION CHECKS ==================
    console.log(`\n${colors.blue}[5/7] Checking Conversations...${colors.reset}`);

    const conversations = await db.collection('conversations')
      .find({ isDeleted: false })
      .limit(100)
      .toArray();

    if (conversations.length > 0) {
      const convsWithOrgId = conversations.filter(c => c.orgId);
      logCheck('Conversations have orgId',
        convsWithOrgId.length === conversations.length,
        `${conversations.length - convsWithOrgId.length} conversations missing orgId`);

      const convsWithProjectId = conversations.filter(c => c.projectId);
      logCheck('Conversations have projectId',
        convsWithProjectId.length === conversations.length,
        `${conversations.length - convsWithProjectId.length} conversations missing projectId`);
    } else {
      console.log(`  ${colors.cyan}ℹ️  No conversations to verify${colors.reset}`);
    }

    // ================== OTHER COLLECTIONS CHECKS ==================
    console.log(`\n${colors.blue}[6/7] Checking Other Collections...${colors.reset}`);

    const collectionsToCheck = [
      'agentconversations',
      'search',
      'citations',
      'notifications'
    ];

    for (const collName of collectionsToCheck) {
      try {
        const collection = await db.collection(collName)
          .find({})
          .limit(10)
          .toArray();

        if (collection.length > 0) {
          const withProjectId = collection.filter(doc => doc.projectId);
          const percentage = (withProjectId.length / collection.length) * 100;

          if (percentage === 100) {
            logCheck(`${collName} have projectId`, true);
          } else if (percentage > 0) {
            logWarning(`${collName}: Only ${percentage.toFixed(0)}% have projectId`);
          } else {
            logCheck(`${collName} have projectId`, false,
              'No documents have projectId');
          }
        } else {
          console.log(`  ${colors.cyan}ℹ️  No ${collName} to verify${colors.reset}`);
        }
      } catch (err) {
        console.log(`  ${colors.cyan}ℹ️  Collection ${collName} not found${colors.reset}`);
      }
    }

    // ================== DATA INTEGRITY CHECKS ==================
    console.log(`\n${colors.blue}[7/7] Checking Data Integrity...${colors.reset}`);

    // Check that all projectIds reference valid projects
    const projectIds = projects.map(p => p._id.toString());
    let invalidProjectRefs = 0;

    // Sample check on documents
    for (const doc of documents.slice(0, 20)) {
      if (doc.projectId && !projectIds.includes(doc.projectId.toString())) {
        invalidProjectRefs++;
      }
    }

    logCheck('Document projectIds reference valid projects',
      invalidProjectRefs === 0,
      invalidProjectRefs > 0 ? `${invalidProjectRefs} documents reference invalid projects` : '');

    // Check project member consistency
    for (const project of projects.slice(0, 5)) {
      if (project.members && project.admins) {
        const adminsNotInMembers = project.admins.filter(admin =>
          !project.members.some(member => member.toString() === admin.toString())
        );
        if (adminsNotInMembers.length > 0) {
          logWarning(`Project "${project.name}": ${adminsNotInMembers.length} admins not in members list`);
        }
      }
    }

    // ================== SUMMARY ==================
    console.log('\n' + '═'.repeat(60));
    console.log('VERIFICATION SUMMARY');
    console.log('═'.repeat(60));

    console.log(`\n📊 Results:`);
    console.log(`  Total Checks: ${totalChecks}`);
    console.log(`  ${colors.green}✅ Passed: ${passedChecks}${colors.reset}`);
    console.log(`  ${colors.red}❌ Failed: ${failedChecks}${colors.reset}`);
    console.log(`  ${colors.yellow}⚠️  Warnings: ${warnings.length}${colors.reset}`);

    if (failedChecks === 0) {
      console.log(`\n${colors.green}🎉 VERIFICATION PASSED!${colors.reset}`);
      console.log('The migration appears to have completed successfully.');

      if (warnings.length > 0) {
        console.log(`\n${colors.yellow}⚠️  However, there are ${warnings.length} warnings to review:${colors.reset}`);
        warnings.slice(0, 5).forEach(w => console.log(`  • ${w}`));
        if (warnings.length > 5) {
          console.log(`  ... and ${warnings.length - 5} more warnings`);
        }
      }
    } else {
      console.log(`\n${colors.red}❌ VERIFICATION FAILED!${colors.reset}`);
      console.log('The migration may not have completed successfully.');
      console.log('\nErrors found:');
      errors.forEach(e => console.log(`  • ${e}`));

      console.log('\n📝 Recommended Actions:');
      console.log('  1. Review the errors above');
      console.log('  2. Check migration logs for details');
      console.log('  3. Consider restoring from backup and re-running');
      console.log('  4. Restore command: cd backups/latest && ./restore.sh');
    }

    console.log('\n' + '═'.repeat(60) + '\n');

    // Disconnect
    await mongoose.disconnect();

    // Exit with appropriate code
    process.exit(failedChecks > 0 ? 1 : 0);

  } catch (error) {
    console.error(`\n${colors.red}❌ Verification script failed:${colors.reset}`, error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run verification
verifyMigration().catch(console.error);