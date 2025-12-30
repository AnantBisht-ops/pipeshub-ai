// Migration Configuration for Multi-Tenancy
const path = require('path');

module.exports = {
  mongodb: {
    // MongoDB connection URL
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017',

    // Database name
    databaseName: process.env.DB_NAME || 'es',

    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },

  // The migrations dir
  migrationsDir: path.join(__dirname),

  // The MongoDB collection where the applied changes are stored
  changelogCollectionName: 'migrations_changelog',

  // The file extension to create migrations with
  migrationFileExtension: '.js',

  // Enable the algorithm to sort the migration files
  useFileHash: false,

  // Module system for migration files
  moduleSystem: 'commonjs',
};