// middleware/cors.js
const cors = require('cors');

/**
 * Настройка CORS для работы с клиентской частью
 */
const setupCors = () => {
  return cors({
    origin: '*', // Разрешаем запросы с любого источника
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
};

module.exports = setupCors;