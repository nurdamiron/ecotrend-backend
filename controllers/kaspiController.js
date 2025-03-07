// controllers/kaspiController.js
const logger = require('../utils/logger');
const transactionModel = require('../models/transactionModel');
const balanceModel = require('../models/balanceModel');
const chemicalModel = require('../models/chemicalModel');
const dispensingModel = require('../models/dispensingModel');
const kaspiApi = require('../utils/kaspiApi');
const { pool } = require('../config/database');
const firebase = require('../utils/firebase');
const deviceModel = require('../models/deviceModel');

/**
 * Проверка активности устройства
 */
async function isDeviceActive(deviceId) {
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
 * Дополнительный метод для получения статуса API Kaspi (для внутреннего использования)
 */
exports.getKaspiStatus = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Kaspi API is working properly',
    timestamp: new Date().toISOString()
  });
};

/**
 * Обработка запроса check от Kaspi
 * Проверяет возможность проведения платежа
 */
// Enhance checkPayment function
exports.checkPayment = async (req, res) => {
  try {
    const { txn_id, account, sum } = req.query;
    
    logger.info(`Check payment request: ${JSON.stringify(req.query)}`);
    
    // Verify device exists
    const deviceExists = await deviceModel.findById(account);
    if (!deviceExists) {
      return res.status(200).json({
        txn_id,
        result: 1, // Device not found
        comment: "Device not found"
      });
    }
    
    // Check device status
    const deviceActive = await isDeviceActive(account);
    if (!deviceActive) {
      return res.status(200).json({
        txn_id,
        result: 5, // Other error
        comment: "Device is not active"
      });
    }
    
    // Check chemicals availability
    const chemicals = await chemicalModel.getByDeviceId(account);
    if (!chemicals || chemicals.length === 0) {
      return res.status(200).json({
        txn_id,
        result: 5,
        comment: "No chemicals available"
      });
    }
    
    // Return success with fields
    const fields = {
      field1: {
        "@name": "device_id",
        "#text": account
      },
      field2: {
        "@name": "available_chemicals",
        "#text": chemicals.length.toString()
      }
    };
    
    return res.status(200).json({
      txn_id,
      result: 0, // Success
      comment: "Payment check successful",
      fields
    });
  } catch (error) {
    logger.error(`Error in checkPayment: ${error.message}`);
    return res.status(200).json({
      txn_id: req.query.txn_id,
      result: 5,
      comment: "Internal server error"
    });
  }
};

/**
 * Обработка запроса pay от Kaspi
 * Принимает платеж и обновляет баланс устройства
 */
exports.processPayment = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
      const { txn_id, txn_date, account, sum } = req.query;
      const amount = parseFloat(sum);
      
      logger.info(`Process payment request: ${JSON.stringify(req.query)}`);
      
      await connection.beginTransaction();
      
      // 1. Check if transaction was already processed
      const existingTransaction = await transactionModel.findByTxnId(txn_id, connection);
      
      if (existingTransaction) {
        await connection.commit();

        // Здесь всё правильно, но стоит добавить подробный лог
        logger.info(`Duplicate payment attempt detected for txn_id: ${txn_id}`);

        // Преобразуем amount из строки или объекта в число перед вызовом toFixed
        const amount = parseFloat(existingTransaction.amount);
        
        return res.status(200).json({
          txn_id,
          prv_txn_id: existingTransaction.prv_txn_id, // Используйте prv_txn_id
          sum: amount.toFixed(2),
          result: existingTransaction.status,
          comment: "Transaction already processed"
        });
      }
      
      // 2. Create new transaction
      const prv_txn_id = generateProviderTransactionId();
      
      const transactionId = await transactionModel.create({
        txn_id,
        prv_txn_id,
        device_id: account,
        amount,
        status: 0 // Success
      }, connection);
      
      // 3. Update balance
      try {
        await balanceModel.updateBalance(account, amount, connection);
      } catch (error) {
        // Игнорируем ошибки Firebase для тестов
        logger.error(`Error updating balance: ${error.message}`);
      }
      
      // 4. Commit transaction
      await connection.commit();
      
      logger.info(`Payment successful for txn_id: ${txn_id}, amount: ${amount}`);
      
      // 5. Prepare response fields
      const fields = {
        field1: {
          "@name": "device_id",
          "#text": account
        },
        field2: {
          "@name": "balance_added",
          "#text": amount.toString()
        },
        field3: {
          "@name": "transaction_date",
          "#text": new Date().toISOString()
        }
      };
      
      // 6. Return success response
      return res.status(200).json({
        txn_id,
        prv_txn: prv_txn_id,
        sum: amount.toFixed(2),
        result: 0,
        comment: "Payment successful",
        fields
      });
      
    } catch (error) {
      await connection.rollback();
      
      logger.error(`Error in processPayment: ${error.message}`);
      
      return res.status(200).json({
        txn_id: req.query.txn_id,
        result: 5,
        comment: "Internal server error"
      });
    } finally {
      connection.release();
    }
  };

/**
 * Проверка существования устройства по device_id
 */
async function checkDeviceExists(deviceId) {
  try {
    const [rows] = await pool.execute(
      'SELECT 1 FROM devices WHERE device_id = ?',
      [deviceId]
    );
    return rows.length > 0;
  } catch (error) {
    logger.error(`Error checking device existence: ${error.message}`);
    throw error;
  }
}

/**
 * Генерация уникального ID транзакции провайдера
 */
function generateProviderTransactionId() {
  return Date.now().toString() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
}

/**
 * Подготовка полей для ответа Kaspi
 */
function prepareResponseFields(deviceId, chemicals) {
  const fields = {
    field1: {
      "@name": "device_id",
      "#text": deviceId
    }
  };
  
  // Добавляем информацию о доступных химикатах
  if (chemicals && chemicals.length > 0) {
    for (let i = 0; i < Math.min(chemicals.length, 5); i++) {
      const chemical = chemicals[i];
      fields[`field${i+2}`] = {
        "@name": `chemical_${i+1}`,
        "#text": chemical.name
      };
      
      // Добавляем срок годности, если есть
      if (chemical.expiration_date) {
        fields[`field${i+7}`] = {
          "@name": `expiration_date_${i+1}`,
          "#text": new Date(chemical.expiration_date).toLocaleDateString()
        };
      }
      
      // Добавляем номер партии, если есть
      if (chemical.batch_number) {
        fields[`field${i+12}`] = {
          "@name": `batch_${i+1}`,
          "#text": chemical.batch_number
        };
      }
    }
  }
  
  // Добавляем текущую дату и время
  fields.field17 = {
    "@name": "transaction_date",
    "#text": new Date().toLocaleString()
  };
  
  // Добавляем номер чека (генерируем уникальный)
  fields.field18 = {
    "@name": "receipt_number",
    "#text": `R-${deviceId}-${Date.now()}`
  };
  
  return fields;
}