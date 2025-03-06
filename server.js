// server.js - Основная точка входа в приложение
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Загрузка переменных окружения
dotenv.config();

// Инициализация Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Безопасность
app.use(cors()); // CORS
app.use(express.json()); // Парсинг JSON
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // Логирование

// Маршруты
app.use('/api/devices', require('./routes/deviceRoutes'));
app.use('/api/kaspi', require('./routes/kaspiRoutes'));
app.use('/api/balance', require('./routes/balanceRoutes'));

// Обработка ошибок
app.use(errorHandler);

// Запуск сервера
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Обработка необработанных промисов
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;