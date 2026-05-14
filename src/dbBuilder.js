// src/dbBuilder.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const schemas = require('./schemas');

function hashPassword(password, algorithm = 'md5') {
  return crypto.createHash(algorithm).update(password).digest('hex');
}

/**
 * Builds the SQLite database for a specific instance.
 * @param {string} instancePath - The directory of the instance.
 * @param {string} templateName - The name of the template (e.g., 'ecommerce').
 * @param {object} config - Claude's configuration object.
 * @returns {Promise<void>}
 */
function buildDatabase(instancePath, templateName, config) {
  return new Promise((resolve, reject) => {
    const templateSchema = schemas[templateName];
    if (!templateSchema) {
      return reject(new Error(`Unknown template: ${templateName}`));
    }

    const dbPath = path.join(instancePath, 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      // 1. Create Tables
      for (const [tableName, tableDef] of Object.entries(templateSchema.tables)) {
        db.run(`CREATE TABLE IF NOT EXISTS ${tableName} (${tableDef.schema})`);
      }

      // Helper function to insert data
      const insertData = (tableName, records) => {
        if (!records || records.length === 0) return;
        const validColumns = templateSchema.tables[tableName].columns;

        records.forEach(record => {
          const columnsToInsert = [];
          const valuesToInsert = [];
          const placeholders = [];

          // Process password hashing if configured
          let processedRecord = { ...record };
          if (processedRecord.password !== undefined && config.db_settings?.hash_passwords) {
            processedRecord.password = hashPassword(processedRecord.password);
          }

          // Filter out columns not in schema
          for (const [key, value] of Object.entries(processedRecord)) {
            if (validColumns.includes(key)) {
              columnsToInsert.push(key);
              valuesToInsert.push(value);
              placeholders.push('?');
            }
          }

          if (columnsToInsert.length > 0) {
            const sql = `INSERT INTO ${tableName} (${columnsToInsert.join(', ')}) VALUES (${placeholders.join(', ')})`;
            db.run(sql, valuesToInsert);
          }
        });
      };

      // 2. Insert Default Data (unless disabled)
      if (!config.db_settings?.disable_baseline_mock_data) {
        for (const [tableName, records] of Object.entries(templateSchema.defaultData)) {
          insertData(tableName, records);
        }
      }

      // 3. Insert Claude's Mock Data
      if (config.mock_data) {
        for (const [tableName, records] of Object.entries(config.mock_data)) {
          if (templateSchema.tables[tableName]) {
            insertData(tableName, records);
          }
        }
      }
    });

    db.close((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports = { buildDatabase };
