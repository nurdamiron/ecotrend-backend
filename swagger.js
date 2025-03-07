// swagger.js с поддержкой продакшн домена
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Базовая конфигурация Swagger
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EcoTrend API',
      version: '1.0.0',
      description: 'API сервиса EcoTrend для дозирования химикатов с интеграцией Kaspi',
      contact: {
        name: 'Служба поддержки EcoTrend',
        email: 'support@ecotrend.kz',
        url: 'https://ecotrend.kz'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'https://api.ecotrend.kz',
        description: 'Продакшн сервер'
      },
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Локальный сервер разработки'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{
      bearerAuth: []
    }],
    tags: [
      {
        name: 'Устройства',
        description: 'Операции с устройствами'
      },
      {
        name: 'Баланс',
        description: 'Операции с балансом устройств'
      },
      {
        name: 'Kaspi',
        description: 'Интеграция с платежной системой Kaspi'
      }
    ]
  },
  apis: [
    './routes/*.js',
    './swagger-docs/*.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = {
  serve: swaggerUi.serve,
  setup: swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'EcoTrend API - Документация',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      persistAuthorization: true,
      defaultModelsExpandDepth: -1, // Скрыть раздел Models по умолчанию
      displayRequestDuration: true, // Показывать время выполнения запросов
      language: 'ru-RU' // Установить русский язык интерфейса
    }
  })
};