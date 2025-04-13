// controllers/dispensingController.js - обновленная версия для прямой оплаты
const chemicalModel = require('../models/chemicalModel');
const dispensingModel = require('../models/dispensingModel');
const flowStateModel = require('../models/flowStateModel');
const transactionModel = require('../models/transactionModel');
const deviceModel = require('../models/deviceModel');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

/**
 * Рассчитать стоимость дозирования
 */
exports.calculateCost = async (req, res) => {
  try {
    const { device_id, tank_number, volume } = req.body;
    
    logger.info(`Calculate cost request: ${JSON.stringify(req.body)}`);
    
    // Валидация параметров
    if (!device_id || !tank_number || !volume) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // Проверяем существование устройства
    const device = await deviceModel.findById(device_id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Получаем информацию о химикате
    const chemical = await chemicalModel.findByDeviceAndTank(device_id, tank_number);
    
    if (!chemical) {
      return res.status(404).json({
        success: false,
        message: 'Chemical not found'
      });
    }
    
    // Рассчитываем стоимость
    const volumeInMl = parseFloat(volume);
    const cost = dispensingModel.calculateCost(chemical.price, volumeInMl);
    
    // Создаем новый ID сессии
    const sessionId = uuidv4();
    
    // Сохраняем в таблицу flow_states
    await flowStateModel.createOrUpdate({
      session_id: sessionId,
      device_id,
      stage: 'calculated',
      chemical_id: chemical.id,
      tank_number,
      volume: volumeInMl,
      amount: cost
    });
    
    return res.status(200).json({
      success: true,
      data: {
        session_id: sessionId,
        device_id,
        tank_number: parseInt(tank_number),
        chemical_name: chemical.name,
        volume: volumeInMl,
        price_per_liter: chemical.price,
        total_cost: cost
      }
    });
  } catch (error) {
    logger.error(`Error calculating cost: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate cost',
      error: error.message
    });
  }
};

/**
 * Проверить статус платежа и дозирования
 */
exports.checkStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.info(`Check status request for session: ${sessionId}`);
    
    // Получаем состояние процесса
    const flowState = await flowStateModel.getBySessionId(sessionId);
    
    if (!flowState) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    let status;
    let transaction = null;
    let dispensingInfo = null;
    
    // Определяем статус на основе этапа процесса
    switch (flowState.stage) {
      case 'calculated':
        status = 'ready_for_payment';
        break;
        
      case 'awaiting_payment':
        status = 'awaiting_payment';
        break;
        
      case 'payment_completed':
        status = 'payment_completed';
        // Получаем информацию о транзакции
        if (flowState.transaction_id) {
          const [rows] = await pool.execute(
            'SELECT * FROM transactions WHERE txn_id = ?',
            [flowState.transaction_id]
          );
          if (rows.length > 0) {
            transaction = rows[0];
          }
        }
        break;
        
      case 'dispensing':
        status = 'dispensing';
        break;
        
      case 'completed':
        status = 'completed';
        // Получаем информацию о дозировании
        if (flowState.transaction_id) {
          const [rows] = await pool.execute(
            'SELECT * FROM transactions WHERE txn_id = ?',
            [flowState.transaction_id]
          );
          if (rows.length > 0) {
            transaction = rows[0];
            
            const [dispRows] = await pool.execute(
              'SELECT * FROM dispensing_operations WHERE transaction_id = ?',
              [rows[0].id]
            );
            if (dispRows.length > 0) {
              dispensingInfo = dispRows[0];
            }
          }
        }
        break;
        
      default:
        status = 'unknown';
    }
    
    return res.status(200).json({
      success: true,
      data: {
        session_id: sessionId,
        status,
        device_id: flowState.device_id,
        stage: flowState.stage,
        tank_number: flowState.tank_number,
        volume: flowState.volume,
        amount: flowState.amount,
        transaction: transaction,
        dispensing: dispensingInfo
      }
    });
  } catch (error) {
    logger.error(`Error checking status: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to check status',
      error: error.message
    });
  }
};

/**
 * Выполнить дозирование после оплаты
 */
exports.dispense = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.info(`Dispense request for session: ${sessionId}`);
    
    // Получаем состояние процесса
    const flowState = await flowStateModel.getBySessionId(sessionId);
    
    if (!flowState) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    if (flowState.stage !== 'payment_completed') {
      return res.status(400).json({
        success: false,
        message: `Invalid stage for dispensing: ${flowState.stage}`
      });
    }
    
    // Получаем транзакцию
    const [transactions] = await pool.execute(
      'SELECT * FROM transactions WHERE txn_id = ?',
      [flowState.transaction_id]
    );
    
    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    const transaction = transactions[0];
    
    // Проверяем, не было ли уже выполнено дозирование
    if (transaction.dispensed) {
      return res.status(400).json({
        success: false,
        message: 'Transaction already dispensed'
      });
    }
    
    // Получаем информацию о химикате
    const chemical = await chemicalModel.findByDeviceAndTank(flowState.device_id, flowState.tank_number);
    
    if (!chemical) {
      return res.status(404).json({
        success: false,
        message: 'Chemical not found'
      });
    }
    
    // Создаем запись об операции дозирования
    const dispensingId = await dispensingModel.create({
      transaction_id: transaction.id,
      device_id: flowState.device_id,
      tank_number: flowState.tank_number,
      chemical_name: chemical.name,
      price_per_liter: chemical.price,
      volume: flowState.volume,
      total_cost: flowState.amount,
      status: 'completed',
      receipt_number: `R-${flowState.device_id}-${Date.now()}`
    });
    
    // Отмечаем транзакцию как обработанную (дозирование выполнено)
    await transactionModel.markAsDispensed(transaction.id);
    
    // Обновляем состояние процесса
    await flowStateModel.createOrUpdate({
      ...flowState,
      stage: 'completed'
    });
    
    return res.status(200).json({
      success: true,
      data: {
        session_id: sessionId,
        device_id: flowState.device_id,
        tank_number: flowState.tank_number,
        chemical_name: chemical.name,
        volume: flowState.volume,
        amount: flowState.amount,
        receipt_number: `R-${flowState.device_id}-${Date.now()}`
      }
    });
  } catch (error) {
    logger.error(`Error dispensing: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to dispense',
      error: error.message
    });
  }
};

/**
 * Получить историю дозирования
 */
exports.getHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    logger.info(`Get dispensing history for device: ${deviceId}`);
    
    // Проверяем существование устройства
    const device = await deviceModel.findById(deviceId);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Получаем операции дозирования
    const operations = await dispensingModel.getByDeviceId(
      deviceId, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    return res.status(200).json({
      success: true,
      data: {
        device_id: deviceId,
        operations,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting dispensing history: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get dispensing history',
      error: error.message
    });
  }
};