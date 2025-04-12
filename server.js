// server.js - Updated with improved error handling and health checks
const express = require('express');
const morgan = require('morgan');
const setupCors = require('./middleware/cors');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const config = require('./config/config');
const helmet = require('helmet'); // Additional security

// Import routes
const deviceRoutes = require('./routes/deviceRoutes');
const balanceRoutes = require('./routes/balanceRoutes');
const kaspiRoutes = require('./routes/kaspiRoutes');
const dispensingRoutes = require('./routes/dispensingRoutes');
const healthRoutes = require('./routes/healthRoutes'); // New health routes

// Initialize Firebase with improved error handling
const firebase = require('./utils/firebase');
try {
  const firebaseInitialized = firebase.initializeFirebase();
  if (firebaseInitialized) {
    logger.info('Firebase initialized successfully');
  } else {
    logger.warn('Firebase initialization skipped or failed. Some functionality may be limited.');
  }
} catch (error) {
  logger.error(`Firebase initialization error: ${error.message}`);
  logger.warn('Continuing without Firebase. Some functionality will be limited.');
}

// Create Express app
const app = express();

// Enhance security with helmet
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for Swagger UI
  crossOriginEmbedderPolicy: false // Allow loading resources from other origins
}));

// Set up CORS
app.use(setupCors());

// Request logging
app.use(morgan('combined', {
  skip: (req, res) => {
    // Skip logging health check endpoints to reduce noise
    return req.path.startsWith('/api/health/liveness') || 
           req.path.startsWith('/api/health/readiness');
  }
}));

// Parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request ID middleware for better tracking
app.use((req, res, next) => {
  req.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Register routes
app.use('/api/devices', deviceRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/kaspi', kaspiRoutes);
app.use('/api/dispensing', dispensingRoutes);
app.use('/api/health', healthRoutes); // Add health routes

// API root route
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to EcoTrend API',
    version: config.app.version,
    environment: config.app.env,
    timestamp: new Date().toISOString()
  });
});

// Add swagger documentation if available
try {
  const swagger = require('./swagger');
  app.use('/api/docs', swagger.serve, swagger.setup);
  logger.info('Swagger documentation initialized at /api/docs');
} catch (error) {
  logger.warn(`Swagger documentation not available: ${error.message}`);
}

// Handle unknown routes
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  // Close server, database connections, etc.
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  // Close server, database connections, etc.
  process.exit(0);
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason });
  // Don't exit, just log for now
});

// Uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  // Give time for logging to complete, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Environment: ${config.app.env}`);
});

module.exports = app;