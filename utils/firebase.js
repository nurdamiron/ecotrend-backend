// utils/firebase.js - Improved version
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const logger = require('./logger');

// Improved initialization logic
let firebaseInitialized = false;
let initializationAttempted = false;

/**
 * Initialize Firebase with better error handling and fallback options
 */
const initializeFirebase = () => {
  // Skip if already initialized or already attempted
  if (firebaseInitialized || initializationAttempted) return firebaseInitialized;
  
  try {
    initializationAttempted = true;
    logger.info('Attempting to initialize Firebase...');
    
    // Get service account path from config
    const serviceAccountPath = config.firebase?.serviceAccountPath || 
                              process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
                              './firebase-service-account.json';
    
    // Check if service account file exists
    if (!fs.existsSync(serviceAccountPath)) {
      logger.warn(`Firebase service account file not found at: ${serviceAccountPath}`);
      logger.warn('Firebase initialization skipped. Some functionality may be limited.');
      return false;
    }
    
    // Load service account
    const serviceAccount = require(path.resolve(serviceAccountPath));
    
    // Validate service account has required fields
    if (!serviceAccount || !serviceAccount.project_id || !serviceAccount.private_key) {
      logger.warn('Firebase service account file is invalid or incomplete');
      logger.warn('Firebase initialization skipped. Some functionality may be limited.');
      return false;
    }
    
    // Get database URL
    const databaseURL = config.firebase?.databaseURL || 
                        process.env.FIREBASE_DB_URL || 
                        `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`;
    
    // Initialize Firebase
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: databaseURL
    });
    
    firebaseInitialized = true;
    logger.info('Firebase initialized successfully');
    return true;
  } catch (error) {
    logger.error(`Firebase initialization error: ${error.message}`);
    if (error.stack) {
      logger.debug(error.stack);
    }
    return false;
  }
};

/**
 * Get Firebase database reference with fallback for non-initialized Firebase
 */
const getDatabase = () => {
  if (!firebaseInitialized) {
    if (!initializationAttempted) {
      initializeFirebase();
    }
    
    if (!firebaseInitialized) {
      throw new Error('Firebase not initialized. Cannot access database.');
    }
  }
  
  return admin.database();
};

/**
 * Safely get device balance from Firebase with fallback
 * @param {String} deviceId - ID of the device
 * @returns {Number} Current balance or 0 if not found
 */
const getDeviceBalance = async (deviceId) => {
  try {
    // Validate deviceId
    if (!deviceId || typeof deviceId !== 'string') {
      logger.warn(`Invalid deviceId provided to getDeviceBalance: ${deviceId}`);
      return 0;
    }
    
    if (!firebaseInitialized && !initializeFirebase()) {
      logger.warn(`Firebase not initialized. Using fallback for device ${deviceId} balance.`);
      return 0; // Fallback balance
    }
    
    const snapshot = await getDatabase().ref(`/${deviceId}/balance`).once('value');
    const balance = snapshot.val() || 0;
    
    logger.info(`Firebase balance for device ${deviceId}: ${balance}`);
    return balance;
  } catch (error) {
    logger.error(`Error getting balance from Firebase: ${error.message}`);
    return 0; // Fallback balance on error
  }
};

/**
 * Safely update device balance in Firebase with fallback
 * @param {String} deviceId - ID of the device 
 * @param {Number} amount - Amount to add to balance (negative for subtraction)
 * @returns {Boolean} Success status
 */
const updateDeviceBalance = async (deviceId, amount) => {
  try {
    // Validate parameters
    if (!deviceId || typeof deviceId !== 'string') {
      logger.warn(`Invalid deviceId provided to updateDeviceBalance: ${deviceId}`);
      return false;
    }
    
    if (isNaN(amount)) {
      logger.warn(`Invalid amount provided to updateDeviceBalance: ${amount}`);
      return false;
    }
    
    if (!firebaseInitialized && !initializeFirebase()) {
      logger.warn(`Firebase not initialized. Skipping balance update for device ${deviceId}.`);
      return false;
    }
    
    // Get current balance
    const currentBalance = await getDeviceBalance(deviceId);
    
    // Calculate new balance
    const newBalance = currentBalance + parseFloat(amount);
    
    // Update balance in Firebase
    await getDatabase().ref(`/${deviceId}/balance`).set(newBalance);
    
    logger.info(`Firebase balance updated for device ${deviceId}: ${currentBalance} -> ${newBalance}`);
    return true;
  } catch (error) {
    logger.error(`Error updating balance in Firebase: ${error.message}`);
    return false;
  }
};

/**
 * Safely get chemicals info from Firebase with fallback
 * @param {String} deviceId - ID of the device
 * @returns {Object} Chemicals information or empty object if not found
 */
const getChemicals = async (deviceId) => {
  try {
    // Validate deviceId
    if (!deviceId || typeof deviceId !== 'string') {
      logger.warn(`Invalid deviceId provided to getChemicals: ${deviceId}`);
      return {};
    }
    
    if (!firebaseInitialized && !initializeFirebase()) {
      logger.warn(`Firebase not initialized. Using fallback for device ${deviceId} chemicals.`);
      return {}; // Fallback empty chemicals
    }
    
    const snapshot = await getDatabase().ref(`/${deviceId}/containers`).once('value');
    const chemicals = snapshot.val() || {};
    
    return chemicals;
  } catch (error) {
    logger.error(`Error getting chemicals from Firebase: ${error.message}`);
    return {}; // Fallback empty chemicals on error
  }
};

/**
 * Safely sync device data from Firebase to MySQL with fallback
 * @param {String} deviceId - ID of the device
 * @returns {Object} Device data or empty object if not found
 */
const syncDeviceData = async (deviceId) => {
  try {
    // Validate deviceId
    if (!deviceId || typeof deviceId !== 'string') {
      logger.warn(`Invalid deviceId provided to syncDeviceData: ${deviceId}`);
      return {};
    }
    
    if (!firebaseInitialized && !initializeFirebase()) {
      logger.warn(`Firebase not initialized. Using fallback for device ${deviceId} sync.`);
      return {
        balance: 0,
        info: { status: 'active' },
        containers: {}
      }; // Fallback device data
    }
    
    const snapshot = await getDatabase().ref(`/${deviceId}`).once('value');
    const deviceData = snapshot.val() || {};
    
    // Add default values for critical fields if missing
    if (!deviceData.info) deviceData.info = { status: 'active' };
    if (!deviceData.balance) deviceData.balance = 0;
    if (!deviceData.containers) deviceData.containers = {};
    
    logger.info(`Device data synced from Firebase for ${deviceId}`);
    
    return deviceData;
  } catch (error) {
    logger.error(`Error syncing device data from Firebase: ${error.message}`);
    return {
      balance: 0,
      info: { status: 'active' },
      containers: {}
    }; // Fallback device data on error
  }
};

module.exports = {
  initializeFirebase,
  getDeviceBalance,
  updateDeviceBalance,
  getChemicals,
  syncDeviceData,
  // Expose for testing
  _isInitialized: () => firebaseInitialized
};