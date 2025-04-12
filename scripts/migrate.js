// scripts/migrate.js
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Configuration
const config = {
  host: process.env.DB_HOST || 'biz360.czwiyugwum02.eu-north-1.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'nurda0101',
  multipleStatements: true
};

/**
 * Main migration function
 */
async function migrate() {
  let connection;
  
  try {
    console.log('Starting database migration...');
    
    // Connect to MySQL server (without selecting a database)
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      multipleStatements: true
    });
    
    // Get database name from environment or use default
    const dbName = process.env.DB_NAME || 'ecotrend';
    
    // Check if database exists, create if not
    await ensureDatabaseExists(connection, dbName);
    
    // Switch to the database
    await connection.query(`USE ${dbName}`);
    
    // Ensure migrations table exists
    await ensureMigrationsTableExists(connection);
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations(connection);
    
    // Get migration files
    const migrationFiles = getMigrationFiles();
    
    // Filter out already applied migrations
    const pendingMigrations = migrationFiles.filter(file => {
      const migrationName = path.parse(file).name;
      return !appliedMigrations.includes(migrationName);
    }).sort(); // Ensure alphabetical order
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migrations`);
    
    // Apply each migration
    for (const migrationFile of pendingMigrations) {
      const migrationName = path.parse(migrationFile).name;
      console.log(`Applying migration: ${migrationName}`);
      
      try {
        // Read migration file
        const migrationPath = path.join(__dirname, '../migrations', migrationFile);
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        
        // Begin transaction
        await connection.beginTransaction();
        
        // Execute migration
        await connection.query(migrationSql);
        
        // Record migration
        await connection.query(
          'INSERT INTO migrations (name, applied_at) VALUES (?, NOW())',
          [migrationName]
        );
        
        // Commit transaction
        await connection.commit();
        
        console.log(`Successfully applied migration: ${migrationName}`);
      } catch (error) {
        // Rollback on error
        await connection.rollback();
        console.error(`Error applying migration ${migrationName}:`, error.message);
        throw error; // Re-throw to stop migration process
      }
    }
    
    console.log('All migrations applied successfully');
  } catch (error) {
    console.error('Migration error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Ensure database exists, create if not
 */
async function ensureDatabaseExists(connection, dbName) {
  try {
    // Check if database exists
    const [rows] = await connection.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [dbName]
    );
    
    if (rows.length === 0) {
      console.log(`Database '${dbName}' does not exist, creating...`);
      await connection.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database '${dbName}' created`);
    } else {
      console.log(`Database '${dbName}' already exists`);
    }
  } catch (error) {
    console.error('Error ensuring database exists:', error.message);
    throw error;
  }
}

/**
 * Ensure migrations table exists
 */
async function ensureMigrationsTableExists(connection) {
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.error('Error ensuring migrations table exists:', error.message);
    throw error;
  }
}

/**
 * Get applied migrations from database
 */
async function getAppliedMigrations(connection) {
  try {
    const [rows] = await connection.query('SELECT name FROM migrations ORDER BY applied_at');
    return rows.map(row => row.name);
  } catch (error) {
    console.error('Error getting applied migrations:', error.message);
    throw error;
  }
}

/**
 * Get migration files from migrations directory
 */
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '../migrations');
  
  // Ensure migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    console.log('Created migrations directory');
  }
  
  // Get .sql files
  return fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort to ensure order
}

/**
 * Create a new migration file
 */
function createMigration(name) {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const fileName = `${timestamp}_${name}.sql`;
  const migrationsDir = path.join(__dirname, '../migrations');
  
  // Ensure migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  const filePath = path.join(migrationsDir, fileName);
  
  // Create the file with a template
  fs.writeFileSync(filePath, `-- Migration: ${name}
-- Created at: ${new Date().toISOString()}
-- Description: 

-- Up Migration

-- Example:
-- CREATE TABLE example (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   name VARCHAR(255) NOT NULL
-- );

`);

  console.log(`Created migration file: ${fileName}`);
  return fileName;
}

// Handle command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'create' && args[1]) {
    // Create new migration
    createMigration(args[1]);
  } else {
    // Run migrations
    migrate()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Migration failed:', error);
        process.exit(1);
      });
  }
}

module.exports = {
  migrate,
  createMigration
};