// models/dispensingModel.js
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Модель для работы с операциями дозирования
 */
const dispensingModel = {
  /**
   * Создать запись об операции дозирования
   * @param {Object} operation - Данные операции
   * @returns {Number} ID созданной операции
   */
  async create(operation) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO dispensing_operations 
         (device_id, transaction_id, tank_number, chemical_name, price_per_liter, 
          volume, total_cost, expiration_date, batch_number, receipt_number) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          operation.device_id,
          operation.transaction_id,
          operation.tank_number,
          operation.chemical_name,
          operation.price_per_liter,
          operation.volume,
          operation.total_cost,
          operation.expiration_date || null,
          operation.batch_number || null,
          operation.receipt_number || null
        ]
      );
      
      logger.info(`Dispensing operation created: ${JSON.stringify(operation)}`);
      return result.insertId;
    } catch (error) {
      logger.error(`Error creating dispensing operation: ${error.message}`);
      throw error;
    }
  },

  /**
   * Получить операции дозирования для устройства
   * @param {String} deviceId - ID устройства
   * @param {Number} limit - Максимальное количество записей
   * @param {Number} offset - Сдвиг для пагинации
   * @returns {Array} Массив операций
   */
  async getByDeviceId(deviceId, limit = 10, offset = 0) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM dispensing_operations WHERE device_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [deviceId, limit, offset]
      );
      
      return rows;
    } catch (error) {
      logger.error(`Error getting dispensing operations by device ID: ${error.message}`);
      throw error;
    }
  },

  /**
   * Получить операции дозирования по ID транзакции
   * @param {Number} transactionId - ID транзакции
   * @returns {Array} Массив операций
   */
  async getByTransactionId(transactionId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM dispensing_operations WHERE transaction_id = ?',
        [transactionId]
      );
      
      return rows;
    } catch (error) {
      logger.error(`Error getting dispensing operations by transaction ID: ${error.message}`);
      throw error;
    }
  },

  /**
   * Создать чек для операции дозирования
   * @param {Number} operationId - ID операции
   * @param {String} receiptNumber - Номер чека
   * @returns {Boolean} Успешно или нет
   */
  async updateReceiptNumber(operationId, receiptNumber) {
    try {
      const [result] = await pool.execute(
        'UPDATE dispensing_operations SET receipt_number = ? WHERE id = ?',
        [receiptNumber, operationId]
      );
      
      logger.info(`Dispensing operation receipt updated: ID ${operationId}, receipt ${receiptNumber}`);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error(`Error updating dispensing operation receipt: ${error.message}`);
      throw error;
    }
  }
};

module.exports = dispensingModel;
