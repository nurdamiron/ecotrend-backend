// tests/direct-payment.test.js
const request = require('supertest');
const app = require('../server');
const mysql = require('mysql2/promise');

// Увеличиваем глобальный таймаут для всех тестов и хуков
jest.setTimeout(120000); // 2 минуты

// Мокаем Firebase
jest.mock('../utils/firebase', () => require('./mocks/firebase'));

// Переменные для хранения пула и подключения между тестами
let pool;
const testDeviceId = 'TEST-DEVICE-001';

// Функция для создания пула соединений
const createPool = () => mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'nurda0101',
  database: process.env.DB_NAME || 'ecotrend_test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000, // 60 секунд для подключения
  acquireTimeout: 60000, // 60 секунд для получения соединения
  timeout: 60000 // 60 секунд тайм-аут на запрос
});

// Функция для ожидания доступности базы данных с повторными попытками
const waitForDatabase = async (maxRetries = 15, retryInterval = 5000) => {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      console.log(`Attempt ${retries + 1}/${maxRetries} to connect to database at ${process.env.DB_HOST}:${process.env.DB_PORT}`);
      
      // Создаем новый пул при каждой попытке
      const newPool = createPool();
      const connection = await newPool.getConnection();
      console.log('Successfully connected to test database!');
      
      // Test query to verify connection is working
      const [result] = await connection.query('SELECT 1 as test');
      console.log('Query test result:', result);

      connection.release();
      
      return newPool;
    } catch (error) {
      console.error(`Connection attempt ${retries + 1} failed:`, error.message);
      
      retries++;
      if (retries >= maxRetries) {
        console.error('Max retries reached. Could not connect to database.');
        throw error;
      }
      
      console.log(`Waiting ${retryInterval/1000} seconds before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
};

// Функция для очистки тестовых данных
async function cleanupTestData(pool, deviceId) {
  if (!pool) {
    console.warn('Pool is not available for cleanup');
    return;
  }
  
  try {
    // Очищаем все предыдущие тестовые данные
    await pool.execute('DELETE FROM flow_states WHERE device_id = ?', [deviceId]);
    await pool.execute('DELETE FROM dispensing_operations WHERE device_id = ?', [deviceId]);
    await pool.execute('DELETE FROM transactions WHERE device_id = ?', [deviceId]);
    await pool.execute('DELETE FROM chemicals WHERE device_id = ?', [deviceId]);
    await pool.execute('DELETE FROM devices WHERE device_id = ?', [deviceId]);
    console.log('Previous test data cleaned up successfully');
  } catch (error) {
    console.warn('Warning during cleanup:', error.message);
    // Не выбрасываем ошибку, чтобы тесты могли продолжаться
  }
}

describe('Direct Payment Integration Tests', () => {
  // Выполняется один раз перед всеми тестами
  beforeAll(async () => {
    // Инициализация подключения к БД
    try {
      pool = await waitForDatabase(15);
      
      // Сначала очищаем старые тестовые данные
      await cleanupTestData(pool, testDeviceId);
      
      // Создаем тестовые данные
      await pool.execute(
        'INSERT INTO devices (device_id, name) VALUES (?, ?)',
        [testDeviceId, 'Test Device']
      );
      
      // Add test chemical
      await pool.execute(
        `INSERT INTO chemicals 
         (device_id, tank_number, name, price) 
         VALUES (?, ?, ?, ?)`,
        [testDeviceId, 1, 'Test Chemical', 100]
      );
      
      console.log('Test data created successfully');
    } catch (error) {
      console.error('Error in beforeAll:', error.message);
      throw error;
    }
  }, 90000); // 90 секунд тайм-аут для beforeAll
  
  // Выполняется один раз после всех тестов
  afterAll(async () => {
    try {
      if (pool) {
        // Очистка тестовых данных
        await cleanupTestData(pool, testDeviceId);
        console.log('Test data cleaned up successfully');
        
        // Закрытие пула соединений
        await pool.end();
        console.log('Database connection pool closed');
      }
    } catch (error) {
      console.error('Error in afterAll:', error.message);
    }
  }, 90000); // 90 секунд тайм-аут для afterAll
  
  // Тесты для прямой оплаты
  describe('Direct Payment Flow', () => {
    // Хранение данных между тестами
    let sessionId;
    let txnId;
    
    it('should calculate cost for dispensing operation', async () => {
      const res = await request(app)
        .post('/api/dispensing/calculate')
        .send({
          device_id: testDeviceId,
          tank_number: 1,
          volume: 500 // 500 мл
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.device_id).toBe(testDeviceId);
      expect(res.body.data.tank_number).toBe(1);
      expect(res.body.data.volume).toBe(500);
      expect(res.body.data.total_cost).toBe(50); // 100 * (500/1000) = 50
      expect(res.body.data.session_id).toBeDefined();
      
      // Сохраняем ID сессии для использования в следующих тестах
      sessionId = res.body.data.session_id;
    }, 30000);
    
    it('should check the status of the operation', async () => {
      const res = await request(app)
        .get(`/api/dispensing/status/${sessionId}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.session_id).toBe(sessionId);
      expect(res.body.data.status).toBe('ready_for_payment');
      expect(res.body.data.stage).toBe('calculated');
    }, 30000);
    
    it('should generate QR code for payment', async () => {
      const res = await request(app)
        .get(`/api/kaspi/generate-qr/${sessionId}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.session_id).toBe(sessionId);
      expect(res.body.data.device_id).toBe(testDeviceId);
      expect(res.body.data.amount).toBe(50);
      expect(res.body.data.txn_id).toBeDefined();
      expect(res.body.data.qr_code_url).toBeDefined();
      
      // Сохраняем ID транзакции для использования в следующих тестах
      txnId = res.body.data.txn_id;
    }, 30000);
    
    it('should process Kaspi check request', async () => {
      const res = await request(app)
        .get('/api/kaspi/check')
        .query({
          txn_id: txnId,
          account: testDeviceId,
          sum: '50.00'
        })
        .set('X-Forwarded-For', '194.187.247.152'); // Simulate Kaspi IP
      
      expect(res.status).toBe(200);
      expect(res.body.txn_id).toBe(txnId);
      expect(res.body.result).toBe(0); // Success
      expect(res.body.fields).toBeDefined();
    }, 30000);
    
    it('should process Kaspi payment request', async () => {
      const res = await request(app)
        .get('/api/kaspi/pay')
        .query({
          txn_id: txnId,
          txn_date: '20250413000000',
          account: testDeviceId,
          sum: '50.00'
        })
        .set('X-Forwarded-For', '194.187.247.152');
      
      expect(res.status).toBe(200);
      expect(res.body.txn_id).toBe(txnId);
      expect(res.body.result).toBe(0); // Success
      expect(res.body.prv_txn).toBeDefined();
      expect(res.body.sum).toBe('50.00');
    }, 30000);
    
    it('should have session in "payment_completed" stage after payment', async () => {
      const res = await request(app)
        .get(`/api/dispensing/status/${sessionId}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.session_id).toBe(sessionId);
      expect(res.body.data.status).toBe('payment_completed');
      expect(res.body.data.stage).toBe('payment_completed');
    }, 30000);
    
    it('should process dispensing after payment', async () => {
      const res = await request(app)
        .post(`/api/dispensing/${sessionId}/dispense`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.session_id).toBe(sessionId);
      expect(res.body.data.device_id).toBe(testDeviceId);
      expect(res.body.data.tank_number).toBe(1);
      expect(res.body.data.volume).toBe(500);
      expect(res.body.data.amount).toBe(50);
      expect(res.body.data.receipt_number).toBeDefined();
    }, 30000);
    
    it('should have session in "completed" stage after dispensing', async () => {
      const res = await request(app)
        .get(`/api/dispensing/status/${sessionId}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.session_id).toBe(sessionId);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.stage).toBe('completed');
    }, 30000);
    
    it('should retrieve dispensing history', async () => {
      const res = await request(app)
        .get(`/api/dispensing/history/${testDeviceId}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.device_id).toBe(testDeviceId);
      expect(res.body.data.operations).toBeDefined();
      expect(res.body.data.operations.length).toBeGreaterThan(0);
    }, 30000);
  });
});