/**
 * Migration Script: Add Multi-Tenancy Support
 * Version: 001
 * Date: 2024
 *
 * This migration adds multi-tenancy support to the existing database structure.
 * It creates a default project for each organization and migrates existing data.
 */

import mongoose from 'mongoose';
import { Org } from '../../modules/user_management/schema/org.schema';
import { Project } from '../../modules/project_management/schema/project.schema';
import { DocumentModel } from '../../modules/storage/schema/document.schema';
import { Conversation } from '../../modules/enterprise_search/schema/conversation.schema';
import { AgentConversation } from '../../modules/enterprise_search/schema/agent.conversation.schema';
import EnterpriseSemanticSearch from '../../modules/enterprise_search/schema/search.schema';
import { Notifications } from '../../modules/notification/schema/notification.schema';
import { MigrationResult } from '../../libs/types/multi-tenancy.types';

interface MigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
  verbose?: boolean;
}

class MultiTenancyMigration {
  private options: Required<MigrationOptions>;
  private results: MigrationResult = {
    success: false,
    totalRecords: 0,
    migratedRecords: 0,
    failedRecords: 0,
    errors: []
  };

  constructor(options: MigrationOptions = {}) {
    this.options = {
      dryRun: options.dryRun ?? false,
      batchSize: options.batchSize ?? 100,
      verbose: options.verbose ?? true
    };
  }

  private log(message: string): void {
    if (this.options.verbose) {
      console.log(`[Migration] ${new Date().toISOString()} - ${message}`);
    }
  }

  private error(message: string, error?: any): void {
    console.error(`[Migration Error] ${new Date().toISOString()} - ${message}`, error);
  }

  /**
   * Step 1: Create default projects for all organizations
   */
  private async createDefaultProjects(): Promise<void> {
    this.log('Creating default projects for organizations...');

    try {
      const orgs = await Org.find({ isDeleted: false });
      this.log(`Found ${orgs.length} organizations`);

      for (const org of orgs) {
        try {
          // Check if organization already has projects
          const existingProject = await Project.findOne({
            orgId: org._id,
            isDefault: true
          });

          if (existingProject) {
            this.log(`Organization ${org.slug} already has a default project`);
            continue;
          }

          // Create default project for the organization
          const defaultProject = {
            name: 'Default Project',
            description: 'Default project for migrated data',
            orgId: org._id,
            createdBy: org._id, // Using org ID as a placeholder
            visibility: 'organization' as const,
            status: 'active' as const,
            type: 'standard' as const,
            isDefault: true, // Mark as default for migration
            settings: {
              allowGuestAccess: false,
              requireApproval: false,
              defaultUserRole: 'viewer' as const,
              features: ['documents', 'conversations', 'ai-search'],
              integrations: []
            },
            metrics: {
              documentCount: 0,
              conversationCount: 0,
              memberCount: 0,
              storageUsed: 0,
              lastActivityAt: new Date()
            },
            members: [], // Will be populated later
            tags: ['migrated', 'default'],
            metadata: {
              migratedAt: new Date(),
              migrationVersion: '001'
            }
          };

          if (!this.options.dryRun) {
            const project = await Project.create(defaultProject);
            this.log(`Created default project for organization ${org.slug}: ${project.slug}`);
          } else {
            this.log(`[DRY RUN] Would create default project for organization ${org.slug}`);
          }

          this.results.migratedRecords++;
        } catch (error) {
          this.error(`Failed to create default project for org ${org.slug}:`, error);
          this.results.errors?.push({
            recordId: String(org._id),
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          this.results.failedRecords++;
        }
      }
    } catch (error) {
      this.error('Failed to create default projects:', error);
      throw error;
    }
  }

  /**
   * Step 2: Migrate Documents to include projectId
   */
  private async migrateDocuments(): Promise<void> {
    this.log('Migrating documents...');

    try {
      const totalDocs = await DocumentModel.countDocuments({});
      this.log(`Found ${totalDocs} documents to migrate`);

      // Process in batches
      let processed = 0;
      while (processed < totalDocs) {
        const documents = await DocumentModel.find({})
          .skip(processed)
          .limit(this.options.batchSize);

        for (const doc of documents) {
          try {
            if ((doc as any).projectId) {
              this.log(`Document ${doc.documentName} already has projectId`);
              continue;
            }

            // Find the default project for this organization
            const defaultProject = await Project.findOne({
              orgId: doc.orgId,
              isDefault: true
            });

            if (!defaultProject) {
              this.error(`No default project found for org ${doc.orgId}`);
              this.results.failedRecords++;
              continue;
            }

            if (!this.options.dryRun) {
              await DocumentModel.updateOne(
                { _id: doc._id },
                {
                  $set: {
                    projectId: defaultProject._id,
                    updatedAt: Date.now()
                  }
                }
              );
              this.log(`Migrated document ${doc.documentName} to project ${defaultProject.slug}`);
            } else {
              this.log(`[DRY RUN] Would migrate document ${doc.documentName} to default project`);
            }

            this.results.migratedRecords++;
          } catch (error) {
            this.error(`Failed to migrate document ${doc._id}:`, error);
            this.results.errors?.push({
              recordId: String(doc._id),
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            this.results.failedRecords++;
          }
        }

        processed += documents.length;
        this.log(`Processed ${processed}/${totalDocs} documents`);
      }
    } catch (error) {
      this.error('Failed to migrate documents:', error);
      throw error;
    }
  }

  /**
   * Step 3: Migrate Conversations to include projectId
   */
  private async migrateConversations(): Promise<void> {
    this.log('Migrating conversations...');

    try {
      // Migrate regular conversations
      const totalConversations = await Conversation.countDocuments({});
      this.log(`Found ${totalConversations} conversations to migrate`);

      let processed = 0;
      while (processed < totalConversations) {
        const conversations = await Conversation.find({})
          .skip(processed)
          .limit(this.options.batchSize);

        for (const conv of conversations) {
          try {
            if ((conv as any).projectId) {
              this.log(`Conversation ${conv._id} already has projectId`);
              continue;
            }

            // Find the default project for this organization
            const defaultProject = await Project.findOne({
              orgId: conv.orgId,
              isDefault: true
            });

            if (!defaultProject) {
              this.error(`No default project found for org ${conv.orgId}`);
              this.results.failedRecords++;
              continue;
            }

            if (!this.options.dryRun) {
              await Conversation.updateOne(
                { _id: conv._id },
                {
                  $set: {
                    projectId: defaultProject._id,
                    lastActivityAt: Date.now()
                  }
                }
              );
              this.log(`Migrated conversation ${conv._id} to project ${defaultProject.slug}`);
            } else {
              this.log(`[DRY RUN] Would migrate conversation ${conv._id} to default project`);
            }

            this.results.migratedRecords++;
          } catch (error) {
            this.error(`Failed to migrate conversation ${conv._id}:`, error);
            this.results.errors?.push({
              recordId: String(conv._id),
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            this.results.failedRecords++;
          }
        }

        processed += conversations.length;
        this.log(`Processed ${processed}/${totalConversations} conversations`);
      }

      // Migrate agent conversations
      const totalAgentConversations = await AgentConversation.countDocuments({});
      this.log(`Found ${totalAgentConversations} agent conversations to migrate`);

      processed = 0;
      while (processed < totalAgentConversations) {
        const agentConversations = await AgentConversation.find({})
          .skip(processed)
          .limit(this.options.batchSize);

        for (const conv of agentConversations) {
          try {
            if ((conv as any).projectId) {
              this.log(`Agent conversation ${conv._id} already has projectId`);
              continue;
            }

            // Find the default project for this organization
            const defaultProject = await Project.findOne({
              orgId: conv.orgId,
              isDefault: true
            });

            if (!defaultProject) {
              this.error(`No default project found for org ${conv.orgId}`);
              this.results.failedRecords++;
              continue;
            }

            if (!this.options.dryRun) {
              await AgentConversation.updateOne(
                { _id: conv._id },
                {
                  $set: {
                    projectId: defaultProject._id,
                    lastActivityAt: Date.now()
                  }
                }
              );
              this.log(`Migrated agent conversation ${conv._id} to project ${defaultProject.slug}`);
            } else {
              this.log(`[DRY RUN] Would migrate agent conversation ${conv._id} to default project`);
            }

            this.results.migratedRecords++;
          } catch (error) {
            this.error(`Failed to migrate agent conversation ${conv._id}:`, error);
            this.results.errors?.push({
              recordId: String(conv._id),
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            this.results.failedRecords++;
          }
        }

        processed += agentConversations.length;
        this.log(`Processed ${processed}/${totalAgentConversations} agent conversations`);
      }
    } catch (error) {
      this.error('Failed to migrate conversations:', error);
      throw error;
    }
  }

  /**
   * Step 4: Migrate Search Records and Citations
   */
  private async migrateSearchRecords(): Promise<void> {
    this.log('Migrating search records...');

    try {
      const totalSearches = await EnterpriseSemanticSearch.countDocuments({});
      this.log(`Found ${totalSearches} search records to migrate`);

      let processed = 0;
      while (processed < totalSearches) {
        const searches = await EnterpriseSemanticSearch.find({})
          .skip(processed)
          .limit(this.options.batchSize);

        for (const search of searches) {
          try {
            if (search.projectId) {
              this.log(`Search record ${search._id} already has projectId`);
              continue;
            }

            // Find the default project for this organization
            const defaultProject = await Project.findOne({
              orgId: search.orgId,
              isDefault: true
            });

            if (!defaultProject) {
              this.error(`No default project found for org ${search.orgId}`);
              this.results.failedRecords++;
              continue;
            }

            if (!this.options.dryRun) {
              await EnterpriseSemanticSearch.updateOne(
                { _id: search._id },
                {
                  $set: {
                    projectId: defaultProject._id
                  }
                }
              );
              this.log(`Migrated search record ${search._id} to project ${defaultProject.slug}`);
            } else {
              this.log(`[DRY RUN] Would migrate search record ${search._id} to default project`);
            }

            this.results.migratedRecords++;
          } catch (error) {
            this.error(`Failed to migrate search record ${search._id}:`, error);
            this.results.errors?.push({
              recordId: String(search._id),
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            this.results.failedRecords++;
          }
        }

        processed += searches.length;
        this.log(`Processed ${processed}/${totalSearches} search records`);
      }
    } catch (error) {
      this.error('Failed to migrate search records:', error);
      throw error;
    }
  }

  /**
   * Step 5: Migrate Notifications
   */
  private async migrateNotifications(): Promise<void> {
    this.log('Migrating notifications...');

    try {
      const totalNotifications = await Notifications.countDocuments({});
      this.log(`Found ${totalNotifications} notifications to migrate`);

      let processed = 0;
      while (processed < totalNotifications) {
        const notifications = await Notifications.find({})
          .skip(processed)
          .limit(this.options.batchSize);

        for (const notification of notifications) {
          try {
            if (notification.projectId) {
              this.log(`Notification ${notification._id} already has projectId`);
              continue;
            }

            // Find the default project for this organization
            const defaultProject = await Project.findOne({
              orgId: notification.orgId,
              isDefault: true
            });

            if (!defaultProject) {
              // Notifications might be org-level, so this is not an error
              this.log(`No default project for notification ${notification._id} - keeping as org-level`);
              continue;
            }

            // Only migrate if notification seems project-related based on its type or payload
            const projectRelatedTypes = ['document_shared', 'conversation_updated', 'agent_response'];
            if (projectRelatedTypes.includes(notification.type)) {
              if (!this.options.dryRun) {
                await Notifications.updateOne(
                  { _id: notification._id },
                  {
                    $set: {
                      projectId: defaultProject._id
                    }
                  }
                );
                this.log(`Migrated notification ${notification._id} to project ${defaultProject.slug}`);
              } else {
                this.log(`[DRY RUN] Would migrate notification ${notification._id} to default project`);
              }
              this.results.migratedRecords++;
            }
          } catch (error) {
            this.error(`Failed to migrate notification ${notification._id}:`, error);
            this.results.errors?.push({
              recordId: String(notification._id),
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            this.results.failedRecords++;
          }
        }

        processed += notifications.length;
        this.log(`Processed ${processed}/${totalNotifications} notifications`);
      }
    } catch (error) {
      this.error('Failed to migrate notifications:', error);
      throw error;
    }
  }

  /**
   * Step 6: Update project metrics
   */
  private async updateProjectMetrics(): Promise<void> {
    this.log('Updating project metrics...');

    try {
      const projects = await Project.find({ isDefault: true });

      for (const project of projects) {
        try {
          // Count documents
          const documentCount = await DocumentModel.countDocuments({
            orgId: project.orgId,
            projectId: project._id,
            isDeleted: false
          });

          // Count conversations
          const conversationCount = await Conversation.countDocuments({
            orgId: project.orgId,
            projectId: project._id,
            isDeleted: false
          });

          const agentConversationCount = await AgentConversation.countDocuments({
            orgId: project.orgId,
            projectId: project._id,
            isDeleted: false
          });

          // Calculate storage used (simplified - you might want to aggregate from documents)
          const documents = await DocumentModel.find({
            orgId: project.orgId,
            projectId: project._id,
            isDeleted: false
          }).select('sizeInBytes');

          const storageUsed = documents.reduce((total, doc) => {
            return total + (doc.sizeInBytes || 0);
          }, 0);

          if (!this.options.dryRun) {
            await Project.updateOne(
              { _id: project._id },
              {
                $set: {
                  'metrics.documentCount': documentCount,
                  'metrics.conversationCount': conversationCount + agentConversationCount,
                  'metrics.storageUsed': storageUsed,
                  'metrics.lastActivityAt': new Date()
                }
              }
            );
            this.log(`Updated metrics for project ${project.slug}`);
          } else {
            this.log(`[DRY RUN] Would update metrics for project ${project.slug}:`);
            this.log(`  - Documents: ${documentCount}`);
            this.log(`  - Conversations: ${conversationCount + agentConversationCount}`);
            this.log(`  - Storage: ${storageUsed} bytes`);
          }
        } catch (error) {
          this.error(`Failed to update metrics for project ${project._id}:`, error);
        }
      }
    } catch (error) {
      this.error('Failed to update project metrics:', error);
      throw error;
    }
  }

  /**
   * Main migration runner
   */
  public async run(): Promise<MigrationResult> {
    try {
      this.log('Starting multi-tenancy migration...');
      this.log(`Options: ${JSON.stringify(this.options)}`);

      // Count total records to migrate
      const totalRecords =
        await Org.countDocuments({ isDeleted: false }) +
        await DocumentModel.countDocuments({}) +
        await Conversation.countDocuments({}) +
        await AgentConversation.countDocuments({}) +
        await EnterpriseSemanticSearch.countDocuments({}) +
        await Notifications.countDocuments({});

      this.results.totalRecords = totalRecords;
      this.log(`Total records to process: ${totalRecords}`);

      // Execute migration steps
      await this.createDefaultProjects();
      await this.migrateDocuments();
      await this.migrateConversations();
      await this.migrateSearchRecords();
      await this.migrateNotifications();
      await this.updateProjectMetrics();

      this.results.success = true;
      this.log('Migration completed successfully!');
      this.log(`Results: ${JSON.stringify(this.results, null, 2)}`);

      return this.results;
    } catch (error) {
      this.error('Migration failed:', error);
      this.results.success = false;
      throw error;
    }
  }

  /**
   * Rollback migration (if needed)
   */
  public async rollback(): Promise<void> {
    this.log('Starting migration rollback...');

    try {
      if (this.options.dryRun) {
        this.log('[DRY RUN] Rollback would remove projectId from all collections');
        return;
      }

      // Remove projectId from all collections
      await DocumentModel.updateMany({}, { $unset: { projectId: 1 } });
      await Conversation.updateMany({}, { $unset: { projectId: 1 } });
      await AgentConversation.updateMany({}, { $unset: { projectId: 1 } });
      await EnterpriseSemanticSearch.updateMany({}, { $unset: { projectId: 1 } });
      await Notifications.updateMany({}, { $unset: { projectId: 1 } });

      // Delete default projects created by migration
      await Project.deleteMany({ isDefault: true });

      this.log('Rollback completed successfully');
    } catch (error) {
      this.error('Rollback failed:', error);
      throw error;
    }
  }
}

// Export the migration class
export default MultiTenancyMigration;

// CLI runner (if executed directly)
if (require.main === module) {
  const runMigration = async () => {
    const args = process.argv.slice(2);
    const options: MigrationOptions = {
      dryRun: args.includes('--dry-run'),
      verbose: !args.includes('--quiet'),
      batchSize: parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '100')
    };

    try {
      // Connect to MongoDB
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pipeshub';
      await mongoose.connect(mongoUri);
      console.log('Connected to MongoDB');

      const migration = new MultiTenancyMigration(options);

      if (args.includes('--rollback')) {
        await migration.rollback();
      } else {
        const results = await migration.run();
        console.log('Migration Results:', results);
      }

      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  };

  runMigration();
}