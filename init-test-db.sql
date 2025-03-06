-- init-test-db.sql
CREATE DATABASE IF NOT EXISTS ecotrend_test;
USE ecotrend_test;

-- Удаляем существующего пользователя, если есть
DROP USER IF EXISTS 'root'@'%';

-- Создаем нового root-пользователя с доступом с любого хоста
CREATE USER 'root'@'%' IDENTIFIED BY 'nurda0101';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;

-- Create tables
CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL UNIQUE,
  balance DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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
  UNIQUE KEY unique_device_tank (device_id, tank_number)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  txn_id VARCHAR(100) NOT NULL UNIQUE,
  prv_txn_id VARCHAR(100) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);