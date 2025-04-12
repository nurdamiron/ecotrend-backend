// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const logger = require('../utils/logger');

/**
 * Create Redis store if Redis connection is available, otherwise use memory store
 */
function createLimiterStore() {
  try {
    // Check if Redis is configured in environment
    if (process.env.REDIS_URL) {
      const Redis = require('ioredis');
      const redisClient = new Redis(process.env.REDIS_URL);
      
      // Test connection
      redisClient.on('error', (err) => {
        logger.error(`Redis error: ${err.message}. Falling back to memory store.`);
        return null; // Will fall back to memory store
      });
      
      return new RedisStore({
        // @ts-expect-error - Known issue with dependency types
        sendCommand: (...args) => redisClient.call(...args),
      });
    }
    
    return null; // Use memory store
  } catch (error) {
    logger.warn(`Failed to create Redis store: ${error.message}. Using memory store.`);
    return null; // Use memory store
  }
}

// Create store once at module load
const limiterStore = createLimiterStore();

/**
 * Default API rate limiter - 100 requests per minute
 */
const defaultLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Max 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  store: limiterStore,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    error: 'RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy, otherwise IP
    return req.headers['x-forwarded-for'] || req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path.startsWith('/api/health');
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  }
});

/**
 * Stricter rate limiter for authentication - 20 requests per minute
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Max 20 auth requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  store: limiterStore,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    error: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy, otherwise IP
    return req.headers['x-forwarded-for'] || req.ip;
  }
});

/**
 * Very strict limiter for sensitive operations - 5 requests per minute
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Max 5 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  store: limiterStore,
  message: {
    success: false,
    message: 'Rate limit exceeded for sensitive operations.',
    error: 'STRICT_RATE_LIMIT_EXCEEDED'
  }
});

/**
 * Kaspi API limiter - higher limit since they may send bursts of requests
 */
const kaspiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // Max 300 requests per minute from Kaspi
  standardHeaders: true,
  legacyHeaders: false,
  store: limiterStore,
  skip: (req) => {
    // Only apply to Kaspi API routes
    return !req.path.startsWith('/api/kaspi');
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy, otherwise IP
    return req.headers['x-forwarded-for'] || req.ip;
  }
});

module.exports = {
  defaultLimiter,
  authLimiter,
  strictLimiter,
  kaspiLimiter
};