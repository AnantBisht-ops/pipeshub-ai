/**
 * Migration: Convert Single-Tenant to Multi-Tenant Architecture
 *
 * This migration:
 * 1. Creates a default project for existing organization
 * 2. Updates all users to have organization arrays
 * 3. Adds orgId to documents without it
 * 4. Adds projectId to all relevant collections
 * 5. Updates organization settings for multi-tenancy
 */

const { Types } = require('mongoose');

module.exports = {
  async up(db, client) {
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        console.log('🚀 Starting multi-tenant migration...');
        console.log('=' .repeat(60));

        // Step 1: Get the existing organization
        console.log('\n📋 Step 1: Finding existing organization...');
        const orgs = await db.collection('orgs').find({ isDeleted: false }).toArray();

        if (!orgs || orgs.length === 0) {
          console.log('⚠️  No organization found, skipping migration');
          return;
        }

        console.log(`✅ Found ${orgs.length} organization(s)`);

        let totalMigrations = {
          projects: 0,
          users: 0,
          documents: 0,
          conversations: 0,
          agentconversations: 0,
          search: 0,
          citations: 0,
          notifications: 0
        };

        // Process each organization
        for (const org of orgs) {
          const orgId = org._id;
          console.log(`\n🏢 Processing organization: ${org.registeredName || org.shortName || 'Unnamed'} (${orgId})`);
          console.log('-'.repeat(60));

          // Step 2: Create default project for this org
          console.log('📁 Step 2: Creating default project...');

          // Check if default project already exists
          const existingProject = await db.collection('projects').findOne({
            orgId: orgId,
            slug: 'general'
          });

          let defaultProject;
          if (existingProject) {
            console.log('  ℹ️  Default project already exists');
            defaultProject = existingProject;
          } else {
            defaultProject = {
              _id: new Types.ObjectId(),
              slug: 'general',
              orgId: orgId,
              name: 'General',
              description: 'Default project for migrated data',
              members: [],
              admins: [],
              settings: {
                isPublic: false,
                allowGuestAccess: false,
                defaultPermissions: 'read'
              },
              metadata: {
                conversationCount: 0,
                documentCount: 0,
                lastActivityAt: new Date()
              },
              createdBy: org.createdBy || org.admins?.[0] || null,
              createdAt: new Date(),
              updatedAt: new Date(),
              isDeleted: false
            };

            await db.collection('projects').insertOne(defaultProject);
            console.log(`  ✅ Created default project: ${defaultProject.name}`);
            totalMigrations.projects++;
          }

          // Step 3: Update all users to have organization array
          console.log('\n👤 Step 3: Updating users with organization arrays...');

          // Find users belonging to this org
          const users = await db.collection('users').find({
            orgId: orgId,
            organizations: { $exists: false } // Only update users not yet migrated
          }).toArray();

          if (users.length > 0) {
            // Get all admins for this org
            const adminUsers = await db.collection('usergroups').findOne({
              orgId: orgId,
              type: 'admin'
            });
            const adminUserIds = adminUsers?.users || [];

            for (const user of users) {
              // Add user to default project members
              if (!defaultProject.members.some(m => m.toString() === user._id.toString())) {
                await db.collection('projects').updateOne(
                  { _id: defaultProject._id },
                  {
                    $addToSet: {
                      members: user._id,
                      ...(adminUserIds.includes(user._id.toString()) && { admins: user._id })
                    }
                  }
                );
              }

              // Update user with organization array
              await db.collection('users').updateOne(
                { _id: user._id },
                {
                  $set: {
                    organizations: [orgId],
                    defaultOrgId: orgId,
                    lastAccessedOrgId: orgId
                  }
                }
              );
              totalMigrations.users++;
            }
            console.log(`  ✅ Updated ${users.length} users`);
          } else {
            console.log('  ℹ️  No users need updating');
          }

          // Step 4: Add orgId to documents collection where missing
          console.log('\n📄 Step 4: Updating documents with orgId and projectId...');

          // First, add orgId to documents that don't have it
          const docsWithoutOrgId = await db.collection('documents').updateMany(
            {
              orgId: { $exists: false },
              isDeleted: false
            },
            {
              $set: {
                orgId: orgId
              }
            }
          );

          // Then add projectId to documents with this orgId
          const docsToUpdate = await db.collection('documents').updateMany(
            {
              orgId: orgId,
              projectId: { $exists: false }
            },
            {
              $set: {
                projectId: defaultProject._id
              }
            }
          );

          const documentsUpdated = docsWithoutOrgId.modifiedCount + docsToUpdate.modifiedCount;
          totalMigrations.documents += documentsUpdated;
          console.log(`  ✅ Updated ${documentsUpdated} documents`);

          // Step 5: Add projectId to all relevant collections
          console.log('\n🗂️ Step 5: Updating all collections with projectId...');

          const collections = [
            { name: 'conversations', field: 'conversations' },
            { name: 'agentconversations', field: 'agentconversations' },
            { name: 'search', field: 'search' },
            { name: 'citations', field: 'citations' },
            { name: 'notifications', field: 'notifications' }
          ];

          for (const collection of collections) {
            // First ensure all records have orgId
            const addOrgId = await db.collection(collection.name).updateMany(
              {
                orgId: { $exists: false },
                isDeleted: { $ne: true }
              },
              {
                $set: { orgId: orgId }
              }
            );

            // Then add projectId to records with this orgId
            const result = await db.collection(collection.name).updateMany(
              {
                orgId: orgId,
                projectId: { $exists: false }
              },
              {
                $set: { projectId: defaultProject._id }
              }
            );

            const totalUpdated = addOrgId.modifiedCount + result.modifiedCount;
            totalMigrations[collection.field] += totalUpdated;
            console.log(`  ✅ Updated ${totalUpdated} ${collection.name} records`);

            // Update metadata counts in the project
            if (collection.name === 'conversations') {
              const count = await db.collection(collection.name).countDocuments({
                orgId: orgId,
                projectId: defaultProject._id,
                isDeleted: false
              });
              defaultProject.metadata.conversationCount = count;
            }
            if (collection.name === 'documents') {
              const count = await db.collection('documents').countDocuments({
                orgId: orgId,
                projectId: defaultProject._id,
                isDeleted: false
              });
              defaultProject.metadata.documentCount = count;
            }
          }

          // Step 6: Update project metadata with final counts
          console.log('\n📊 Step 6: Updating project metadata...');

          const conversationCount = await db.collection('conversations').countDocuments({
            orgId: orgId,
            projectId: defaultProject._id,
            isDeleted: false
          });

          const documentCount = await db.collection('documents').countDocuments({
            orgId: orgId,
            projectId: defaultProject._id,
            isDeleted: false
          });

          await db.collection('projects').updateOne(
            { _id: defaultProject._id },
            {
              $set: {
                'metadata.conversationCount': conversationCount,
                'metadata.documentCount': documentCount,
                'metadata.lastActivityAt': new Date()
              }
            }
          );
          console.log(`  ✅ Project metadata updated (${conversationCount} conversations, ${documentCount} documents)`);

          // Step 7: Update organization settings for multi-tenancy
          console.log('\n⚙️ Step 7: Updating organization settings...');

          const userCount = await db.collection('users').countDocuments({
            organizations: orgId,
            isDeleted: false
          });

          await db.collection('orgs').updateOne(
            { _id: orgId },
            {
              $set: {
                'settings.maxProjects': org.accountType === 'business' ? 100 : 10,
                'settings.maxUsers': org.accountType === 'business' ? 500 : 50,
                'settings.features': org.accountType === 'business'
                  ? ['multi_project', 'advanced_analytics', 'custom_branding']
                  : ['multi_project', 'basic_features'],
                'metadata.projectCount': 1,
                'metadata.userCount': userCount,
                'metadata.storageUsed': 0,
                'subscription.plan': org.subscription?.plan || (org.accountType === 'business' ? 'pro' : 'free')
              }
            }
          );
          console.log(`  ✅ Organization settings updated`);
        }

        // Final Summary
        console.log('\n' + '='.repeat(60));
        console.log('✨ MIGRATION COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log('\n📈 Migration Statistics:');
        console.log(`  • Projects created: ${totalMigrations.projects}`);
        console.log(`  • Users updated: ${totalMigrations.users}`);
        console.log(`  • Documents updated: ${totalMigrations.documents}`);
        console.log(`  • Conversations updated: ${totalMigrations.conversations}`);
        console.log(`  • Agent conversations updated: ${totalMigrations.agentconversations}`);
        console.log(`  • Searches updated: ${totalMigrations.search}`);
        console.log(`  • Citations updated: ${totalMigrations.citations}`);
        console.log(`  • Notifications updated: ${totalMigrations.notifications}`);
        console.log('\n🎉 All data has been successfully migrated to multi-tenant structure!');
      });
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  },

  async down(db, client) {
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        console.log('⬇️ Rolling back multi-tenant migration...');
        console.log('=' .repeat(60));

        // Step 1: Remove projects collection
        console.log('\n🗑️ Step 1: Removing projects collection...');
        try {
          await db.collection('projects').drop();
          console.log('  ✅ Projects collection removed');
        } catch (err) {
          console.log('  ⚠️  Projects collection may not exist');
        }

        // Step 2: Remove new fields from users
        console.log('\n👤 Step 2: Removing organization arrays from users...');
        const userResult = await db.collection('users').updateMany(
          {},
          {
            $unset: {
              organizations: 1,
              defaultOrgId: 1,
              lastAccessedOrgId: 1
            }
          }
        );
        console.log(`  ✅ Updated ${userResult.modifiedCount} users`);

        // Step 3: Remove projectId from all collections
        console.log('\n🗂️ Step 3: Removing projectId from all collections...');
        const collections = [
          'conversations',
          'agentconversations',
          'search',
          'citations',
          'notifications',
          'documents'
        ];

        for (const collection of collections) {
          const result = await db.collection(collection).updateMany(
            {},
            { $unset: { projectId: 1 } }
          );
          console.log(`  ✅ Removed projectId from ${result.modifiedCount} ${collection} records`);
        }

        // Step 4: Remove multi-tenancy fields from organizations
        console.log('\n🏢 Step 4: Removing multi-tenancy settings from organizations...');
        const orgResult = await db.collection('orgs').updateMany(
          {},
          {
            $unset: {
              'settings.maxProjects': 1,
              'settings.maxUsers': 1,
              'settings.features': 1,
              'metadata.projectCount': 1,
              'metadata.userCount': 1,
              'metadata.storageUsed': 1
            }
          }
        );
        console.log(`  ✅ Updated ${orgResult.modifiedCount} organizations`);

        console.log('\n' + '='.repeat(60));
        console.log('✅ ROLLBACK COMPLETED SUCCESSFULLY');
        console.log('='.repeat(60));
        console.log('ℹ️  Database has been restored to single-tenant structure');
      });
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }
};