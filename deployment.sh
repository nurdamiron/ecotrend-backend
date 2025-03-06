#!/bin/bash

# deployment.sh
set -e

APP_DIR="/home/ubuntu/ecotrend-backend"
cd $APP_DIR

# Pull latest changes
echo "Pulling latest changes from repository..."
git pull

# Build test container and run tests (with sudo)
echo "Building test environment and running tests..."
sudo docker-compose -f docker-compose.test.yml up --build --exit-code-from tests
TEST_EXIT_CODE=$?

# If tests pass, deploy to production
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "Tests passed! Deploying to production..."
    
    # Create a backup of the current deployment
    BACKUP_DIR="backups/$(date +%Y%m%d%H%M%S)"
    mkdir -p $BACKUP_DIR
    sudo docker-compose down
    cp docker-compose.yml .env $BACKUP_DIR/
    
    # Deploy new version (with sudo)
    sudo docker-compose build
    sudo docker-compose up -d
    
    echo "Deployment completed successfully!"
else
    echo "Tests failed! Deployment aborted."
    exit 1
fi