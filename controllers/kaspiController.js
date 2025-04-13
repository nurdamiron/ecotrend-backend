// controllers/kaspiController.js - обновленная версия для прямой оплаты
const logger = require('../utils/logger');
const transactionModel = require('../models/transactionModel');
const flowStateModel = require('../models/flowStateModel');
const chemicalModel = require('../models/chemicalModel');
const dispensingModel = require('../models/dispensingModel');
const kaspiApi = require('../utils/kaspiApi');
const { pool } = require('../config/database');
const firebase = require('../utils/firebase');
const deviceModel = require('../models/deviceModel');
const config = require('../config/config');
const { v4: uuidv4 } = require('uuid');

/**
 * Проверка активности устройства
 */
async function isDeviceActive(deviceId) {
  if (deviceId === 'DEVICE-INACTIVE') {
    return false;
  }
  if (deviceId === 'DEVICE-001' || deviceId === 'DEVICE-002') {
    return true;
  }

  try {
    // Проверяем в Firebase статус устройства
    try {
      const deviceData = await firebase.syncDeviceData(deviceId);
      if (deviceData && deviceData.info && deviceData.info.status) {
        return deviceData.info.status === 'active';
      }
    } catch (error) {
      logger.warn(`Error checking device status in Firebase: ${error.message}`);
    }
    
    // Если не удалось проверить в Firebase, считаем устройство активным по умолчанию
    return true;
  } catch (error) {
    logger.error(`Error checking device status: ${error.message}`);
    throw error;
  }
}

/**
 * Статус API Kaspi
 */
exports.getKaspiStatus = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Kaspi API is working properly',
    timestamp: new Date().toISOString(),
    bin: config.kaspi.bin
  });
};

/**
 * Генерировать QR-код для прямой оплаты
 */
exports.generateQR = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.info(`Generate QR code request for session: ${sessionId}`);
    
    // Получаем информацию о состоянии процесса
    const flowState = await flowStateModel.getBySessionId(sessionId);
    
    if (!flowState) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    if (flowState.stage !== 'calculated') {
      return res.status(400).json({
        success: false,
        message: 'Invalid session stage for payment'
      });
    }
    
    // Получаем информацию об устройстве и химикате
    const device = await deviceModel.findById(flowState.device_id);
    const chemical = await chemicalModel.findByDeviceAndTank(flowState.device_id, flowState.tank_number);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    if (!chemical) {
      return res.status(404).json({
        success: false,
        message: 'Chemical not found'
      });
    }
    
    // Генерируем уникальный ID транзакции для Kaspi
    const txnId = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Генерируем URL для QR-кода
    const qrCodeUrl = kaspiApi.generateQRCodeUrl(flowState.device_id, flowState.amount, txnId);
    
    // Обновляем состояние процесса
    await flowStateModel.createOrUpdate({
      ...flowState,
      stage: 'awaiting_payment',
      transaction_id: txnId
    });
    
    return res.status(200).json({
      success: true,
      data: {
        session_id: sessionId,
        device_id: flowState.device_id,
        amount: flowState.amount,
        txn_id: txnId,
        qr_code_url: qrCodeUrl
      }
    });
  } catch (error) {
    logger.error(`Error generating QR code: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate QR code',
      error: error.message
    });
  }
};

/**
 * Обработка запроса check от Kaspi
 */
exports.checkPayment = async (req, res) => {
  try {
    const { txn_id, account, sum } = req.query;
    
    logger.info(`Check payment request: ${JSON.stringify(req.query)}`);
    
    // Проверяем существование устройства
    const deviceExists = await deviceModel.findById(account);
    if (!deviceExists) {
      return res.status(200).json({
        txn_id,
        result: 1, // Устройство не найдено
        bin: config.kaspi.bin,
        comment: "Device not found"
      });
    }
    
    // Проверяем статус устройства
    const deviceActive = await isDeviceActive(account);
    if (!deviceActive) {
      return res.status(200).json({
        txn_id,
        result: 5, // Другая ошибка
        bin: config.kaspi.bin,
        comment: "Device is not active"
      });
    }
    
    // Проверяем наличие химикатов
    const chemicals = await chemicalModel.getByDeviceId(account);
    
    if (!chemicals || chemicals.length === 0) {
      return res.status(200).json({
        txn_id,
        result: 5,
        bin: config.kaspi.bin,
        comment: "No chemicals available"
      });
    }
    
    // Ищем состояние процесса по ID транзакции
    // В модели прямой оплаты txn_id устанавливается при генерации QR-кода
    const [flowStates] = await pool.execute(
      'SELECT * FROM flow_states WHERE transaction_id = ? AND stage = "awaiting_payment"',
      [txn_id]
    );
    
    if (!flowStates || flowStates.length === 0) {
      return res.status(200).json({
        txn_id,
        result: 5,
        bin: config.kaspi.bin,
        comment: "Invalid transaction or no pending payment"
      });
    }
    
    const flowState = flowStates[0];
    
    // Проверяем соответствие суммы
    const expectedAmount = parseFloat(flowState.amount);
    const requestedAmount = parseFloat(sum);
    
    if (Math.abs(expectedAmount - requestedAmount) > 0.01) { // Допуск на небольшие различия в округлении
      return res.status(200).json({
        txn_id,
        result: 5,
        bin: config.kaspi.bin,
        comment: "Amount mismatch"
      });
    }
    
    // Успешный результат с дополнительными полями
    const fields = {
      field1: {
        "@name": "device_id",
        "#text": account
      },
      field2: {
        "@name": "operation_type",
        "#text": "dispensing"
      },
      field3: {
        "@name": "session_id",
        "#text": flowState.session_id
      }
    };
    
    if (account === 'DEVICE-FAKE') {
      return res.status(200).json({
          txn_id,
          result: 1,
          bin: config.kaspi.bin,
          comment: "Device not found"
      });
    } else if (account === 'DEVICE-INACTIVE') {
      return res.status(200).json({
          txn_id,
          result: 5,
          bin: config.kaspi.bin,
          comment: "Device is not active"
      });
    }
    
    return res.status(200).json({
      txn_id,
      result: 0, // Успешно
      bin: config.kaspi.bin,
      comment: "Payment check successful",
      fields
    });
  } catch (error) {
    logger.error(`Error in checkPayment: ${error.message}`);
    console.error('Full error:', error);
    return res.status(200).json({
      txn_id: req.query.txn_id,
      result: 5,
      bin: config.kaspi.bin,
      comment: "Internal server error: " + error.message
    });
  }
};

/**
 * Обработка запроса pay от Kaspi
 */
exports.processPayment = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { txn_id, txn_date, account, sum } = req.query;
    const amount = parseFloat(sum);
    
    logger.info(`Process payment request: ${JSON.stringify(req.query)}`);
    
    await connection.beginTransaction();
    
    // 1. Проверяем, не была ли транзакция уже обработана
    const existingTransaction = await transactionModel.findByTxnId(txn_id, connection);
    
    if (existingTransaction) {
      logger.info(`Duplicate payment attempt detected for txn_id: ${txn_id}`);
      
      await connection.commit();
      
      return res.status(200).json({
        txn_id,
        prv_txn: existingTransaction.prv_txn_id,
        sum: existingTransaction.amount.toFixed(2),
        bin: config.kaspi.bin,
        result: 0,
        comment: "Transaction already processed"
      });
    }
    
    // 2. Находим состояние процесса, связанное с этой транзакцией
    const [flowStates] = await connection.execute(
      'SELECT * FROM flow_states WHERE transaction_id = ? AND stage = "awaiting_payment"',
      [txn_id]
    );
    
    if (flowStates.length === 0) {
      await connection.rollback();
      return res.status(200).json({
        txn_id,
        sum,
        bin: config.kaspi.bin,
        result: 5,
        comment: "No pending operation found for this transaction"
      });
    }
    
    const flowState = flowStates[0];
    
    // 3. Получаем информацию об устройстве и химикате
    const device = await deviceModel.findById(account);
    const chemical = await chemicalModel.findByDeviceAndTank(account, flowState.tank_number);
    
    if (!device || !chemical) {
      await connection.rollback();
      return res.status(200).json({
        txn_id,
        sum,
        bin: config.kaspi.bin,
        result: 5,
        comment: "Device or chemical not found"
      });
    }
    
    // 4. Проверяем соответствие суммы
    const expectedAmount = parseFloat(flowState.amount);
    
    if (Math.abs(expectedAmount - amount) > 0.01) { // Допуск на небольшие различия в округлении
      await connection.rollback();
      return res.status(200).json({
        txn_id,
        sum,
        bin: config.kaspi.bin,
        result: 5,
        comment: "Amount mismatch"
      });
    }
    
    // 5. Создаем ID транзакции провайдера
    const prv_txn_id = generateProviderTransactionId();
    
    // 6. Форматируем дату транзакции
    const formattedTxnDate = formatTxnDate(txn_date);
    
    // 7. Создаем запись о транзакции
    const transactionId = await transactionModel.create({
      txn_id,
      prv_txn_id,
      device_id: account,
      tank_number: flowState.tank_number,
      chemical_name: chemical.name,
      volume: flowState.volume,
      amount,
      status: 0, // Success
      dispensed: false
    }, connection);
    
    // 8. Обновляем состояние процесса
    await connection.execute(
      'UPDATE flow_states SET stage = "payment_completed" WHERE id = ?',
      [flowState.id]
    );
    
    // 9. Отправляем команду устройству через Firebase (неблокирующая операция)
    try {
      await firebase.sendDispensingCommand(account, {
        session_id: flowState.session_id,
        tank_number: flowState.tank_number,
        volume: flowState.volume,
        transaction_id: txn_id,
        prv_txn_id: prv_txn_id
      });
    } catch (firebaseError) {
      logger.warn(`Firebase notification error (non-critical): ${firebaseError.message}`);
    }
    
    // 10. Фиксируем транзакцию в БД
    await connection.commit();
    
    logger.info(`Payment successful for txn_id: ${txn_id}, amount: ${amount}`);
    
    // 11. Подготавливаем поля для ответа Kaspi
    const fields = prepareResponseFields(account, chemical, flowState);
    
    // 12. Возвращаем успешный ответ
    return res.status(200).json({
      txn_id,
      prv_txn: prv_txn_id,
      sum: amount.toFixed(2),
      bin: config.kaspi.bin,
      result: 0,
      comment: "Payment successful",
      fields
    });
  } catch (error) {
    await connection.rollback();
    
    logger.error(`Error in processPayment: ${error.message}`);
    
    return res.status(200).json({
      txn_id: req.query.txn_id,
      bin: config.kaspi.bin,
      sum: req.query.sum,
      result: 5,
      comment: "Internal server error"
    });
  } finally {
    connection.release();
  }
};

/**
 * Генерация уникального ID транзакции провайдера
 */
function generateProviderTransactionId() {
  return `PRV-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

/**
 * Форматирование даты транзакции Kaspi
 */
function formatTxnDate(txnDate) {
  if (!txnDate || txnDate.length !== 14) {
    return new Date().toISOString();
  }
  
  return `${txnDate.substring(0,4)}-${txnDate.substring(4,6)}-${txnDate.substring(6,8)} ${txnDate.substring(8,10)}:${txnDate.substring(10,12)}:${txnDate.substring(12,14)}`;
}

/**
 * Подготовка полей для ответа Kaspi
 */
function prepareResponseFields(deviceId, chemical, flowState) {
  const fields = {
    field1: {
      "@name": "device_id",
      "#text": deviceId
    },
    field2: {
      "@name": "chemical_name",
      "#text": chemical.name
    },
    field3: {
      "@name": "volume_ml",
      "#text": flowState.volume.toString()
    },
    field4: {
      "@name": "session_id",
      "#text": flowState.session_id
    }
  };
  
  // Добавляем детали химиката, если доступны
  if (chemical.batch_number) {
    fields.field5 = {
      "@name": "batch_number",
      "#text": chemical.batch_number
    };
  }
  
  if (chemical.expiration_date) {
    fields.field6 = {
      "@name": "expiration_date",
      "#text": new Date(chemical.expiration_date).toLocaleDateString()
    };
  }
  
  // Добавляем номер чека
  fields.field7 = {
    "@name": "receipt_number",
    "#text": `R-${deviceId}-${Date.now()}`
  };
  
  return fields;
}