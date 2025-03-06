// routes/kaspiRoutes.js
const express = require('express');
const router = express.Router();
const kaspiController = require('../controllers/kaspiController');
const { validateKaspiIP } = require('../middleware/auth');

/**
 * @swagger
 * /api/kaspi/check:
 *   get:
 *     summary: Проверка возможности проведения платежа (запрос check от Kaspi)
 *     tags: [Kaspi]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: txn_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID транзакции в системе Kaspi
 *       - in: query
 *         name: account
 *         required: true
 *         schema:
 *           type: string
 *         description: ID устройства (MAC-адрес)
 *       - in: query
 *         name: sum
 *         required: true
 *         schema:
 *           type: string
 *         description: Сумма платежа (фиктивное значение для запроса check)
 *     responses:
 *       200:
 *         description: Ответ на запрос проверки
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 txn_id:
 *                   type: string
 *                   description: ID транзакции в системе Kaspi
 *                 result:
 *                   type: integer
 *                   description: Код результата (0 - успешно, 1 - устройство не найдено, 5 - другая ошибка)
 *                 comment:
 *                   type: string
 *                   description: Комментарий к результату
 *                 fields:
 *                   type: object
 *                   description: Дополнительные поля
 */
router.get('/check', validateKaspiIP, kaspiController.checkPayment);

/**
 * @swagger
 * /api/kaspi/pay:
 *   get:
 *     summary: Обработка платежа (запрос pay от Kaspi)
 *     tags: [Kaspi]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: txn_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID транзакции в системе Kaspi
 *       - in: query
 *         name: txn_date
 *         required: true
 *         schema:
 *           type: string
 *         description: Дата транзакции в формате ГГГГММДДччммсс
 *       - in: query
 *         name: account
 *         required: true
 *         schema:
 *           type: string
 *         description: ID устройства (MAC-адрес)
 *       - in: query
 *         name: sum
 *         required: true
 *         schema:
 *           type: string
 *         description: Сумма платежа
 *     responses:
 *       200:
 *         description: Ответ на запрос обработки платежа
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 txn_id:
 *                   type: string
 *                   description: ID транзакции в системе Kaspi
 *                 prv_txn:
 *                   type: string
 *                   description: ID транзакции в нашей системе
 *                 sum:
 *                   type: string
 *                   description: Сумма платежа
 *                 result:
 *                   type: integer
 *                   description: Код результата (0 - успешно, другие - ошибка)
 *                 comment:
 *                   type: string
 *                   description: Комментарий к результату
 *                 fields:
 *                   type: object
 *                   description: Дополнительные поля для чека
 */
router.get('/pay', validateKaspiIP, kaspiController.processPayment);

/**
 * @swagger
 * /api/kaspi/status:
 *   get:
 *     summary: Проверка статуса Kaspi API
 *     tags: [Kaspi]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Информация о статусе API
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Kaspi API is working properly
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/status', kaspiController.getKaspiStatus);

module.exports = router;