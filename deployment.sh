#!/bin/bash
# enhanced-deployment.sh - Improved deployment script with database verification

set -e

# Define constants
APP_DIR="/home/ubuntu/ecotrend-backend"
BACKUP_DIR="backups/$(date +%Y%m%d%H%M%S)"
LOG_FILE="deployment_$(date +%Y%m%d%H%M%S).log"

# Function to log messages
log_message() {
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

# Function to check and handle port conflicts
check_and_handle_ports() {
  log_message "Checking for port conflicts..."
  
  # Port check using netstat
  local ports_to_check=("443:443" "80:80" "3306:3306" "3000:3000")
  local port_mapping=("443:8443" "80:8080" "3306:3307" "3000:3001")
  local need_update=false
  
  for i in "${!ports_to_check[@]}"; do
    local port=${ports_to_check[$i]%:*}
    local container_port=${ports_to_check[$i]#*:}
    local new_mapping=${port_mapping[$i]}
    
    if netstat -tuln | grep -q ":$port "; then
      log_message "Port $port is already in use. Updating docker-compose.yml..."
      sed -i "s/\"$port:$container_port\"/\"${new_mapping%:*}:$container_port\"/" docker-compose.yml
      need_update=true
    fi
  done
  
  # Return whether we updated anything
  if [ "$need_update" = true ]; then
    log_message "Port conflicts resolved. Configuration updated."
    return 0
  else
    log_message "No port conflicts detected."
    return 1
  fi
}

# Function to check database health
check_database() {
  log_message "Checking database connectivity..."
  
  # Check if database container is running
  if ! docker ps | grep -q "kaspi-mysql"; then
    log_message "Database container not running! Will be started with deployment."
    return 0
  fi
  
  # Try to connect to the database
  if ! docker exec kaspi-mysql mysqladmin ping -h localhost -u root -pnurda0101 --silent; then
    log_message "WARNING: Database is not responding."
    read -p "Do you want to restart the database container? (y/n): " answer
    if [[ "$answer" == "y" ]]; then
      log_message "Restarting database container..."
      docker restart kaspi-mysql
      sleep 10 # Wait for database to start
    fi
  else
    log_message "Database connection successful."
  fi
  
  return 0
}

# Function to verify and fix database schema
verify_database_schema() {
  log_message "Verifying database schema integrity..."
  
  # Run the database fix script
  node scripts/fix-database.js || {
    log_message "WARNING: Database schema verification failed. Check the logs."
    read -p "Continue with deployment anyway? (y/n): " answer
    if [[ "$answer" != "y" ]]; then
      log_message "Deployment aborted by user."
      exit 1
    fi
  }
  
  log_message "Database schema verification completed."
  return 0
}

# Function for actual deployment
deploy() {
  log_message "Starting deployment process..."
  
  # Go to app directory
  cd "$APP_DIR"
  
  # Pull latest changes
  log_message "Pulling latest changes from repository..."
  git pull
  
  # Create backup directory
  log_message "Creating backup directory: $BACKUP_DIR"
  mkdir -p "$BACKUP_DIR"
  
  # Backup current config
  log_message "Backing up current configuration..."
  cp docker-compose.yml .env "$BACKUP_DIR/"
  
  # Check for port conflicts and update config
  check_and_handle_ports
  
  # Check database connectivity
  check_database
  
  # Build test container and run tests
  log_message "Building test environment and running tests..."
  if ! timeout 300 sudo docker-compose -f docker-compose.test.yml up --build --exit-code-from tests; then
    TEST_EXIT_CODE=$?
    
    # Check if timeout occurred
    if [ $TEST_EXIT_CODE -eq 124 ]; then
      log_message "ERROR: Tests timed out after 5 minutes."
    else
      log_message "ERROR: Tests failed with exit code $TEST_EXIT_CODE."
    fi
    
    # Cleanup test environment
    sudo docker-compose -f docker-compose.test.yml down
    
    # Ask user what to do
    read -p "Tests failed. Continue with deployment anyway? (y/n): " answer
    if [[ "$answer" != "y" ]]; then
      log_message "Deployment aborted due to test failure."
      exit 1
    fi
    
    log_message "Continuing deployment despite test failures."
  else
    log_message "Tests passed successfully."
  fi
  
  # Clean up test environment regardless of outcome
  sudo docker-compose -f docker-compose.test.yml down
  
  # Stop current containers
  log_message "Stopping current deployment..."
  sudo docker-compose down
  
  # Verify and fix database schema
  verify_database_schema
  
  # Build and start new containers
  log_message "Building and deploying new version..."
  sudo docker-compose build
  sudo docker-compose up -d
  DEPLOY_RESULT=$?
  
  if [ $DEPLOY_RESULT -ne 0 ]; then
    log_message "ERROR: Deployment failed with exit code $DEPLOY_RESULT."
    log_message "Checking for container logs..."
    sudo docker-compose logs
    
    # Ask user whether to rollback
    read -p "Deployment failed. Rollback to previous version? (y/n): " answer
    if [[ "$answer" == "y" ]]; then
      log_message "Rolling back to previous version..."
      cp "$BACKUP_DIR/docker-compose.yml" "$BACKUP_DIR/.env" ./
      sudo docker-compose up -d
      
      if [ $? -eq 0 ]; then
        log_message "Rollback successful."
      else
        log_message "ERROR: Rollback also failed. Manual intervention required."
        exit 1
      fi
    else
      log_message "Continuing with problematic deployment."
    fi
  else
    log_message "Deployment completed successfully!"
  fi
  
  # Create documentation
  if [ ! -f "PORTS.md" ]; then
    log_message "Creating ports documentation..."
    echo "# Используемые порты

## Продакшн
- 8080: HTTP (nginx → контейнер 80)
- 8443: HTTPS (nginx → контейнер 443)
- 3000: API сервер (Node.js)
- 3306/3307: MySQL 

## Тестирование
- 33306: Тестовая база данных MySQL
" > PORTS.md
  fi
  
  log_message "Deployment process completed."
}

# Main script execution
log_message "=== Starting Enhanced Deployment Process ==="
deploy
log_message "=== Deployment Completed ==="

# Exit with success
exit 0