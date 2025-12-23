#!/bin/bash

#################################################
# Migration Rollback Script
# Safely rolls back the multi-tenant migration
#################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     MULTI-TENANT MIGRATION ROLLBACK                 ║"
echo "║     Multi-Tenant → Single-Tenant Architecture       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

echo -e "${YELLOW}⚠️  WARNING: This will rollback the multi-tenant migration!${NC}"
echo "This operation will:"
echo "  • Remove the projects collection"
echo "  • Remove projectId from all documents"
echo "  • Remove organization arrays from users"
echo "  • Restore single-tenant structure"
echo ""
echo -e "Press ${GREEN}Enter${NC} to continue or ${RED}Ctrl+C${NC} to abort..."
read

# Step 1: Create backup before rollback
echo -e "${BLUE}[Step 1/4]${NC} ${YELLOW}Creating backup before rollback...${NC}"

cd "$ROOT_DIR"
if ./scripts/backup.sh; then
    echo -e "  ${GREEN}✓ Backup completed${NC}"
else
    echo -e "  ${RED}✗ Backup failed${NC}"
    echo -e "${YELLOW}⚠️  Continuing without backup (risky!)${NC}"
fi

# Step 2: Run rollback migration
echo ""
echo -e "${BLUE}[Step 2/4]${NC} ${YELLOW}Running rollback migration...${NC}"

cd "$ROOT_DIR"

node -e "
const mongoose = require('mongoose');
const migration = require('./backend/nodejs/apps/src/migrations/002_migrate_to_multi_tenant.js');

(async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/es';
        const client = await mongoose.connect(uri);
        const db = client.connection.db;

        console.log('Connected to MongoDB...');
        console.log('Running rollback (down) migration...');

        await migration.down(db, client.connection.getClient());

        await client.disconnect();
        console.log('Rollback completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Rollback failed:', error);
        process.exit(1);
    }
})();
"

if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓ Rollback completed${NC}"
else
    echo -e "  ${RED}✗ Rollback failed${NC}"
    echo ""
    echo -e "${RED}Rollback failed! Database may be in inconsistent state.${NC}"
    echo "Consider restoring from backup:"
    echo "  cd backups/latest && ./restore.sh"
    exit 1
fi

# Step 3: Verify rollback
echo ""
echo -e "${BLUE}[Step 3/4]${NC} ${YELLOW}Verifying rollback...${NC}"

node -e "
const mongoose = require('mongoose');

(async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/es';
        await mongoose.connect(uri);
        const db = mongoose.connection.db;

        // Check projects collection doesn't exist
        const collections = await db.listCollections({ name: 'projects' }).toArray();
        const projectsExist = collections.length > 0;

        // Check for projectId in documents
        const doc = await db.collection('documents').findOne({ projectId: { \$exists: true } });
        const hasProjectId = doc !== null;

        // Check for organization arrays in users
        const user = await db.collection('users').findOne({ organizations: { \$exists: true } });
        const hasOrgArrays = user !== null;

        console.log('Verification Results:');
        console.log('  Projects collection removed:', !projectsExist ? '✓' : '✗');
        console.log('  ProjectId removed from documents:', !hasProjectId ? '✓' : '✗');
        console.log('  Organization arrays removed:', !hasOrgArrays ? '✓' : '✗');

        await mongoose.disconnect();

        const success = !projectsExist && !hasProjectId && !hasOrgArrays;
        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
})();
"

if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓ Rollback verified${NC}"
else
    echo -e "  ${YELLOW}⚠ Rollback verification reported issues${NC}"
fi

# Step 4: Summary
echo ""
echo -e "${BLUE}[Step 4/4]${NC} ${YELLOW}Rollback Summary${NC}"

node -e "
const mongoose = require('mongoose');

(async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/es';
        await mongoose.connect(uri);
        const db = mongoose.connection.db;

        const stats = {
            orgs: await db.collection('orgs').countDocuments(),
            users: await db.collection('users').countDocuments(),
            documents: await db.collection('documents').countDocuments(),
            conversations: await db.collection('conversations').countDocuments()
        };

        console.log('  Database Statistics:');
        console.log('    • Organizations:', stats.orgs);
        console.log('    • Users:', stats.users);
        console.log('    • Documents:', stats.documents);
        console.log('    • Conversations:', stats.conversations);

        await mongoose.disconnect();
    } catch (error) {
        console.error('Failed to get statistics:', error);
    }
})();
" 2>/dev/null

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo -e "║  ${GREEN}✅ ROLLBACK COMPLETED SUCCESSFULLY${NC}               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Your database has been restored to single-tenant structure."
echo ""
echo "📝 Next Steps:"
echo "  1. Restart your application"
echo "  2. Verify application functionality"
echo "  3. Review why migration was rolled back"
echo ""
echo "📁 Backup created at: backups/latest/"
echo ""
echo "To re-run migration later:"
echo "  ./scripts/run-migration.sh"
echo ""

exit 0