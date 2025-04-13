// utils/kaspiApi.js - обновленная версия для системы прямой оплаты
const axios = require('axios');
const config = require('../config/config');
const logger = require('./logger');

/**
 * Создать экземпляр axios для работы с API Kaspi
 */
const kaspiApi = axios.create({
  baseURL: config.kaspi.apiUrl,
  timeout: config.kaspi.timeout,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Отправить запрос в API Kaspi
 * @param {String} method - HTTP метод (GET, POST, etc.)
 * @param {String} endpoint - Эндпоинт API
 * @param {Object} data - Данные для отправки
 * @returns {Object} Ответ от API
 */
const sendRequest = async (method, endpoint, data = {}) => {
  try {
    const response = await kaspiApi({
      method,
      url: endpoint,
      data: method.toUpperCase() === 'GET' ? null : data,
      params: method.toUpperCase() === 'GET' ? data : null
    });
    
    logger.info(`Kaspi API response from ${endpoint}: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    logger.error(`Kaspi API error: ${error.message}`);
    throw error;
  }
};

/**
 * Генерировать URL для QR-кода Kaspi для прямой оплаты
 * @param {String} deviceId - ID устройства
 * @param {Number} amount - Сумма платежа
 * @param {String} txnId - ID транзакции для отслеживания
 * @returns {String} URL для QR-кода
 */
const generateQRCodeUrl = (deviceId, amount, txnId) => {
  // Формируем URL для QR-кода Kaspi с учетом ID транзакции
  const qrCodeUrl = `https://pay.kaspi.kz/payment?service=${config.kaspi.bin || 'CHEMICAL_DISPENSING'}&account=${deviceId}&amount=${amount}&txn_id=${txnId}`;
  
  logger.info(`Generated QR code URL for device ${deviceId}, amount ${amount}, txn_id ${txnId}: ${qrCodeUrl}`);
  return qrCodeUrl;
};

/**
 * Проверить статус платежа
 * @param {String} txnId - ID транзакции
 * @returns {Object} Статус платежа
 */
const checkPaymentStatus = async (txnId) => {
  try {
    // Примерная структура запроса, уточните в документации Kaspi
    const response = await sendRequest('GET', '/check-status', {
      txn_id: txnId
    });
    
    return response;
  } catch (error) {
    logger.error(`Error checking payment status: ${error.message}`);
    throw error;
  }
};

/**
 * Создать уникальный ID транзакции для Kaspi
 * @returns {String} Уникальный ID транзакции
 */
const generateTransactionId = () => {
  return `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
};

module.exports = {
  sendRequest,
  generateQRCodeUrl,
  checkPaymentStatus,
  generateTransactionId
};