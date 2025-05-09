// tests/kaspi-integration.test.js
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
const testTxnId = 'TEST-TXN-' + Date.now();

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
  // Добавляем опции для стабильной работы
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
    await pool.execute('DELETE FROM chemicals WHERE device_id = ?', [deviceId]);
    await pool.execute('DELETE FROM balances WHERE device_id = ?', [deviceId]);
    await pool.execute('DELETE FROM transactions WHERE device_id = ?', [deviceId]);
    await pool.execute('DELETE FROM devices WHERE device_id = ?', [deviceId]);
    console.log('Previous test data cleaned up successfully');
  } catch (error) {
    console.warn('Warning during cleanup:', error.message);
    // Не выбрасываем ошибку, чтобы тесты могли продолжаться
  }
}

describe('Kaspi Integration Tests', () => {
  // Выполняется один раз перед всеми тестами
  beforeAll(async () => {
    // Инициализация подключения к БД
    try {
      pool = await waitForDatabase(15); // Увеличим количество попыток
      
      // Сначала очищаем старые тестовые данные
      await cleanupTestData(pool, testDeviceId);
      
      // Создаем тестовые данные
      await pool.execute(
        'INSERT INTO devices (device_id, name) VALUES (?, ?)',
        [testDeviceId, 'Test Device']
      );
      
      // Initialize balance
      await pool.execute(
        'INSERT INTO balances (device_id, balance) VALUES (?, ?)',
        [testDeviceId, 0]
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
  
  // Тесты для проверки работы с API Kaspi
  describe('Check Endpoint', () => {
    it('should return success for valid device', async () => {
      const res = await request(app)
        .get('/api/kaspi/check')
        .query({
          txn_id: testTxnId,
          account: testDeviceId,
          sum: '500.00'
        })
        .set('X-Forwarded-For', '194.187.247.152'); // Simulate Kaspi IP
      
      expect(res.status).toBe(200);
      expect(res.body.txn_id).toBe(testTxnId);
      expect(res.body.result).toBe(0); // Success
      expect(res.body.fields).toBeDefined();
    }, 30000); // 30 секунд тайм-аут
    
    it('should return error for non-existent device', async () => {
      const res = await request(app)
        .get('/api/kaspi/check')
        .query({
          txn_id: testTxnId,
          account: 'NON-EXISTENT-DEVICE',
          sum: '500.00'
        })
        .set('X-Forwarded-For', '194.187.247.152');
      
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(1); // Device not found
    }, 30000); // 30 секунд тайм-аут
  });
  
  describe('Pay Endpoint', () => {
    it('should process payment successfully', async () => {
      const res = await request(app)
        .get('/api/kaspi/pay')
        .query({
          txn_id: testTxnId + '1', // Уникальный ID для этого теста
          txn_date: '20231231235959',
          account: testDeviceId,
          sum: '500.00'
        })
        .set('X-Forwarded-For', '194.187.247.152');
      
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(0); // Success
      expect(res.body.prv_txn).toBeDefined();
      expect(res.body.sum).toBe('500.00');
      
      // Verify balance was updated
      const [rows] = await pool.execute(
        'SELECT balance FROM balances WHERE device_id = ?',
        [testDeviceId]
      );
      
      expect(parseFloat(rows[0].balance)).toBeGreaterThan(0);
    }, 30000); // 30 секунд тайм-аут
    
    it('should handle duplicate payments', async () => {
      // First payment
      const uniqueTxnId = testTxnId + '2'; // Уникальный ID для этого теста
      
      const firstRes = await request(app)
        .get('/api/kaspi/pay')
        .query({
          txn_id: uniqueTxnId,
          txn_date: '20231231235959',
          account: testDeviceId,
          sum: '300.00'
        })
        .set('X-Forwarded-For', '194.187.247.152');
      
      // Get balance after first payment
      const [balanceAfterFirst] = await pool.execute(
        'SELECT balance FROM balances WHERE device_id = ?',
        [testDeviceId]
      );
      
      // Try to process the same payment again
      const secondRes = await request(app)
        .get('/api/kaspi/pay')
        .query({
          txn_id: uniqueTxnId, // Same transaction ID
          txn_date: '20231231235959',
          account: testDeviceId,
          sum: '300.00'
        })
        .set('X-Forwarded-For', '194.187.247.152');
      
      expect(secondRes.status).toBe(200);
      expect(secondRes.body.result).toBe(0); // Still success
      
      // Get balance after second payment attempt
      const [balanceAfterSecond] = await pool.execute(
        'SELECT balance FROM balances WHERE device_id = ?',
        [testDeviceId]
      );
      
      // Verify balance wasn't updated twice
      expect(balanceAfterFirst[0].balance).toBe(balanceAfterSecond[0].balance);
    }, 30000); // 30 секунд тайм-аут
  });
});