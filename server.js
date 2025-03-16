// app.js
const express = require('express');
const morgan = require('morgan');
const setupCors = require('./middleware/cors');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const config = require('./config/config');

// Импорт маршрутов
const deviceRoutes = require('./routes/deviceRoutes');
const balanceRoutes = require('./routes/balanceRoutes');
const kaspiRoutes = require('./routes/kaspiRoutes');
const dispensingRoutes = require('./routes/dispensingRoutes');

// Инициализация Firebase
const firebase = require('./utils/firebase');
try {
  firebase.initializeFirebase();
} catch (error) {
  logger.warn(`Firebase initialization failed: ${error.message}`);
}

// Создание экземпляра приложения
const app = express();

// Настройка CORS
app.use(setupCors());

// Логирование запросов
app.use(morgan('dev'));

// Парсинг JSON и URL-encoded данных
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Регистрация маршрутов
app.use('/api/devices', deviceRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/kaspi', kaspiRoutes);
app.use('/api/dispensing', dispensingRoutes);

// Корневой маршрут API
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to EcoTrend API',
    version: config.app.version
  });
});

// Маршрут для проверки здоровья системы
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'System is healthy',
    timestamp: new Date().toISOString()
  });
});

// Обработка неизвестных маршрутов
app.use((req, res, next) => {
  const error = new Error('Route not found');
  error.statusCode = 404;
  next(error);
});

// Обработка ошибок
app.use(errorHandler);

// Запуск сервера
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

module.exports = app;