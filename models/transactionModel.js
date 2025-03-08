// models/transactionModel.js
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Модель для работы с транзакциями Kaspi
 */
const transactionModel = {
  /**
   * Создать запись о транзакции
   * @param {Object} transaction - Данные транзакции
   * @param {Object} connection - Соединение с базой данных для транзакции
   * @returns {Number} ID созданной транзакции
   */
  async create(transaction, connection) {
    try {
      const conn = connection || pool;
      
      const [result] = await conn.execute(
        `INSERT INTO transactions 
         (txn_id, prv_txn_id, device_id, amount, txn_date, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          transaction.txn_id,
          transaction.prv_txn_id,
          transaction.device_id,
          transaction.amount,
          transaction.txn_date,
          transaction.status
        ]
      );
      
      logger.info(`Transaction created: ${JSON.stringify(transaction)}`);
      return result.insertId;
    } catch (error) {
      logger.error(`Error creating transaction: ${error.message}`);
      throw error;
    }
  },

  /**
   * Найти транзакцию по ID транзакции Kaspi
   * @param {String} txnId - ID транзакции в системе Kaspi
   * @param {Object} connection - Соединение с базой данных для транзакции
   * @returns {Object|null} Транзакция или null, если не найдена
   */
  async findByTxnId(txnId, connection) {
    try {
      const conn = connection || pool;
      
      const [rows] = await conn.execute(
        'SELECT * FROM transactions WHERE txn_id = ?',
        [txnId]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`Error finding transaction: ${error.message}`);
      throw error;
    }
  },

  /**
   * Получить все транзакции устройства
   * @param {String} deviceId - ID устройства
   * @param {Number} limit - Максимальное количество записей
   * @param {Number} offset - Сдвиг для пагинации
   * @returns {Array} Массив транзакций
   */
  async getByDeviceId(deviceId, limit = 10, offset = 0) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM transactions WHERE device_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [deviceId, limit, offset]
      );
      
      return rows;
    } catch (error) {
      logger.error(`Error getting transactions by device ID: ${error.message}`);
      throw error;
    }
  },

  /**
   * Обновить статус транзакции
   * @param {Number} id - ID транзакции
   * @param {Number} status - Новый статус
   * @returns {Boolean} Успешно или нет
   */
  async updateStatus(id, status) {
    try {
      const [result] = await pool.execute(
        'UPDATE transactions SET status = ? WHERE id = ?',
        [status, id]
      );
      
      logger.info(`Transaction status updated: ID ${id}, status ${status}`);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error(`Error updating transaction status: ${error.message}`);
      throw error;
    }
  }
};

module.exports = transactionModel;