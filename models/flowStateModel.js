// models/flowStateModel.js
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Model for tracking user flow from QR scan to dispensing
 */
const flowStateModel = {
  /**
   * Create or update a flow state
   * @param {Object} flowState - Flow state data
   * @returns {Number} ID of the flow state
   */
  async createOrUpdate(flowState) {
    try {
      const { session_id, device_id, stage, chemical_id, volume, amount, transaction_id } = flowState;
      
      // Check if session exists
      const [existing] = await pool.execute(
        'SELECT id FROM flow_states WHERE session_id = ?',
        [session_id]
      );
      
      if (existing.length > 0) {
        // Update existing flow
        await pool.execute(
          `UPDATE flow_states SET 
           stage = ?, 
           chemical_id = ?, 
           volume = ?,
           amount = ?,
           transaction_id = ?,
           updated_at = NOW()
           WHERE session_id = ?`,
          [stage, chemical_id, volume, amount, transaction_id, session_id]
        );
        return existing[0].id;
      } else {
        // Create new flow
        const [result] = await pool.execute(
          `INSERT INTO flow_states 
           (session_id, device_id, stage, chemical_id, volume, amount, transaction_id) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [session_id, device_id, stage, chemical_id, volume, amount, transaction_id]
        );
        
        return result.insertId;
      }
    } catch (error) {
      logger.error(`Error creating/updating flow state: ${error.message}`);
      throw error;
    }
  },

  /**
   * Get flow state by session ID
   * @param {String} sessionId - Session ID
   * @returns {Object} Flow state
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
   * Get active flow state by device ID
   * @param {String} deviceId - Device ID
   * @returns {Object} Flow state
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