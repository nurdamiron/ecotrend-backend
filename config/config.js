// config/config.js
module.exports = {
    app: {
      name: 'ecotrend-backend',
      version: '1.0.0',
      env: process.env.NODE_ENV || 'development',
    },
    kaspi: {
      apiUrl: process.env.API_BASE_URL,
      ip: process.env.KASPI_ALLOWED_IP || '194.187.247.152', // IP для Kaspi API
      timeout: 15000, // Таймаут для запросов к Kaspi API (15 сек)
      bin: process.env.KASPI_BIN || '820909403043'

    },
    firebase: {
      databaseURL: process.env.FIREBASE_DB_URL,
      serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'your-secret-key',
      expiresIn: '24h',
    },
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      filePath: process.env.LOG_FILE_PATH || './logs/app.log',
    }
  };
