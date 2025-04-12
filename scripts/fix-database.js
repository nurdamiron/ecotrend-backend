// scripts/fix-database.js
const mysql = require('mysql2/promise');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Script to fix database inconsistencies
 * - Ensures device records exist for all referenced devices
 * - Cleans up orphaned records
 */
async function fixDatabase() {
  // Create connection to database
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || config.database?.host || 'biz360.czwiyugwum02.eu-north-1.rds.amazonaws.com',
    port: process.env.DB_PORT || config.database?.port || 3306,
    user: process.env.DB_USER || config.database?.user || 'root',
    password: process.env.DB_PASSWORD || config.database?.password || 'nurda0101',
    database: process.env.DB_NAME || config.database?.database || 'ecotrend',
  });

  try {
    console.log('Starting database consistency check...');
    
    // Get all device IDs from transactions that don't have corresponding device records
    const [orphanedTransactions] = await connection.execute(`
      SELECT DISTINCT t.device_id 
      FROM transactions t 
      LEFT JOIN devices d ON t.device_id = d.device_id 
      WHERE d.device_id IS NULL
    `);

    if (orphanedTransactions.length > 0) {
      console.log(`Found ${orphanedTransactions.length} device IDs in transactions with no device record`);
      
      // Create missing device records
      for (const record of orphanedTransactions) {
        const deviceId = record.device_id;
        console.log(`Creating missing device record for ID: ${deviceId}`);
        
        await connection.execute(
          'INSERT INTO devices (device_id, name, location) VALUES (?, ?, ?)',
          [deviceId, `Auto-created device ${deviceId}`, 'Unknown location']
        );
        
        // Initialize balance for the device
        const [balanceExists] = await connection.execute(
          'SELECT 1 FROM balances WHERE device_id = ?', 
          [deviceId]
        );
        
        if (balanceExists.length === 0) {
          await connection.execute(
            'INSERT INTO balances (device_id, balance) VALUES (?, 0)',
            [deviceId]
          );
        }
      }
      
      console.log('Missing device records created successfully');
    } else {
      console.log('No orphaned transactions found');
    }
    
    // Check for other potential orphaned records in other tables
    const tables = ['balances', 'chemicals', 'dispensing_operations'];
    
    for (const table of tables) {
      const [orphanedRecords] = await connection.execute(`
        SELECT DISTINCT t.device_id 
        FROM ${table} t 
        LEFT JOIN devices d ON t.device_id = d.device_id 
        WHERE d.device_id IS NULL
      `);
      
      if (orphanedRecords.length > 0) {
        console.log(`Found ${orphanedRecords.length} device IDs in ${table} with no device record`);
        
        // Create missing device records
        for (const record of orphanedRecords) {
          const deviceId = record.device_id;
          console.log(`Creating missing device record for ID: ${deviceId}`);
          
          await connection.execute(
            'INSERT INTO devices (device_id, name, location) VALUES (?, ?, ?)',
            [deviceId, `Auto-created device ${deviceId}`, 'Unknown location']
          );
          
          // Initialize balance if needed
          const [balanceExists] = await connection.execute(
            'SELECT 1 FROM balances WHERE device_id = ?', 
            [deviceId]
          );
          
          if (balanceExists.length === 0) {
            await connection.execute(
              'INSERT INTO balances (device_id, balance) VALUES (?, 0)',
              [deviceId]
            );
          }
        }
      }
    }
    
    console.log('Database consistency check completed');
    
  } catch (error) {
    console.error('Error fixing database:', error.message);
  } finally {
    await connection.end();
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  fixDatabase()
    .then(() => {
      console.log('Database fix script completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('Script failed:', err);
      process.exit(1);
    });
}

module.exports = fixDatabase;