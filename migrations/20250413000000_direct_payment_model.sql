-- Migration: Переход от модели с балансом к модели прямой оплаты
-- Created at: 2025-04-13T00:00:00
-- Description: Обновляет структуру БД для поддержки модели прямой оплаты операций дозирования

-- 1. Создаем таблицу flow_states для отслеживания этапов операции
CREATE TABLE IF NOT EXISTS flow_states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL UNIQUE,
  device_id VARCHAR(100) NOT NULL,
  stage ENUM('calculated', 'awaiting_payment', 'payment_completed', 'dispensing', 'completed') NOT NULL DEFAULT 'calculated',
  chemical_id INT,
  tank_number INT,
  volume DECIMAL(10, 3),
  amount DECIMAL(10, 2),
  transaction_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_device_id (device_id),
  INDEX idx_transaction_id (transaction_id),
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- 2. Обновляем таблицу transactions для поддержки прямой оплаты
ALTER TABLE transactions
  ADD COLUMN tank_number INT AFTER device_id,
  ADD COLUMN chemical_name VARCHAR(100) AFTER tank_number,
  ADD COLUMN volume DECIMAL(10, 3) AFTER chemical_name,
  ADD COLUMN dispensed BOOLEAN DEFAULT FALSE AFTER status;

-- 3. Обновляем таблицу dispensing_operations для соответствия новой модели
ALTER TABLE dispensing_operations
  MODIFY COLUMN status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'completed';

-- 4. Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_flow_session_id ON flow_states(session_id);
CREATE INDEX IF NOT EXISTS idx_flow_device_id ON flow_states(device_id);
CREATE INDEX IF NOT EXISTS idx_transaction_txn_id ON transactions(txn_id);
CREATE INDEX IF NOT EXISTS idx_transaction_device_id ON transactions(device_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_transaction_id ON dispensing_operations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_device_id ON dispensing_operations(device_id);

-- 5. Удаляем таблицу balances, если она существует (опционально)
DROP TABLE IF EXISTS balances;