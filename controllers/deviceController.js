// controllers/deviceController.js
const deviceModel = require('../models/deviceModel');
const chemicalModel = require('../models/chemicalModel');
const firebase = require('../utils/firebase');
const logger = require('../utils/logger');

/**
 * Зарегистрировать новое устройство
 */
exports.registerDevice = async (req, res) => {
  try {
    const { device_id, name, location } = req.body;
    
    if (!device_id || !name) {
      return res.status(400).json({
        success: false,
        message: 'Device ID and name are required'
      });
    }
    
    logger.info(`Register device request: ${JSON.stringify(req.body)}`);
    
    // Проверить, не существует ли уже устройство с таким ID
    const existingDevice = await deviceModel.findById(device_id);
    
    if (existingDevice) {
      return res.status(400).json({
        success: false,
        message: 'Device with this ID already exists'
      });
    }
    
    // Создать устройство
    const device = await deviceModel.create({
      device_id,
      name,
      location: location || ''
    });
    
    // Инициализировать баланс устройства
    await deviceModel.initBalance(device_id);
    
    // Синхронизировать с Firebase, если устройство уже существует там
    try {
      await firebase.syncDeviceData(device_id);
    } catch (error) {
      logger.warn(`Failed to sync device with Firebase: ${error.message}`);
    }
    
    return res.status(201).json({
      success: true,
      data: device
    });
  } catch (error) {
    logger.error(`Error registering device: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to register device',
      error: error.message
    });
  }
};

/**
 * Получить информацию об устройстве
 */
exports.getDeviceInfo = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    logger.info(`Get device info request for: ${deviceId}`);
    
    const device = await deviceModel.findById(deviceId);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: device
    });
  } catch (error) {
    logger.error(`Error getting device info: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get device info',
      error: error.message
    });
  }
};

/**
 * Обновить информацию об устройстве
 */
exports.updateDeviceInfo = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const updateData = req.body;
    
    logger.info(`Update device info request for: ${deviceId}`);
    
    // Проверить, существует ли устройство
    const device = await deviceModel.findById(deviceId);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Обновить устройство
    const updatedDevice = await deviceModel.update(deviceId, updateData);
    
    return res.status(200).json({
      success: true,
      data: updatedDevice
    });
  } catch (error) {
    logger.error(`Error updating device info: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to update device info',
      error: error.message
    });
  }
};

/**
 * Получить список всех устройств
 */
exports.getAllDevices = async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    
    logger.info('Get all devices request');
    
    const devices = await deviceModel.getAll(parseInt(limit), parseInt(offset));
    
    return res.status(200).json({
      success: true,
      data: {
        devices,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting all devices: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get devices',
      error: error.message
    });
  }
};

/**
 * Синхронизировать данные устройства с Firebase
 */
exports.syncWithFirebase = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    logger.info(`Sync device with Firebase request for: ${deviceId}`);
    
    // Проверить, существует ли устройство
    const device = await deviceModel.findById(deviceId);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Получить данные из Firebase
    const firebaseData = await firebase.syncDeviceData(deviceId);
    
    // Обновить химикаты в базе данных
    if (firebaseData && firebaseData.containers) {
      for (const [tankId, tankData] of Object.entries(firebaseData.containers)) {
        await chemicalModel.updateOrCreate({
          device_id: deviceId,
          tank_number: parseInt(tankId.replace('tank', '')),
          name: tankData.name,
          price: tankData.price
        });
      }
    }
    
    // Обновить баланс
    if (firebaseData && firebaseData.balance !== undefined) {
      await deviceModel.setBalance(deviceId, firebaseData.balance);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Device synced with Firebase successfully',
      data: {
        device_id: deviceId,
        firebase_data: firebaseData
      }
    });
  } catch (error) {
    logger.error(`Error syncing with Firebase: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync with Firebase',
      error: error.message
    });
  }
};

/**
 * Получить информацию о химикатах устройства
 */
exports.getChemicals = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    logger.info(`Get chemicals request for device: ${deviceId}`);
    
    // Проверить, существует ли устройство
    const device = await deviceModel.findById(deviceId);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Получить химикаты из базы данных
    const chemicals = await chemicalModel.getByDeviceId(deviceId);
    
    return res.status(200).json({
      success: true,
      data: {
        device_id: deviceId,
        chemicals
      }
    });
  } catch (error) {
    logger.error(`Error getting chemicals: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get chemicals',
      error: error.message
    });
  }
};