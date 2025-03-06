// middleware/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const deviceModel = require('../models/deviceModel');
const logger = require('../utils/logger');

/**
 * Проверка IP-адреса для запросов от Kaspi
 */
exports.validateKaspiIP = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  logger.info(`Request from IP: ${clientIp}`);
  
  // Проверка IP-адреса (в рабочей среде нужно будет раскомментировать)
  // if (clientIp !== config.kaspi.ip) {
  //   logger.warn(`Unauthorized IP attempt: ${clientIp}`);
  //   return res.status(403).json({
  //     success: false,
  //     message: 'Forbidden: Invalid IP address'
  //   });
  // }
  
  // В тестовой среде пропускаем все IP
  next();
};

/**
 * Аутентификация устройства по токену
 */
exports.authenticateDevice = async (req, res, next) => {
  try {
    // Получение токена из заголовка Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No token provided'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Проверка токена
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Проверка, что токен принадлежит устройству
    if (decoded.type !== 'device') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Invalid token type'
      });
    }
    
    // Проверка, что устройство существует
    const device = await deviceModel.findById(decoded.device_id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Проверка, что запрашиваемое устройство соответствует токену
    // (если в маршруте указан deviceId)
    if (req.params.deviceId && req.params.deviceId !== decoded.device_id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Token does not match requested device'
      });
    }
    
    // Добавление информации об устройстве в запрос
    req.device = device;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid token'
      });
    }
    
    logger.error(`Auth error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Аутентификация администратора
 */
exports.authenticateAdmin = (req, res, next) => {
  try {
    // Получение токена из заголовка Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No token provided'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Проверка токена
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Проверка, что токен принадлежит администратору
    if (decoded.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Admin privileges required'
      });
    }
    
    // Добавление информации об администраторе в запрос
    req.admin = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid token'
      });
    }
    
    logger.error(`Admin auth error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};