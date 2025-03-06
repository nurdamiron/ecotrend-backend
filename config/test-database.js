// config/test-database.js
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

// Test database connection configuration
const testDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'nurda0101',
  database: process.env.DB_NAME || 'ecotrend_test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool for tests
const pool = mysql.createPool(testDbConfig);

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    logger.info('Test database connection established successfully');
    connection.release();
    return true;
  } catch (error) {
    logger.error(`Test database connection error: ${error.message}`);
    throw error;
  }
};

module.exports = {
  pool,
  testConnection
};