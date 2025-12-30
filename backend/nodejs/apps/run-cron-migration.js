#!/usr/bin/env node

/**
 * Run Cron Scheduler Migration
 * This script runs the cron scheduler migration to create collections and indexes
 */

const mongoose = require('mongoose');
const migration = require('./src/migrations/004_add_cron_scheduler');
require('dotenv').config();

async function runMigration() {
  console.log('🚀 Starting Cron Scheduler Migration...');

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables');
    }

    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get database instance
    const db = mongoose.connection.db;

    // Check if collections already exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    if (collectionNames.includes('cronjobs') || collectionNames.includes('cronexecutions')) {
      console.log('⚠️  Warning: Cron scheduler collections already exist');
      console.log('   Checking indexes...');
    }

    // Run the migration
    console.log('🔧 Running migration...');
    await migration.up(db, mongoose.connection);

    console.log('✅ Migration completed successfully!');

    // Verify collections were created
    const newCollections = await db.listCollections().toArray();
    const newCollectionNames = newCollections.map(c => c.name);

    if (newCollectionNames.includes('cronjobs')) {
      console.log('✅ cronjobs collection verified');

      // Check indexes
      const indexes = await db.collection('cronjobs').indexes();
      console.log(`   📋 ${indexes.length} indexes created for cronjobs`);
    }

    if (newCollectionNames.includes('cronexecutions')) {
      console.log('✅ cronexecutions collection verified');

      // Check indexes
      const indexes = await db.collection('cronexecutions').indexes();
      console.log(`   📋 ${indexes.length} indexes created for cronexecutions`);
    }

    console.log('\n🎉 Cron Scheduler migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
    process.exit(0);
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});