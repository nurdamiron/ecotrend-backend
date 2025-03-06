// middleware/errorHandler.js
const logger = require('../utils/logger');

/**
 * Обработчик ошибок для Express
 */
exports.errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  logger.error(`Error: ${message}`, { stack: err.stack });
  
  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};