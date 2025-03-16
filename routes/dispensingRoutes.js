// routes/dispensingRoutes.js
const express = require('express');
const router = express.Router();
const dispensingController = require('../controllers/dispensingController');

// Маршрут для дозирования химиката
router.post('/:deviceId/dispense', dispensingController.dispenseChemical);

// Маршрут для получения истории дозирования
router.get('/:deviceId/history', dispensingController.getDispensingHistory);

module.exports = router;