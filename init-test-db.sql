-- Create test tables for the ecotrend_test database
USE ecotrend_test;

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create balances table
CREATE TABLE IF NOT EXISTS balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL UNIQUE,
  balance DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Create chemicals table
CREATE TABLE IF NOT EXISTS chemicals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL,
  tank_number INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  batch_number VARCHAR(50),
  manufacturing_date DATE,
  expiration_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_device_tank (device_id, tank_number),
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  txn_id VARCHAR(100) NOT NULL UNIQUE,
  prv_txn_id VARCHAR(100) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Create dispensing_operations table
CREATE TABLE IF NOT EXISTS dispensing_operations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL,
  transaction_id INT,
  tank_number INT NOT NULL,
  chemical_name VARCHAR(100) NOT NULL,
  price_per_liter DECIMAL(10, 2) NOT NULL,
  volume DECIMAL(10, 3) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  expiration_date DATE,
  batch_number VARCHAR(50),
  receipt_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

-- Grant proper permissions for the test user
GRANT ALL PRIVILEGES ON ecotrend_test.* TO 'ecotrend_user'@'%';
FLUSH PRIVILEGES;