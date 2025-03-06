// models/deviceModel.js
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Модель для работы с устройствами
 */
const deviceModel = {
  /**
   * Создать новое устройство
   * @param {Object} device - Данные устройства
   * @returns {Object} Созданное устройство
   */
  async create(device) {
    try {
      const [result] = await pool.execute(
        'INSERT INTO devices (device_id, name, location) VALUES (?, ?, ?)',
        [device.device_id, device.name, device.location]
      );
      
      logger.info(`Device created: ${JSON.stringify(device)}`);
      
      return { ...device, created_at: new Date() };
    } catch (error) {
      logger.error(`Error creating device: ${error.message}`);
      throw error;
    }
  },

  /**
   * Найти устройство по ID
   * @param {String} deviceId - ID устройства
   * @returns {Object|null} Устройство или null, если не найдено
   */
  async findById(deviceId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM devices WHERE device_id = ?',
        [deviceId]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`Error finding device by ID: ${error.message}`);
      throw error;
    }
  },

  /**
   * Обновить информацию об устройстве
   * @param {String} deviceId - ID устройства
   * @param {Object} updateData - Данные для обновления
   * @returns {Object} Обновленное устройство
   */
  async update(deviceId, updateData) {
    try {
      const allowedFields = ['name', 'location'];
      const updates = [];
      const values = [];
      
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }
      
      if (updates.length === 0) {
        const device = await this.findById(deviceId);
        return device;
      }
      
      values.push(deviceId);
      
      const [result] = await pool.execute(
        `UPDATE devices SET ${updates.join(', ')} WHERE device_id = ?`,
        values
      );
      
      logger.info(`Device updated: ${deviceId}`);
      
      return await this.findById(deviceId);
    } catch (error) {
      logger.error(`Error updating device: ${error.message}`);
      throw error;
    }
  },

  /**
   * Получить список всех устройств
   * @param {Number} limit - Максимальное количество записей
   * @param {Number} offset - Сдвиг для пагинации
   * @returns {Array} Массив устройств
   */
  async getAll(limit = 10, offset = 0) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM devices ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
      
      return rows;
    } catch (error) {
      logger.error(`Error getting all devices: ${error.message}`);
      throw error;
    }
  },

  /**
   * Инициализировать баланс устройства
   * @param {String} deviceId - ID устройства
   * @returns {Boolean} Успешно или нет
   */
  async initBalance(deviceId) {
    try {
      // Проверяем, нет ли уже записи баланса для этого устройства
      const [rows] = await pool.execute(
        'SELECT * FROM balances WHERE device_id = ?',
        [deviceId]
      );
      
      if (rows.length > 0) {
        logger.info(`Balance for device ${deviceId} already exists`);
        return true;
      }
      
      await pool.execute(
        'INSERT INTO balances (device_id, balance) VALUES (?, 0)',
        [deviceId]
      );
      
      logger.info(`Balance initialized for device ${deviceId}`);
      return true;
    } catch (error) {
      logger.error(`Error initializing balance: ${error.message}`);
      throw error;
    }
  },

  /**
   * Установить баланс устройства
   * @param {String} deviceId - ID устройства
   * @param {Number} balance - Баланс
   * @returns {Boolean} Успешно или нет
   */
  async setBalance(deviceId, balance) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM balances WHERE device_id = ?',
        [deviceId]
      );
      
      if (rows.length > 0) {
        await pool.execute(
          'UPDATE balances SET balance = ?, updated_at = NOW() WHERE device_id = ?',
          [balance, deviceId]
        );
      } else {
        await pool.execute(
          'INSERT INTO balances (device_id, balance) VALUES (?, ?)',
          [deviceId, balance]
        );
      }
      
      logger.info(`Balance set for device ${deviceId}: ${balance}`);
      return true;
    } catch (error) {
      logger.error(`Error setting balance: ${error.message}`);
      throw error;
    }
  }
};

module.exports = deviceModel;