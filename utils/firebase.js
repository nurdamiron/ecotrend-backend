// utils/firebase.js
const admin = require('firebase-admin');
const config = require('../config/config');
const logger = require('./logger');

// Инициализация Firebase Admin SDK
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized) return;

  try {
    const serviceAccount = require(config.firebase.serviceAccountPath);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: config.firebase.databaseURL
    });
    
    firebaseInitialized = true;
    logger.info('Firebase initialized successfully');
  } catch (error) {
    logger.error(`Firebase initialization error: ${error.message}`);
    throw error;
  }
};

/**
 * Получить баланс устройства из Firebase
 * @param {String} deviceId - ID устройства
 * @returns {Number} Текущий баланс
 */
const getDeviceBalance = async (deviceId) => {
  try {
    if (!firebaseInitialized) initializeFirebase();
    
    const snapshot = await admin.database().ref(`/${deviceId}/balance`).once('value');
    const balance = snapshot.val() || 0;
    
    logger.info(`Firebase balance for device ${deviceId}: ${balance}`);
    return balance;
  } catch (error) {
    logger.error(`Error getting balance from Firebase: ${error.message}`);
    throw error;
  }
};

/**
 * Обновить баланс устройства в Firebase
 * @param {String} deviceId - ID устройства
 * @param {Number} amount - Сумма для добавления к балансу (отрицательная для уменьшения)
 * @returns {Boolean} Успешно или нет
 */
const updateDeviceBalance = async (deviceId, amount) => {
  try {
    if (!firebaseInitialized) initializeFirebase();
    
    // Получить текущий баланс
    const currentBalance = await getDeviceBalance(deviceId);
    
    // Вычислить новый баланс
    const newBalance = currentBalance + amount;
    
    // Обновить баланс в Firebase
    await admin.database().ref(`/${deviceId}/balance`).set(newBalance);
    
    logger.info(`Firebase balance updated for device ${deviceId}: ${currentBalance} -> ${newBalance}`);
    return true;
  } catch (error) {
    logger.error(`Error updating balance in Firebase: ${error.message}`);
    throw error;
  }
};

/**
 * Получить информацию о химикатах из Firebase
 * @param {String} deviceId - ID устройства
 * @returns {Object} Информация о химикатах
 */
const getChemicals = async (deviceId) => {
  try {
    if (!firebaseInitialized) initializeFirebase();
    
    const snapshot = await admin.database().ref(`/${deviceId}/containers`).once('value');
    const chemicals = snapshot.val() || {};
    
    return chemicals;
  } catch (error) {
    logger.error(`Error getting chemicals from Firebase: ${error.message}`);
    throw error;
  }
};

/**
 * Синхронизировать данные устройства из Firebase в MySQL
 * @param {String} deviceId - ID устройства
 */
const syncDeviceData = async (deviceId) => {
  try {
    if (!firebaseInitialized) initializeFirebase();
    
    // Получить данные устройства из Firebase
    const snapshot = await admin.database().ref(`/${deviceId}`).once('value');
    const deviceData = snapshot.val() || {};
    
    // Здесь можно добавить логику для синхронизации данных между Firebase и MySQL
    logger.info(`Device data synced from Firebase for ${deviceId}`);
    
    return deviceData;
  } catch (error) {
    logger.error(`Error syncing device data from Firebase: ${error.message}`);
    throw error;
  }
};

module.exports = {
  initializeFirebase,
  getDeviceBalance,
  updateDeviceBalance,
  getChemicals,
  syncDeviceData
};