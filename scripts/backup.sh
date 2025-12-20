#!/bin/bash

#################################################
# MongoDB Backup Script for Multi-Tenant Migration
# Creates a timestamped backup before migration
#################################################

set -e  # Exit on error

# Configuration
BACKUP_BASE_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_BASE_DIR/$TIMESTAMP"

# MongoDB connection settings
MONGO_HOST=${MONGO_HOST:-localhost}
MONGO_PORT=${MONGO_PORT:-27017}
MONGO_DB=${MONGO_DB:-es}
MONGO_URI=${MONGO_URI:-"mongodb://$MONGO_HOST:$MONGO_PORT/$MONGO_DB"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "   MongoDB Multi-Tenant Backup"
echo "======================================"
echo ""

# Create backup directory
echo -e "${YELLOW}Creating backup directory...${NC}"
mkdir -p "$BACKUP_DIR"

# MongoDB backup
echo -e "${YELLOW}Backing up MongoDB database: $MONGO_DB${NC}"
mongodump \
    --uri="$MONGO_URI" \
    --out="$BACKUP_DIR/mongodb" \
    --quiet

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ MongoDB backup completed${NC}"
else
    echo -e "${RED}✗ MongoDB backup failed${NC}"
    exit 1
fi

# Create backup metadata
echo -e "${YELLOW}Creating backup metadata...${NC}"
cat > "$BACKUP_DIR/metadata.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date)",
  "database": "$MONGO_DB",
  "host": "$MONGO_HOST",
  "port": "$MONGO_PORT",
  "type": "pre-migration-backup",
  "migration": "single-to-multi-tenant"
}
EOF

# Create restore script
echo -e "${YELLOW}Creating restore script...${NC}"
cat > "$BACKUP_DIR/restore.sh" << 'EOF'
#!/bin/bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "======================================"
echo "   MongoDB Restore Script"
echo "======================================"
echo ""
echo "⚠️  WARNING: This will REPLACE your current database!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# MongoDB connection settings
MONGO_HOST=${MONGO_HOST:-localhost}
MONGO_PORT=${MONGO_PORT:-27017}
MONGO_DB=${MONGO_DB:-es}
MONGO_URI=${MONGO_URI:-"mongodb://$MONGO_HOST:$MONGO_PORT/$MONGO_DB"}

echo "Restoring MongoDB database..."
mongorestore \
    --uri="$MONGO_URI" \
    --drop \
    --dir="$SCRIPT_DIR/mongodb" \
    --quiet

if [ $? -eq 0 ]; then
    echo "✓ MongoDB restore completed successfully"
else
    echo "✗ MongoDB restore failed"
    exit 1
fi

echo ""
echo "Database has been restored to pre-migration state"
EOF

chmod +x "$BACKUP_DIR/restore.sh"

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

# Create latest symlink
if [ -L "$BACKUP_BASE_DIR/latest" ]; then
    rm "$BACKUP_BASE_DIR/latest"
fi
ln -s "$TIMESTAMP" "$BACKUP_BASE_DIR/latest"

# Summary
echo ""
echo "======================================"
echo -e "${GREEN}   BACKUP COMPLETED SUCCESSFULLY${NC}"
echo "======================================"
echo ""
echo "📁 Backup Location: $BACKUP_DIR"
echo "📊 Backup Size: $BACKUP_SIZE"
echo "📝 Restore Script: $BACKUP_DIR/restore.sh"
echo ""
echo "To restore this backup, run:"
echo "  cd $BACKUP_DIR && ./restore.sh"
echo ""
echo "======================================"

# Keep only last 5 backups
echo -e "${YELLOW}Cleaning old backups (keeping last 5)...${NC}"
cd "$BACKUP_BASE_DIR"
ls -t | grep -E '^[0-9]{8}_[0-9]{6}$' | tail -n +6 | xargs -I {} rm -rf {}

exit 0