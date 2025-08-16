const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Gate = sequelize.define('Gate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'שם השער'
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'מספר הטלפון של השער'
  },
  authorizedNumber: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'מספר הטלפון המורשה לפתיחת השער'
  },
  lastOpenedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'תאריך הפתיחה האחרון'
  },
  lastCallStatus: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'סטטוס השיחה האחרונה'
  },
  lastCallDuration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'משך השיחה האחרונה בשניות'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'האם השער פעיל'
  }
}, {
  tableName: 'gates',
  comment: 'טבלת השערים במערכת'
});

module.exports = Gate;
