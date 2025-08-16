const { Sequelize } = require('sequelize');
require('dotenv').config();

// Database configuration
const sequelize = new Sequelize(
  process.env.DB_NAME || 'gates_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true
    }
  }
);

// Test database connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ התחברות למסד נתונים MySQL הצליחה');
  } catch (error) {
    console.error('❌ שגיאה בהתחברות למסד נתונים MySQL:', error.message);
  }
}

module.exports = { sequelize, testConnection };
