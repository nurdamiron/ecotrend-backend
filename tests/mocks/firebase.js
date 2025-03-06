// tests/mocks/firebase.js
// Mock для Firebase, используемый в тестах

/**
 * Мок модуля firebase для тестирования без реальной Firebase
 */
const firebaseMock = {
    // Флаг инициализации
    firebaseInitialized: false,
  
    // Мок данных устройств
    deviceData: {},
  
    // Инициализация Firebase
    initializeFirebase: function() {
      this.firebaseInitialized = true;
      return true;
    },
  
    // Получение баланса устройства
    getDeviceBalance: async function(deviceId) {
      if (!this.deviceData[deviceId]) {
        this.deviceData[deviceId] = { balance: 0 };
      }
      return this.deviceData[deviceId].balance;
    },
  
    // Обновление баланса устройства
    updateDeviceBalance: async function(deviceId, amount) {
      if (!this.deviceData[deviceId]) {
        this.deviceData[deviceId] = { balance: 0 };
      }
      
      this.deviceData[deviceId].balance = (this.deviceData[deviceId].balance || 0) + amount;
      return true;
    },
  
    // Получение химикатов устройства
    getChemicals: async function(deviceId) {
      if (!this.deviceData[deviceId]) {
        this.deviceData[deviceId] = { 
          containers: {
            tank1: { name: 'Test Chemical', price: 100 }
          } 
        };
      }
      
      return this.deviceData[deviceId].containers || {};
    },
  
    // Синхронизация данных устройства
    syncDeviceData: async function(deviceId) {
      if (!this.deviceData[deviceId]) {
        this.deviceData[deviceId] = {
          balance: 0,
          info: { status: 'active' },
          containers: {
            tank1: { name: 'Test Chemical', price: 100 }
          }
        };
      }
      
      return this.deviceData[deviceId];
    }
  };
  
  module.exports = firebaseMock;