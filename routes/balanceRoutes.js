// routes/balanceRoutes.js
const express = require('express');
const router = express.Router();
const balanceController = require('../controllers/balanceController');
const { authenticateDevice } = require('../middleware/auth');

// Маршруты для управления балансом
// Получить текущий баланс устройства
router.get('/:deviceId', authenticateDevice, balanceController.getBalance);

// Обновить баланс устройства (для тестирования)
router.post('/:deviceId/update', authenticateDevice, balanceController.updateBalance);

// Получить историю транзакций
router.get('/:deviceId/transactions', authenticateDevice, balanceController.getTransactions);

module.exports = router;