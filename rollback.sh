#!/bin/bash
# rollback.sh

set -e

APP_DIR="/home/ubuntu/ecotrend-backend"
cd $APP_DIR

# List available backups
echo "Available backups:"
ls -la backups/

# Ask for backup to restore
read -p "Enter backup directory to restore (e.g., 20230101120000): " BACKUP_DIR

if [ ! -d "backups/$BACKUP_DIR" ]; then
    echo "Backup directory not found!"
    exit 1
fi

# Stop current deployment
docker-compose down

# Restore backup files
cp backups/$BACKUP_DIR/docker-compose.yml backups/$BACKUP_DIR/.env ./

# Restart with backup version
docker-compose up -d

echo "Rollback completed successfully!"