// models/chemicalModel.js
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Модель для работы с химикатами
 */
const chemicalModel = {
  /**
   * Создать новый химикат
   * @param {Object} chemical - Данные химиката
   * @returns {Number} ID созданного химиката
   */
  async create(chemical) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO chemicals 
        (device_id, tank_number, name, price, batch_number, manufacturing_date, expiration_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          chemical.device_id,
          chemical.tank_number,
          chemical.name,
          chemical.price,
          chemical.batch_number || null,
          chemical.manufacturing_date || null,
          chemical.expiration_date || null
        ]
      );
      
      logger.info(`Chemical created: ${JSON.stringify(chemical)}`);
      return result.insertId;
    } catch (error) {
      logger.error(`Error creating chemical: ${error.message}`);
      throw error;
    }
  },

  /**
   * Обновить информацию о химикате
   * @param {Object} chemical - Данные химиката
   * @returns {Boolean} Успешно или нет
   */
  async update(chemical) {
    try {
      const [result] = await pool.execute(
        `UPDATE chemicals SET 
        name = ?, 
        price = ?, 
        batch_number = ?,
        manufacturing_date = ?,
        expiration_date = ?,
        updated_at = NOW() 
        WHERE device_id = ? AND tank_number = ?`,
        [
          chemical.name,
          chemical.price,
          chemical.batch_number || null,
          chemical.manufacturing_date || null,
          chemical.expiration_date || null,
          chemical.device_id,
          chemical.tank_number
        ]
      );
      
      logger.info(`Chemical updated: ${JSON.stringify(chemical)}`);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error(`Error updating chemical: ${error.message}`);
      throw error;
    }
  },

  /**
   * Найти химикат по ID устройства и номеру бака
   * @param {String} deviceId - ID устройства
   * @param {Number} tankNumber - Номер бака
   * @returns {Object|null} Химикат или null, если не найден
   */
  async findByDeviceAndTank(deviceId, tankNumber) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM chemicals WHERE device_id = ? AND tank_number = ?',
        [deviceId, tankNumber]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`Error finding chemical: ${error.message}`);
      throw error;
    }
  },

  /**
   * Обновить или создать информацию о химикате
   * @param {Object} chemical - Данные химиката
   * @returns {Object} Обновленный или созданный химикат
   */
  async updateOrCreate(chemical) {
    try {
      const existingChemical = await this.findByDeviceAndTank(
        chemical.device_id,
        chemical.tank_number
      );
      
      if (existingChemical) {
        await this.update(chemical);
        return await this.findByDeviceAndTank(chemical.device_id, chemical.tank_number);
      } else {
        const id = await this.create(chemical);
        return await this.findById(id);
      }
    } catch (error) {
      logger.error(`Error updating or creating chemical: ${error.message}`);
      throw error;
    }
  },

  /**
   * Найти химикат по ID
   * @param {Number} id - ID химиката
   * @returns {Object|null} Химикат или null, если не найден
   */
  async findById(id) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM chemicals WHERE id = ?',
        [id]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`Error finding chemical by ID: ${error.message}`);
      throw error;
    }
  },

  /**
   * Получить все химикаты для устройства
   * @param {String} deviceId - ID устройства
   * @returns {Array} Массив химикатов
   */
  async getByDeviceId(deviceId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM chemicals WHERE device_id = ? ORDER BY tank_number',
        [deviceId]
      );
      
      return rows;
    } catch (error) {
      logger.error(`Error getting chemicals by device ID: ${error.message}`);
      throw error;
    }
  }
};

module.exports = chemicalModel;