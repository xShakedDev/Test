const { sequelize } = require('./database');
const Gate = require('../models/Gate');

async function initializeDatabase() {
  try {
    console.log('🚀 מתחיל אתחול מסד נתונים...');
    
    // Sync all models with database (create tables if they don't exist)
    await sequelize.sync({ force: false }); // force: false means don't drop existing tables
    console.log('✅ טבלאות מסד הנתונים הותאמו');
    
    // Check if we need to seed initial data
    const gateCount = await Gate.count();
    
    if (gateCount === 0) {
      console.log('🌱 מוסיף נתונים ראשוניים...');
      
      // Seed initial gates data
      const initialGates = [
        {
          name: 'שער סירקין שטח',
          phoneNumber: '+972527418575',
          authorizedNumber: '+972548827828',
          isActive: true
        },
        {
          name: 'שער ראשי',
          phoneNumber: '+1234567890',
          authorizedNumber: '+972542070400',
          isActive: true
        },
        {
          name: 'שער צדדי',
          phoneNumber: '+0987654321',
          authorizedNumber: '+972542070400',
          isActive: true
        }
      ];
      
      for (const gateData of initialGates) {
        await Gate.create(gateData);
      }
      
      console.log(`✅ נוספו ${initialGates.length} שערים ראשוניים`);
    } else {
      console.log(`ℹ️ כבר קיימים ${gateCount} שערים במסד הנתונים`);
    }
    
    console.log('🎉 אתחול מסד הנתונים הושלם בהצלחה');
    
  } catch (error) {
    console.error('❌ שגיאה באתחול מסד הנתונים:', error);
    throw error;
  }
}

// Function to close database connection
async function closeDatabase() {
  try {
    await sequelize.close();
    console.log('🔒 חיבור למסד הנתונים נסגר');
  } catch (error) {
    console.error('❌ שגיאה בסגירת חיבור למסד הנתונים:', error);
  }
}

module.exports = { initializeDatabase, closeDatabase };
