// tests/kaspi-integration.test.js
const request = require('supertest');
const app = require('../server');
const mysql = require('mysql2/promise');

// Увеличиваем глобальный таймаут для всех тестов и хуков
jest.setTimeout(90000);

// Мокаем Firebase
jest.mock('../utils/firebase', () => require('./mocks/firebase'));

// Функция для создания пула соединений
const createPool = () => mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'nurda0101',
  database: process.env.DB_NAME || 'ecotrend_test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Функция для ожидания доступности базы данных с повторными попытками
const waitForDatabase = async (maxRetries = 10, retryInterval = 3000) => {
  let retries = 0;
  let pool;
  
  while (retries < maxRetries) {
    try {
      console.log(`Attempting to connect to test database (attempt ${retries + 1}/${maxRetries})...`);
      pool = createPool();
      const connection = await pool.getConnection();
      console.log('Successfully connected to test database!');
      connection.release();
      return pool;
    } catch (error) {
      console.error(`Connection attempt ${retries + 1} failed:`, error.message);
      if (pool) {
        await pool.end().catch(err => console.error('Error closing pool:', err.message));
      }
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
  let pool;
  // Test device and transaction data
  const testDeviceId = 'TEST-DEVICE-001';
  const testTxnId = 'TEST-TXN-' + Date.now();
  
  beforeAll(async () => {
    // Ожидаем, пока база данных станет доступной
    pool = await waitForDatabase();
    
    // Сначала очищаем старые тестовые данные
    await cleanupTestData(pool, testDeviceId);
    
    // Create test device in database
    try {
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
      console.error('Error setting up test data:', error.message);
      throw error;
    }
  }, 60000); // Увеличиваем таймаут для beforeAll
  
  afterAll(async () => {
    try {
      // Clean up test data
      await cleanupTestData(pool, testDeviceId);
      console.log('Test data cleaned up successfully');
    } catch (error) {
      console.error('Error cleaning up test data:', error.message);
    } finally {
      // Close connection pool
      if (pool) {
        await pool.end();
        console.log('Database connection pool closed');
      }
    }
  }, 60000); // Увеличиваем таймаут для afterAll
  
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
    }, 30000);
    
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
    }, 15000);
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
    }, 30000);
    
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
    }, 20000);
  });
});