// controllers/balanceController.js
const balanceModel = require('../models/balanceModel');
const transactionModel = require('../models/transactionModel');
const logger = require('../utils/logger');

/**
 * Получить текущий баланс устройства
 */
exports.getBalance = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    logger.info(`Get balance request for device: ${deviceId}`);
    
    const balance = await balanceModel.getBalance(deviceId);
    
    return res.status(200).json({
      success: true,
      data: {
        device_id: deviceId,
        balance
      }
    });
  } catch (error) {
    logger.error(`Error getting balance: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get balance',
      error: error.message
    });
  }
};

/**
 * Обновить баланс устройства (для тестирования)
 */
exports.updateBalance = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { amount } = req.body;
    
    if (!amount || isNaN(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }
    
    logger.info(`Update balance request for device: ${deviceId}, amount: ${amount}`);
    
    const success = await balanceModel.updateBalance(deviceId, parseFloat(amount));
    const newBalance = await balanceModel.getBalance(deviceId);
    
    return res.status(200).json({
      success: true,
      data: {
        device_id: deviceId,
        balance: newBalance,
        amount_added: parseFloat(amount)
      }
    });
  } catch (error) {
    logger.error(`Error updating balance: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to update balance',
      error: error.message
    });
  }
};

/**
 * Уменьшить баланс устройства (при использовании химикатов)
 */
exports.decreaseBalance = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { amount, tankNumber, volume } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }
    
    if (!tankNumber || isNaN(tankNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tank number'
      });
    }
    
    if (!volume || isNaN(volume) || volume <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid volume'
      });
    }
    
    logger.info(`Decrease balance request for device: ${deviceId}, amount: ${amount}, tank: ${tankNumber}, volume: ${volume}`);
    
    const success = await balanceModel.decreaseBalance(deviceId, parseFloat(amount));
    
    if (!success) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance or device not found'
      });
    }
    
    const newBalance = await balanceModel.getBalance(deviceId);
    
    // Здесь можно добавить логику для записи операции дозирования в БД
    
    return res.status(200).json({
      success: true,
      data: {
        device_id: deviceId,
        balance: newBalance,
        amount_deducted: parseFloat(amount),
        tank_number: tankNumber,
        volume: parseFloat(volume)
      }
    });
  } catch (error) {
    logger.error(`Error decreasing balance: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to decrease balance',
      error: error.message
    });
  }
};

/**
 * Получить историю транзакций
 */
exports.getTransactions = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    logger.info(`Get transactions request for device: ${deviceId}`);
    
    const transactions = await transactionModel.getByDeviceId(
      deviceId, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    return res.status(200).json({
      success: true,
      data: {
        device_id: deviceId,
        transactions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting transactions: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get transactions',
      error: error.message
    });
  }
};