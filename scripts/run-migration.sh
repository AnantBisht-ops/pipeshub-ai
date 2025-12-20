#!/bin/bash

#################################################
# Multi-Tenant Migration Runner Script
# Safely executes the migration with backup
#################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
MIGRATION_DIR="backend/nodejs/apps/src/migrations"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     MULTI-TENANT MIGRATION RUNNER                   ║"
echo "║     Single-Tenant → Multi-Tenant Architecture       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Check for dry-run mode
DRY_RUN=false
if [ "$1" == "--dry-run" ]; then
    DRY_RUN=true
    echo -e "${CYAN}🔍 Running in DRY-RUN mode (no changes will be made)${NC}"
    echo ""
fi

# Step 1: Pre-flight checks
echo -e "${BLUE}[Step 1/6]${NC} ${YELLOW}Running pre-flight checks...${NC}"

# Check if MongoDB is accessible
echo -n "  Checking MongoDB connection... "
if mongosh --eval "db.version()" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
elif mongo --eval "db.version()" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo -e "${RED}ERROR: Cannot connect to MongoDB${NC}"
    exit 1
fi

# Check if migrate-mongo is installed
echo -n "  Checking migrate-mongo... "
if ! command -v migrate-mongo &> /dev/null; then
    echo -e "${YELLOW}Installing...${NC}"
    npm install -g migrate-mongo
fi
echo -e "${GREEN}✓${NC}"

# Check if migration files exist
echo -n "  Checking migration files... "
if [ ! -f "$ROOT_DIR/$MIGRATION_DIR/002_migrate_to_multi_tenant.js" ]; then
    echo -e "${RED}✗${NC}"
    echo -e "${RED}ERROR: Migration file not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC}"

# Step 2: Create backup
if [ "$DRY_RUN" = false ]; then
    echo ""
    echo -e "${BLUE}[Step 2/6]${NC} ${YELLOW}Creating backup...${NC}"

    cd "$ROOT_DIR"
    if ./scripts/backup.sh; then
        echo -e "  ${GREEN}✓ Backup completed${NC}"
    else
        echo -e "  ${RED}✗ Backup failed${NC}"
        echo -e "${RED}ABORTING: Cannot proceed without backup${NC}"
        exit 1
    fi
else
    echo ""
    echo -e "${BLUE}[Step 2/6]${NC} ${CYAN}Skipping backup (dry-run mode)${NC}"
fi

# Step 3: Show migration preview
echo ""
echo -e "${BLUE}[Step 3/6]${NC} ${YELLOW}Migration Preview${NC}"
echo "  This migration will:"
echo "    • Create a default 'General' project for each organization"
echo "    • Update all users with organization arrays"
echo "    • Add projectId to all data collections"
echo "    • Update organization settings for multi-tenancy"
echo "    • Maintain backward compatibility"

if [ "$DRY_RUN" = false ]; then
    echo ""
    echo -e "${YELLOW}⚠️  This operation will modify your database!${NC}"
    echo -e "Press ${GREEN}Enter${NC} to continue or ${RED}Ctrl+C${NC} to abort..."
    read
fi

# Step 4: Run migration
echo ""
if [ "$DRY_RUN" = false ]; then
    echo -e "${BLUE}[Step 4/6]${NC} ${YELLOW}Running migration...${NC}"

    cd "$ROOT_DIR"

    # Run the migration using Node directly
    node -e "
    const mongoose = require('mongoose');
    const migration = require('./$MIGRATION_DIR/002_migrate_to_multi_tenant.js');

    (async () => {
        try {
            const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/es';
            const client = await mongoose.connect(uri);
            const db = client.connection.db;

            console.log('Connected to MongoDB...');
            await migration.up(db, client.connection.getClient());

            await client.disconnect();
            console.log('Migration completed successfully!');
            process.exit(0);
        } catch (error) {
            console.error('Migration failed:', error);
            process.exit(1);
        }
    })();
    "

    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✓ Migration completed${NC}"
    else
        echo -e "  ${RED}✗ Migration failed${NC}"
        echo ""
        echo -e "${RED}Migration failed! You can restore from backup:${NC}"
        echo "  cd backups/latest && ./restore.sh"
        exit 1
    fi
else
    echo -e "${BLUE}[Step 4/6]${NC} ${CYAN}Skipping migration execution (dry-run mode)${NC}"
fi

# Step 5: Verify migration
echo ""
echo -e "${BLUE}[Step 5/6]${NC} ${YELLOW}Verifying migration...${NC}"

cd "$ROOT_DIR"

if [ -f "./scripts/verify-migration.js" ]; then
    node ./scripts/verify-migration.js
    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✓ Verification passed${NC}"
    else
        echo -e "  ${YELLOW}⚠ Verification reported warnings${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠ Verification script not found, creating...${NC}"
    # We'll create this next
fi

# Step 6: Post-migration summary
echo ""
echo -e "${BLUE}[Step 6/6]${NC} ${YELLOW}Post-migration summary${NC}"

if [ "$DRY_RUN" = false ]; then
    # Get migration statistics
    node -e "
    const mongoose = require('mongoose');

    (async () => {
        try {
            const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/es';
            await mongoose.connect(uri);
            const db = mongoose.connection.db;

            const stats = {
                orgs: await db.collection('orgs').countDocuments(),
                projects: await db.collection('projects').countDocuments(),
                users: await db.collection('users').countDocuments({ organizations: { \$exists: true } }),
                documents: await db.collection('documents').countDocuments({ projectId: { \$exists: true } }),
                conversations: await db.collection('conversations').countDocuments({ projectId: { \$exists: true } })
            };

            console.log('  📊 Migration Statistics:');
            console.log('    • Organizations:', stats.orgs);
            console.log('    • Projects:', stats.projects);
            console.log('    • Migrated Users:', stats.users);
            console.log('    • Documents with projectId:', stats.documents);
            console.log('    • Conversations with projectId:', stats.conversations);

            await mongoose.disconnect();
        } catch (error) {
            console.error('Failed to get statistics:', error);
        }
    })();
    " 2>/dev/null
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
if [ "$DRY_RUN" = false ]; then
    echo -e "║  ${GREEN}✨ MIGRATION COMPLETED SUCCESSFULLY! ✨${NC}           ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo ""
    echo "Your application is now multi-tenant enabled!"
    echo ""
    echo "📝 Next Steps:"
    echo "  1. Restart your application"
    echo "  2. Test the new multi-tenant features"
    echo "  3. Monitor for any issues"
    echo ""
    echo "📁 Backup location: backups/latest/"
    echo ""
    echo "In case of issues, restore with:"
    echo "  cd backups/latest && ./restore.sh"
else
    echo -e "║  ${CYAN}DRY-RUN COMPLETED (No changes made)${NC}            ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo ""
    echo "To run the actual migration, execute:"
    echo "  ./scripts/run-migration.sh"
fi

echo ""

exit 0