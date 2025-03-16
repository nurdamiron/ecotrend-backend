// controllers/dispensingController.js
const balanceModel = require('../models/balanceModel');
const chemicalModel = require('../models/chemicalModel');
const dispensingModel = require('../models/dispensingModel');
const logger = require('../utils/logger');

/**
 * Дозировать химикат
 */
exports.dispenseChemical = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { tankNumber, volume } = req.body;
    
    logger.info(`Dispensing request for device: ${deviceId}, tank: ${tankNumber}, volume: ${volume}`);
    
    // Проверяем параметры
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
    
    // Получаем информацию о химикате
    const chemical = await chemicalModel.findByDeviceAndTank(deviceId, tankNumber);
    
    if (!chemical) {
      return res.status(404).json({
        success: false,
        message: 'Chemical not found'
      });
    }
    
    // Рассчитываем стоимость
    const cost = chemical.price * (volume / 1000); // Цена за литр, объем в мл
    
    // Создаем уникальный номер операции
    const operationId = `OP-${deviceId}-${Date.now()}`;
    
    // Создаем запись о дозировании
    const operation = {
      id: operationId,
      device_id: deviceId,
      tank_number: tankNumber,
      chemical_name: chemical.name,
      price_per_liter: chemical.price,
      volume: parseFloat(volume),
      total_cost: cost,
      expiration_date: chemical.expiration_date,
      batch_number: chemical.batch_number,
      receipt_number: `R-${deviceId}-${Date.now()}`
    };
    
    try {
      await dispensingModel.create(operation);
    } catch (error) {
      logger.error(`Error creating dispensing record: ${error.message}`);
    }
    
    // Отправляем успешный ответ
    return res.status(200).json({
      success: true,
      data: {
        operation_id: operationId,
        device_id: deviceId,
        tank_number: parseInt(tankNumber),
        chemical_name: chemical.name,
        volume: parseFloat(volume),
        total_cost: cost
      }
    });
  } catch (error) {
    logger.error(`Error dispensing chemical: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Получить историю дозирования
 */
exports.getDispensingHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    logger.info(`Get dispensing history for device: ${deviceId}`);
    
    // Получаем историю дозирования
    const history = await dispensingModel.getByDeviceId(
      deviceId, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    return res.status(200).json({
      success: true,
      data: {
        device_id: deviceId,
        history,
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
      message: 'Internal server error',
      error: error.message
    });
  }
};