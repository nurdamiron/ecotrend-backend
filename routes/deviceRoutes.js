// routes/deviceRoutes.js
const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { authenticateDevice, authenticateAdmin } = require('../middleware/auth');

// Маршруты для управления устройствами
// Зарегистрировать новое устройство
router.post('/register', authenticateAdmin, deviceController.registerDevice);

// Получить информацию об устройстве
router.get('/:deviceId', authenticateDevice, deviceController.getDeviceInfo);

// Обновить информацию об устройстве
router.put('/:deviceId', authenticateDevice, deviceController.updateDeviceInfo);

// Получить список всех устройств (только для админа)
router.get('/', authenticateAdmin, deviceController.getAllDevices);

// Синхронизировать данные с Firebase
router.post('/:deviceId/sync', authenticateDevice, deviceController.syncWithFirebase);

// Получить информацию о химикатах
router.get('/:deviceId/chemicals', authenticateDevice, deviceController.getChemicals);

module.exports = router;