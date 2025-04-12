// routes/healthRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const firebase = require('../utils/firebase');
const logger = require('../utils/logger');
const os = require('os');

/**
 * Basic health check endpoint
 */
router.get('/', async (req, res) => {
  try {
    return res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Health check error: ${error.message}`);
    return res.status(500).json({
      status: 'DOWN',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Detailed system health check
 */
router.get('/detailed', async (req, res) => {
  try {
    // Check database connection
    let dbStatus = 'DOWN';
    let dbError = null;
    
    try {
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      dbStatus = 'UP';
    } catch (error) {
      dbError = error.message;
    }
    
    // Check Firebase connection
    let firebaseStatus = 'DOWN';
    let firebaseError = null;
    
    try {
      const isInitialized = firebase._isInitialized();
      if (isInitialized) {
        firebaseStatus = 'UP';
      } else {
        // Try to initialize
        const initSuccess = firebase.initializeFirebase();
        firebaseStatus = initSuccess ? 'UP' : 'DOWN';
        if (!initSuccess) {
          firebaseError = 'Failed to initialize Firebase';
        }
      }
    } catch (error) {
      firebaseError = error.message;
    }
    
    // Get system info
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpuCores: os.cpus().length,
      totalMemory: formatBytes(os.totalmem()),
      freeMemory: formatBytes(os.freemem()),
      uptime: formatUptime(os.uptime()),
      loadAverage: os.loadavg()
    };
    
    // Server info
    const serverInfo = {
      nodeVersion: process.version,
      processUptime: formatUptime(process.uptime()),
      memoryUsage: {
        rss: formatBytes(process.memoryUsage().rss),
        heapTotal: formatBytes(process.memoryUsage().heapTotal),
        heapUsed: formatBytes(process.memoryUsage().heapUsed),
        external: formatBytes(process.memoryUsage().external)
      }
    };
    
    // Return complete health data
    return res.status(200).json({
      status: dbStatus === 'UP' ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      components: {
        database: {
          status: dbStatus,
          error: dbError
        },
        firebase: {
          status: firebaseStatus,
          error: firebaseError
        }
      },
      system: systemInfo,
      server: serverInfo
    });
  } catch (error) {
    logger.error(`Detailed health check error: ${error.message}`);
    return res.status(500).json({
      status: 'DOWN',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liveness probe for Kubernetes or other orchestration
 */
router.get('/liveness', (req, res) => {
  // Just check if the server is responsive
  res.status(200).json({ status: 'UP' });
});

/**
 * Readiness probe for Kubernetes or other orchestration
 */
router.get('/readiness', async (req, res) => {
  try {
    // Check if the database is accessible
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    // If we get here, the database is accessible
    res.status(200).json({ status: 'UP' });
  } catch (error) {
    logger.error(`Readiness check failed: ${error.message}`);
    res.status(503).json({ 
      status: 'DOWN',
      error: 'Service unavailable - database connection failed'
    });
  }
});

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

/**
 * Format uptime to human-readable format
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

module.exports = router;