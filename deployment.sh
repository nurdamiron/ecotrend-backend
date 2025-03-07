#!/bin/bash

# Функция проверки и изменения портов в конфигурации
check_and_change_port() {
 local port=$1
 local search_pattern=$2
 local replace_pattern=$3
 local port_name=$4
 
 if netstat -tuln | grep -q ":$port "; then
   echo "ВНИМАНИЕ: Порт $port уже используется. Автоматически изменяю конфигурацию..."
   if grep -q "$search_pattern" docker-compose.yml; then
     sed -i "s/$search_pattern/$replace_pattern/" docker-compose.yml
     echo "Порт изменен с $port_name в docker-compose.yml"
     return 0
   fi
 fi
 return 1
}

# Функция для обработки ошибок при запуске контейнеров
handle_port_conflicts() {
 if grep -q "address already in use" <<< "$(docker-compose logs)"; then
   echo "Обнаружена ошибка занятого порта. Пробую изменить порты и перезапустить..."
   
   # Проверяем различные порты в логах
   if grep -q "0.0.0.0:443" <<< "$(docker-compose logs)"; then
     sed -i 's/"443:443"/"8443:443"/' docker-compose.yml
     echo "Порт изменен с 443 на 8443"
     PORT_CHANGED=true
   elif grep -q "0.0.0.0:8443" <<< "$(docker-compose logs)"; then
     sed -i 's/"8443:443"/"8444:443"/' docker-compose.yml
     echo "Порт изменен с 8443 на 8444"
     PORT_CHANGED=true
   elif grep -q "0.0.0.0:80" <<< "$(docker-compose logs)"; then
     sed -i 's/"80:80"/"8080:80"/' docker-compose.yml
     echo "Порт изменен с 80 на 8080"
     PORT_CHANGED=true
   elif grep -q "0.0.0.0:8080" <<< "$(docker-compose logs)"; then
     sed -i 's/"8080:80"/"8081:80"/' docker-compose.yml
     echo "Порт изменен с 8080 на 8081"
     PORT_CHANGED=true
   elif grep -q "0.0.0.0:3306" <<< "$(docker-compose logs)"; then
     sed -i 's/"3306:3306"/"3307:3306"/' docker-compose.yml
     echo "Порт изменен с 3306 на 3307"
     PORT_CHANGED=true
   fi
   
   if [ "$PORT_CHANGED" = true ]; then
     # Перезапускаем с новыми настройками
     docker-compose down
     docker-compose up -d
     
     if [ $? -eq 0 ]; then
       echo "Развертывание успешно выполнено с измененными портами"
       return 0
     else
       echo "Развертывание не удалось даже после изменения портов. Требуется ручное вмешательство"
       return 1
     fi
   else
     echo "Не удалось идентифицировать конкретный занятый порт. Требуется ручное вмешательство"
     return 1
   fi
 fi
 return 0
}

# Основной код скрипта
echo "Проверка доступности портов..."

# Проверка стандартных портов перед развертыванием
PORT_CHANGED=false

# Проверяем порт 443
check_and_change_port 443 '"443:443"' '"8443:443"' "443 на 8443" && PORT_CHANGED=true

# Проверяем порт 8443 (если уже был изменен)
check_and_change_port 8443 '"8443:443"' '"8444:443"' "8443 на 8444" && PORT_CHANGED=true

# Проверяем порт 80
check_and_change_port 80 '"80:80"' '"8080:80"' "80 на 8080" && PORT_CHANGED=true

# Проверяем порт 8080 (если уже был изменен)
check_and_change_port 8080 '"8080:80"' '"8081:80"' "8080 на 8081" && PORT_CHANGED=true

# Проверяем порт 3306 (для MySQL)
check_and_change_port 3306 '"3306:3306"' '"3307:3306"' "3306 на 3307" && PORT_CHANGED=true

# Если порты были изменены, создаем резервную копию
if [ "$PORT_CHANGED" = true ]; then
 echo "Порты были изменены, сохраняем резервную копию конфигурации"
 BACKUP_DIR="backups/port_changes_$(date +%Y%m%d%H%M%S)"
 mkdir -p $BACKUP_DIR
 cp docker-compose.yml $BACKUP_DIR/
fi

# Переходим в рабочую директорию
APP_DIR="/home/ubuntu/ecotrend-backend"
cd $APP_DIR

# Pull latest changes
echo "Pulling latest changes from repository..."
git pull

# Build test container and run tests (with sudo and timeout)
echo "Building test environment and running tests..."
timeout 300 sudo docker-compose -f docker-compose.test.yml up --build --exit-code-from tests
TEST_EXIT_CODE=$?

# Check if timeout occurred
if [ $TEST_EXIT_CODE -eq 124 ]; then
   echo "Tests timed out after 5 minutes. Aborting deployment."
   sudo docker-compose -f docker-compose.test.yml down
   exit 1
fi

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
   DEPLOY_RESULT=$?
   
   # Проверяем на ошибки портов
   if [ $DEPLOY_RESULT -ne 0 ]; then
       echo "Возникла ошибка при запуске контейнеров. Проверяем проблемы с портами..."
       if handle_port_conflicts; then
           echo "Deployment completed successfully after resolving port conflicts!"
       else
           echo "Failed to resolve port conflicts. Manual intervention required."
           exit 1
       fi
   else
       echo "Deployment completed successfully!"
   fi
else
   echo "Tests failed! Deployment aborted."
   sudo docker-compose -f docker-compose.test.yml down
   exit 1
fi

# Создаем документацию по портам, если еще не существует
if [ ! -f "PORTS.md" ]; then
   echo "# Используемые порты

## Продакшн
- 8080: HTTP (nginx → контейнер 80)
- 8443: HTTPS (nginx → контейнер 443)
- 3000: API сервер (Node.js)
- 3306/3307: MySQL 

## Тестирование
- 33306: Тестовая база данных MySQL
" > PORTS.md
   echo "Создана документация по портам в файле PORTS.md"
fi

echo "Скрипт deployment.sh завершен успешно"