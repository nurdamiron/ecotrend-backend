// utils/kaspiApi.js
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
 * Генерировать URL для QR-кода Kaspi
 * @param {String} deviceId - ID устройства
 * @param {Number} amount - Сумма платежа
 * @returns {String} URL для QR-кода
 */
const generateQRCodeUrl = (deviceId, amount) => {
  // Здесь нужно указать правильный формат URL для QR-кода Kaspi
  // Это примерная структура, уточните в документации Kaspi
  const qrCodeUrl = `https://pay.kaspi.kz/payment?service=CHEMICAL_DISPENSING&account=${deviceId}&amount=${amount}`;
  
  logger.info(`Generated QR code URL for device ${deviceId}: ${qrCodeUrl}`);
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

module.exports = {
  sendRequest,
  generateQRCodeUrl,
  checkPaymentStatus
};