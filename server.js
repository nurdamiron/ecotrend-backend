// server.js - обновленная версия для системы прямой оплаты
const express = require('express');
const morgan = require('morgan');
const setupCors = require('./middleware/cors');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const config = require('./config/config');
const helmet = require('helmet');

// Импорт маршрутов
const deviceRoutes = require('./routes/deviceRoutes');
const dispensingRoutes = require('./routes/dispensingRoutes'); // Обновленные маршруты
const kaspiRoutes = require('./routes/kaspiRoutes'); // Обновленные маршруты
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');

// Инициализация Firebase с улучшенной обработкой ошибок
const firebase = require('./utils/firebase');
try {
  const firebaseInitialized = firebase.initializeFirebase();
  if (firebaseInitialized) {
    logger.info('Firebase initialized successfully');
  } else {
    logger.warn('Firebase initialization skipped or failed. Some functionality may be limited.');
  }
} catch (error) {
  logger.error(`Firebase initialization error: ${error.message}`);
  logger.warn('Continuing without Firebase. Some functionality will be limited.');
}

// Создание приложения Express
const app = express();

// Улучшение безопасности с помощью helmet
app.use(helmet({
  contentSecurityPolicy: false, // Отключение CSP для Swagger UI
  crossOriginEmbedderPolicy: false // Разрешить загрузку ресурсов из других источников
}));

// Настройка CORS
app.use(setupCors());

// Логирование запросов
app.use(morgan('combined', {
  skip: (req, res) => {
    // Пропускаем логирование эндпоинтов проверки состояния для уменьшения шума
    return req.path.startsWith('/api/health/liveness') || 
           req.path.startsWith('/api/health/readiness');
  }
}));

// Парсинг JSON и URL-encoded данных
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Добавление ID запроса для лучшего отслеживания
app.use((req, res, next) => {
  req.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Регистрация маршрутов
app.use('/api/devices', deviceRoutes);
app.use('/api/dispensing', dispensingRoutes); // Обновленные маршруты для дозирования
app.use('/api/kaspi', kaspiRoutes); // Обновленные маршруты для Kaspi
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

// Корневой маршрут API
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to EcoTrend API (Direct Payment Model)',
    version: config.app.version,
    environment: config.app.env,
    timestamp: new Date().toISOString()
  });
});

// Добавление документации Swagger, если доступна
try {
  const swagger = require('./swagger');
  app.use('/api/docs', swagger.serve, swagger.setup);
  logger.info('Swagger documentation initialized at /api/docs');
} catch (error) {
  logger.warn(`Swagger documentation not available: ${error.message}`);
}

// Обработка неизвестных маршрутов
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

// Middleware обработки ошибок
app.use(errorHandler);

// Обработка завершения работы
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Environment: ${config.app.env}`);
  logger.info(`Payment model: Direct payment (without balance)`);
});

module.exports = app;