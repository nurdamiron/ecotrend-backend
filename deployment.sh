#!/bin/bash

# deployment.sh - Place this file in the root directory of your project
set -e

# Directory containing your application (change this to your actual directory path)
APP_DIR="/ecotrend-backend"
cd $APP_DIR

# Pull latest changes
echo "Pulling latest changes from repository..."
git pull

# Build test container and run tests
echo "Building test environment and running tests..."
docker-compose -f docker-compose.test.yml up --build --exit-code-from tests
TEST_EXIT_CODE=$?

# If tests pass, deploy to production
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "Tests passed! Deploying to production..."
    
    # Create a backup of the current deployment
    BACKUP_DIR="backups/$(date +%Y%m%d%H%M%S)"
    mkdir -p $BACKUP_DIR
    docker-compose down
    cp docker-compose.yml .env $BACKUP_DIR/
    
    # Deploy new version
    docker-compose build
    docker-compose up -d
    
    echo "Deployment completed successfully!"
else
    echo "Tests failed! Deployment aborted."
    exit 1
fi