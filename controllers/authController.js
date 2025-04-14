// controllers/authController.js
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Авторизация пользователя
 * @route POST /api/auth/login
 */
/**
 * Авторизация пользователя
 * @route POST /api/auth/login
 */
exports.login = async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Проверка входных данных
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email и пароль обязательны для заполнения'
        });
      }
      
      logger.info(`Попытка входа для пользователя: ${email}`);
      
      // Поиск пользователя в базе данных
      const [users] = await pool.execute(
        'SELECT * FROM users WHERE username = ?',
        [email]
      );
      
      if (users.length === 0) {
        logger.warn(`Неудачный вход: пользователь ${email} не найден`);
        return res.status(401).json({
          success: false,
          message: 'Неверные учетные данные'
        });
      }
      
      const user = users[0];
      
      // Простое сравнение паролей (без хэширования)
      const isPasswordValid = (password === user.password);
      
      if (!isPasswordValid) {
        logger.warn(`Неудачный вход: неверный пароль для ${email}`);
        return res.status(401).json({
          success: false,
          message: 'Неверные учетные данные'
        });
      }
      
      // Создание JWT токена
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          type: user.role === 'admin' ? 'admin' : 'user'
        }, 
        config.jwt.secret, 
        { expiresIn: config.jwt.expiresIn }
      );
      
      // Формирование ответа
      return res.status(200).json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.username,
          isAdmin: user.role === 'admin'
        }
      });
    } catch (error) {
      logger.error(`Ошибка входа: ${error.message}`, { stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Произошла ошибка при входе в систему',
        error: error.message
      });
    }
  };
  

/**
 * Регистрация нового пользователя (только для админов)
 * @route POST /api/auth/register
 */
exports.register = async (req, res) => {
    try {
      const { email, password, isAdmin } = req.body;
      
      // Проверка входных данных
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email и пароль обязательны для заполнения'
        });
      }
      
      // Проверка существующего пользователя
      const [existingUsers] = await pool.execute(
        'SELECT * FROM users WHERE username = ?',
        [email]
      );
      
      if (existingUsers.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Пользователь с таким email уже существует'
        });
      }
      
      // Сохраняем пароль в открытом виде
      const role = isAdmin ? 'admin' : 'user';
      
      // Создание пользователя
      const [result] = await pool.execute(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [email, password, role]
      );
      
      logger.info(`Создан пользователь: ${email}, роль: ${role}`);
      
      return res.status(201).json({
        success: true,
        message: 'Пользователь успешно создан',
        user: {
          id: result.insertId,
          email,
          isAdmin: role === 'admin'
        }
      });
    } catch (error) {
      logger.error(`Ошибка регистрации: ${error.message}`, { stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Произошла ошибка при регистрации',
        error: error.message
      });
    }
  };
  

/**
 * Проверка авторизации текущего пользователя
 * @route GET /api/auth/check
 */
exports.checkAuth = async (req, res) => {
  try {
    // Проверка токена обрабатывается в middleware

    // Информация о пользователе добавляется в req через middleware
    const user = req.user || req.admin;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Пользователь не авторизован'
      });
    }
    
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.username,
        isAdmin: user.type === 'admin'
      }
    });
  } catch (error) {
    logger.error(`Ошибка проверки авторизации: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Произошла ошибка при проверке авторизации',
      error: error.message
    });
  }
};