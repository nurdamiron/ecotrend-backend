// models/flowStateModel.js
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Модель для отслеживания процесса от выбора химиката до дозирования
 */
const flowStateModel = {
  /**
   * Создать или обновить состояние процесса
   * @param {Object} flowState - Данные состояния
   * @returns {Number} ID созданного/обновленного состояния
   */
  async createOrUpdate(flowState) {
    try {
      const { session_id, device_id, stage, chemical_id, tank_number, volume, amount, transaction_id } = flowState;
      
      // Проверяем, существует ли уже сессия
      const [existing] = await pool.execute(
        'SELECT id FROM flow_states WHERE session_id = ?',
        [session_id]
      );
      
      if (existing.length > 0) {
        // Обновляем существующую запись
        await pool.execute(
          `UPDATE flow_states SET 
           stage = ?, 
           chemical_id = ?,
           tank_number = ?, 
           volume = ?,
           amount = ?,
           transaction_id = ?,
           updated_at = NOW()
           WHERE session_id = ?`,
          [stage, chemical_id, tank_number, volume, amount, transaction_id, session_id]
        );
        return existing[0].id;
      } else {
        // Создаем новую запись
        const [result] = await pool.execute(
          `INSERT INTO flow_states 
           (session_id, device_id, stage, chemical_id, tank_number, volume, amount, transaction_id) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [session_id, device_id, stage, chemical_id, tank_number, volume, amount, transaction_id]
        );
        
        return result.insertId;
      }
    } catch (error) {
      logger.error(`Error creating/updating flow state: ${error.message}`);
      throw error;
    }
  },

  /**
   * Получить состояние процесса по ID сессии
   * @param {String} sessionId - ID сессии
   * @returns {Object} Состояние процесса
   */
  async getBySessionId(sessionId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM flow_states WHERE session_id = ?',
        [sessionId]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`Error getting flow state: ${error.message}`);
      throw error;
    }
  },

  /**
   * Получить активное состояние процесса для устройства
   * @param {String} deviceId - ID устройства
   * @returns {Object} Состояние процесса
   */
  async getActiveByDeviceId(deviceId) {
    try {
      const [rows] = await pool.execute(
        `SELECT * FROM flow_states 
         WHERE device_id = ? AND stage != 'completed' AND created_at > NOW() - INTERVAL 1 DAY
         ORDER BY created_at DESC LIMIT 1`,
        [deviceId]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`Error getting active flow state: ${error.message}`);
      throw error;
    }
  }
};

module.exports = flowStateModel;