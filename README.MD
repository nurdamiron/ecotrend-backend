# Руководство по развертыванию и настройке интеграции с Kaspi

## Требования к системе

Для успешного развертывания и работы интеграции с Kaspi необходимы следующие компоненты:

- Docker и Docker Compose
- Nginx для обратного прокси и SSL
- MySQL-совместимая база данных
- Node.js (в контейнере Docker)
- Доступ к интернету для сервера на порты 80 и 443
- Статический IP-адрес для добавления в белый список Kaspi

## Шаги по развертыванию

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка необходимых пакетов
sudo apt install -y docker.io docker-compose git certbot python3-certbot-nginx

# Добавление текущего пользователя в группу docker
sudo usermod -aG docker $USER

# Перезагрузка группы (либо выполните выход и вход в систему)
newgrp docker
```

### 2. Клонирование репозитория

```bash
# Клонирование репозитория
git clone https://github.com/ecotrend/ecotrend-backend.git
cd ecotrend-backend
```

### 3. Настройка переменных окружения

Создайте файл `.env` в корневой директории проекта:

```bash
# Создание файла .env на основе примера
cp .env.example .env

# Редактирование файла переменных окружения
nano .env
```

Пример содержимого файла `.env`:

```
# Порт сервера
PORT=4000

# Настройки базы данных
DB_HOST=biz360.czwiyugwum02.eu-north-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_secure_password
DB_NAME=ecotrend

# Настройки Kaspi
API_BASE_URL=https://pay.ecotrend.kz/api
KASPI_ALLOWED_IP=194.187.247.152

# Настройки Firebase (если используется)
FIREBASE_DB_URL=https://your-firebase-url.firebasedatabase.app/
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# JWT секрет
JWT_SECRET=your_secure_jwt_secret

# Логирование
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log

# MySQL Root пароль
MYSQL_ROOT_PASSWORD=your_secure_mysql_password
```

### 4. Настройка SSL с Certbot

```bash
# Получение SSL-сертификата
sudo certbot --nginx -d pay.ecotrend.kz
```

### 5. Настройка Nginx

Создайте конфигурационный файл для Nginx:

```bash
# Создание директории для конфигурации Nginx
mkdir -p nginx/conf.d

# Создание конфигурационного файла
nano nginx/conf.d/ecotrend.conf
```

Пример конфигурации Nginx:

```nginx
server {
    listen 80;
    server_name pay.ecotrend.kz;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name pay.ecotrend.kz;

    ssl_certificate /etc/letsencrypt/live/pay.ecotrend.kz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pay.ecotrend.kz/privkey.pem;

    location / {
        proxy_pass http://api:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6. Запуск системы

```bash
# Сборка и запуск контейнеров
docker-compose build
docker-compose up -d

# Проверка запущенных контейнеров
docker-compose ps

# Просмотр логов
docker-compose logs -f
```

### 7. Создание базы данных (если необходимо)

```bash
# Доступ к MySQL в контейнере
docker-compose exec db mysql -u root -p

# Создание базы данных и таблиц
CREATE DATABASE ecotrend;
USE ecotrend;

# Выполните SQL-скрипты из файла init.sql
# Либо запустите скрипт инициализации:
docker-compose exec db mysql -u root -p ecotrend < init.sql
```

## Проверка работоспособности

### Проверка доступности API

```bash
# Проверка статуса API
curl -k https://pay.ecotrend.kz/api/kaspi/status

# Ожидаемый результат:
# {"success":true,"message":"Kaspi API is working properly","timestamp":"..."}
```

### Тестирование интеграции с Kaspi

Вы можете использовать следующие команды для имитации запросов от Kaspi:

```bash
# Тестирование проверки состояния устройства
curl -k "https://pay.ecotrend.kz/api/kaspi/check?command=check&txn_id=1234567&account=TEST-DEVICE-001&sum=500.00"

# Тестирование проведения платежа
curl -k "https://pay.ecotrend.kz/api/kaspi/pay?command=pay&txn_id=7654321&txn_date=20250307123456&account=TEST-DEVICE-001&sum=500.00"
```

## Мониторинг и обслуживание

### Просмотр логов

```bash
# Просмотр логов API
docker-compose logs -f api

# Просмотр логов Nginx
docker-compose logs -f nginx

# Просмотр логов базы данных
docker-compose logs -f db
```

### Обновление системы

```bash
# Остановка контейнеров
docker-compose down

# Получение последних изменений
git pull

# Пересборка и запуск контейнеров
docker-compose build
docker-compose up -d
```

### Резервное копирование

```bash
# Резервное копирование базы данных
docker-compose exec db mysqldump -u root -p ecotrend > backup_$(date +%Y%m%d%H%M%S).sql

# Резервное копирование переменных окружения
cp .env .env.backup_$(date +%Y%m%d%H%M%S)
```

## Решение проблем

### Проблема: API недоступен

1. Проверьте, запущены ли контейнеры: `docker-compose ps`
2. Проверьте логи API: `docker-compose logs -f api`
3. Убедитесь, что порты не заблокированы брандмауэром

### Проблема: Ошибки подключения к базе данных

1. Проверьте параметры подключения в файле `.env`
2. Проверьте доступность базы данных: `docker-compose exec db mysql -u root -p -e "SHOW DATABASES;"`
3. Проверьте логи базы данных: `docker-compose logs -f db`

### Проблема: Ошибки в запросах от Kaspi

1. Проверьте, что IP-адрес Kaspi добавлен в переменную `KASPI_ALLOWED_IP`
2. Проверьте формат запросов согласно документации
3. Проверьте логи API для детальной информации об ошибках

## Контакты для поддержки

При возникновении проблем с интеграцией обращайтесь в службу поддержки:

- Email: nurdamiron@gmail.com
