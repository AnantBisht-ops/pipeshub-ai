/**
 * Migration: Add Claude Code fields to conversations collection
 *
 * This migration adds Claude Code integration fields to the existing conversations.
 * All new fields are nullable/optional, ensuring backward compatibility.
 *
 * Changes:
 * 1. Adds conversationType field with default value 'pipeshub'
 * 2. Adds indexes for Claude Code specific fields
 *
 * Note: No data transformation needed as all fields are optional
 */

module.exports = {
  /**
   * Run the migration - Add Claude Code fields
   * @param {Object} db MongoDB database object
   * @param {Object} client MongoDB client
   */
  async up(db, client) {
    console.log('Starting migration: Adding Claude Code fields to conversations');

    const conversations = db.collection('conversations');

    // Step 1: Add conversationType to all existing conversations
    console.log('Setting conversationType to "pipeshub" for all existing conversations...');
    const updateResult = await conversations.updateMany(
      { conversationType: { $exists: false } }, // Only update documents without conversationType
      {
        $set: {
          conversationType: 'pipeshub' // Default value for existing conversations
        }
      }
    );
    console.log(`Updated ${updateResult.modifiedCount} conversations with conversationType`);

    // Step 2: Create indexes for Claude Code fields
    console.log('Creating indexes for Claude Code fields...');

    try {
      // Index for filtering by conversation type
      await conversations.createIndex(
        { conversationType: 1 },
        {
          name: 'conversationType_1',
          background: true
        }
      );
      console.log('Created index: conversationType_1');

      // Index for Claude session lookups
      await conversations.createIndex(
        { 'claudeCodeSession.sessionId': 1 },
        {
          name: 'claudeCodeSession.sessionId_1',
          background: true,
          sparse: true // Sparse index since most conversations won't have this field
        }
      );
      console.log('Created index: claudeCodeSession.sessionId_1');

      // Index for finding specific Claude messages
      await conversations.createIndex(
        { 'claudeCodeMessages.uuid': 1 },
        {
          name: 'claudeCodeMessages.uuid_1',
          background: true,
          sparse: true // Sparse index since most conversations won't have this field
        }
      );
      console.log('Created index: claudeCodeMessages.uuid_1');

    } catch (error) {
      console.error('Error creating indexes:', error);
      // Don't fail migration if indexes already exist
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

    // Step 3: Validate migration
    console.log('Validating migration...');

    // Check sample of conversations
    const sampleConversations = await conversations.find({}).limit(5).toArray();
    const allHaveType = sampleConversations.every(conv =>
      conv.conversationType === 'pipeshub' || conv.conversationType === 'claude_code'
    );

    if (allHaveType) {
      console.log('✓ Migration validation successful');
    } else {
      console.warn('⚠ Some conversations may not have correct conversationType');
    }

    console.log('Migration completed: Claude Code fields added successfully');

    // Return migration statistics
    return {
      conversationsUpdated: updateResult.modifiedCount,
      indexesCreated: 3,
      status: 'success'
    };
  },

  /**
   * Rollback the migration - Remove Claude Code fields
   * @param {Object} db MongoDB database object
   * @param {Object} client MongoDB client
   */
  async down(db, client) {
    console.log('Starting rollback: Removing Claude Code fields from conversations');

    const conversations = db.collection('conversations');

    // Step 1: Remove Claude Code specific fields from all documents
    console.log('Removing Claude Code fields from all conversations...');
    const updateResult = await conversations.updateMany(
      {},
      {
        $unset: {
          conversationType: '',
          claudeCodeSession: '',
          claudeCodeMessages: ''
        }
      }
    );
    console.log(`Removed Claude Code fields from ${updateResult.modifiedCount} conversations`);

    // Step 2: Drop Claude Code specific indexes
    console.log('Dropping Claude Code indexes...');

    try {
      await conversations.dropIndex('conversationType_1');
      console.log('Dropped index: conversationType_1');
    } catch (error) {
      console.log('Index conversationType_1 not found or already dropped');
    }

    try {
      await conversations.dropIndex('claudeCodeSession.sessionId_1');
      console.log('Dropped index: claudeCodeSession.sessionId_1');
    } catch (error) {
      console.log('Index claudeCodeSession.sessionId_1 not found or already dropped');
    }

    try {
      await conversations.dropIndex('claudeCodeMessages.uuid_1');
      console.log('Dropped index: claudeCodeMessages.uuid_1');
    } catch (error) {
      console.log('Index claudeCodeMessages.uuid_1 not found or already dropped');
    }

    console.log('Rollback completed: Claude Code fields removed successfully');

    return {
      conversationsUpdated: updateResult.modifiedCount,
      indexesDropped: 3,
      status: 'success'
    };
  }
};