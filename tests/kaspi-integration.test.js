// tests/kaspi-integration.test.js
const request = require('supertest');
const app = require('../server');
const { pool } = require('../config/database');

describe('Kaspi Integration Tests', () => {
  // Test device and transaction data
  const testDeviceId = 'TEST-DEVICE-001';
  const testTxnId = 'TEST-TXN-' + Date.now();
  
  beforeAll(async () => {
    // Create test device in database
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
  });
  
  afterAll(async () => {
    // Clean up test data
    await pool.execute('DELETE FROM chemicals WHERE device_id = ?', [testDeviceId]);
    await pool.execute('DELETE FROM balances WHERE device_id = ?', [testDeviceId]);
    await pool.execute('DELETE FROM transactions WHERE device_id = ?', [testDeviceId]);
    await pool.execute('DELETE FROM devices WHERE device_id = ?', [testDeviceId]);
    
    // Close connection pool
    await pool.end();
  });
  
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
    });
    
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
    });
  });
  
  describe('Pay Endpoint', () => {
    it('should process payment successfully', async () => {
      const res = await request(app)
        .get('/api/kaspi/pay')
        .query({
          txn_id: testTxnId,
          txn_date: '20231231235959',
          account: testDeviceId,
          sum: '500.00'
        })
        .set('X-Forwarded-For', '194.187.247.152');
      
      expect(res.status).toBe(200);
      expect(res.body.txn_id).toBe(testTxnId);
      expect(res.body.result).toBe(0); // Success
      expect(res.body.prv_txn).toBeDefined();
      expect(res.body.sum).toBe('500.00');
      
      // Verify balance was updated
      const [rows] = await pool.execute(
        'SELECT balance FROM balances WHERE device_id = ?',
        [testDeviceId]
      );
      
      expect(rows[0].balance).toBe('500.00');
    });
    
    it('should handle duplicate payments', async () => {
      // Try to process the same payment again
      const res = await request(app)
        .get('/api/kaspi/pay')
        .query({
          txn_id: testTxnId,
          txn_date: '20231231235959',
          account: testDeviceId,
          sum: '500.00'
        })
        .set('X-Forwarded-For', '194.187.247.152');
      
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(0); // Still success
      expect(res.body.comment).toContain('already processed');
      
      // Verify balance wasn't updated twice
      const [rows] = await pool.execute(
        'SELECT balance FROM balances WHERE device_id = ?',
        [testDeviceId]
      );
      
      expect(rows[0].balance).toBe('500.00'); // Still 500, not 1000
    });
  });
});