// routes/dispensingRoutes.js - обновленный маршрутизатор для прямой оплаты
const express = require('express');
const router = express.Router();
const dispensingController = require('../controllers/dispensingController');
const { authenticateDevice } = require('../middleware/auth');

/**
 * @swagger
 * /api/dispensing/calculate:
 *   post:
 *     summary: Рассчитать стоимость дозирования
 *     tags: [Дозирование]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - device_id
 *               - tank_number
 *               - volume
 *             properties:
 *               device_id:
 *                 type: string
 *                 description: ID устройства
 *               tank_number:
 *                 type: integer
 *                 description: Номер бака с химикатом
 *               volume:
 *                 type: number
 *                 description: Объем в миллилитрах
 *     responses:
 *       200:
 *         description: Стоимость рассчитана успешно
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     session_id:
 *                       type: string
 *                     device_id:
 *                       type: string
 *                     tank_number:
 *                       type: integer
 *                     chemical_name:
 *                       type: string
 *                     volume:
 *                       type: number
 *                     price_per_liter:
 *                       type: number
 *                     total_cost:
 *                       type: number
 */
router.post('/calculate', dispensingController.calculateCost);

/**
 * @swagger
 * /api/dispensing/status/{sessionId}:
 *   get:
 *     summary: Проверить статус операции дозирования
 *     tags: [Дозирование]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID сессии дозирования
 *     responses:
 *       200:
 *         description: Успешное получение статуса
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     session_id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [ready_for_payment, awaiting_payment, payment_completed, dispensing, completed, unknown]
 *                     device_id:
 *                       type: string
 *                     stage:
 *                       type: string
 *                     tank_number:
 *                       type: integer
 *                     volume:
 *                       type: number
 *                     amount:
 *                       type: number
 */
router.get('/status/:sessionId', dispensingController.checkStatus);

/**
 * @swagger
 * /api/dispensing/{sessionId}/dispense:
 *   post:
 *     summary: Выполнить дозирование после оплаты
 *     tags: [Дозирование]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID сессии дозирования
 *     responses:
 *       200:
 *         description: Дозирование выполнено успешно
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     session_id:
 *                       type: string
 *                     device_id:
 *                       type: string
 *                     tank_number:
 *                       type: integer
 *                     chemical_name:
 *                       type: string
 *                     volume:
 *                       type: number
 *                     amount:
 *                       type: number
 *                     receipt_number:
 *                       type: string
 */
router.post('/:sessionId/dispense', dispensingController.dispense);

/**
 * @swagger
 * /api/dispensing/history/{deviceId}:
 *   get:
 *     summary: Получить историю дозирований устройства
 *     tags: [Дозирование]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID устройства
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Количество записей на странице
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Смещение для пагинации
 *     responses:
 *       200:
 *         description: Успешное получение истории дозирований
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     device_id:
 *                       type: string
 *                     operations:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         limit:
 *                           type: integer
 *                         offset:
 *                           type: integer
 */
router.get('/history/:deviceId', authenticateDevice, dispensingController.getHistory);

module.exports = router;