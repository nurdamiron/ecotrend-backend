// models/balanceModel.js
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const firebase = require('../utils/firebase');

/**
 * Модель для работы с балансами устройств
 */
const balanceModel = {
  /**
   * Получить текущий баланс устройства
   * @param {String} deviceId - ID устройства
   * @returns {Number} Текущий баланс
   */
  async getBalance(deviceId) {
    try {
      const [rows] = await pool.execute(
        'SELECT balance FROM balances WHERE device_id = ?',
        [deviceId]
      );
      
      return rows.length > 0 ? parseFloat(rows[0].balance) : 0;
    } catch (error) {
      logger.error(`Error getting balance: ${error.message}`);
      throw error;
    }
  },

  /**
   * Обновить баланс устройства
   * @param {String} deviceId - ID устройства
   * @param {Number} amount - Сумма для добавления к балансу
   * @param {Object} connection - Соединение с базой данных для транзакции
   * @returns {Boolean} Успешно или нет
   */
  async updateBalance(deviceId, amount, connection) {
    try {
      const conn = connection || pool;
      
      // Получаем текущий баланс
      const [rows] = await conn.execute(
        'SELECT balance FROM balances WHERE device_id = ?',
        [deviceId]
      );
      
      if (rows.length > 0) {
        // Если запись уже существует, обновляем баланс
        const currentBalance = parseFloat(rows[0].balance);
        const newBalance = currentBalance + amount;
        
        await conn.execute(
          'UPDATE balances SET balance = ?, updated_at = NOW() WHERE device_id = ?',
          [newBalance, deviceId]
        );
      } else {
        // Если записи нет, создаем новую
        await conn.execute(
          'INSERT INTO balances (device_id, balance) VALUES (?, ?)',
          [deviceId, amount]
        );
      }
      
      // Синхронизируем баланс с Firebase
      await firebase.updateDeviceBalance(deviceId, amount);
      
      logger.info(`Balance updated for device ${deviceId}: +${amount}`);
      return true;
    } catch (error) {
      logger.error(`Error updating balance: ${error.message}`);
      throw error;
    }
  },

  /**
   * Уменьшить баланс устройства (при расходовании средств)
   * @param {String} deviceId - ID устройства
   * @param {Number} amount - Сумма для вычитания из баланса
   * @param {Object} connection - Соединение с базой данных для транзакции
   * @returns {Boolean} Успешно или нет
   */
  async decreaseBalance(deviceId, amount, connection) {
    try {
      const conn = connection || pool;
      
      // Получаем текущий баланс
      const [rows] = await conn.execute(
        'SELECT balance FROM balances WHERE device_id = ?',
        [deviceId]
      );
      
      if (rows.length === 0) {
        logger.warn(`Device ${deviceId} not found in balances`);
        return false;
      }
      
      const currentBalance = parseFloat(rows[0].balance);
      
      // Проверяем, достаточно ли средств
      if (currentBalance < amount) {
        logger.warn(`Insufficient balance for device ${deviceId}: ${currentBalance} < ${amount}`);
        return false;
      }
      
      // Обновляем баланс
      const newBalance = currentBalance - amount;
      await conn.execute(
        'UPDATE balances SET balance = ?, updated_at = NOW() WHERE device_id = ?',
        [newBalance, deviceId]
      );
      
      // Синхронизируем баланс с Firebase
      await firebase.updateDeviceBalance(deviceId, -amount);
      
      logger.info(`Balance decreased for device ${deviceId}: -${amount}`);
      return true;
    } catch (error) {
      logger.error(`Error decreasing balance: ${error.message}`);
      throw error;
    }
  }
};

module.exports = balanceModel;