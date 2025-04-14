// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateAdmin } = require('../middleware/auth');

// Authentication routes
router.post('/login', authController.login);
router.post('/register', authController.register);
// Add this route:
router.get('/check', authenticateAdmin, authController.checkAuth);

module.exports = router;