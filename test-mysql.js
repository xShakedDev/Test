const { sequelize, testConnection } = require('./server/config/database');
const { initializeDatabase } = require('./server/config/init-db');

async function testMySQLSetup() {
  console.log('🧪 בודק הגדרת MySQL...');
  
  try {
    // Test connection
    console.log('1️⃣ בודק חיבור למסד נתונים...');
    await testConnection();
    
    // Initialize database
    console.log('2️⃣ מאתחל מסד נתונים...');
    await initializeDatabase();
    
    console.log('✅ כל הבדיקות עברו בהצלחה!');
    console.log('🎉 MySQL מוגדר ופועל');
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקת MySQL:', error.message);
    console.log('\n🔧 פתרונות אפשריים:');
    console.log('1. ודא ש-MySQL פועל');
    console.log('2. בדוק את פרטי החיבור ב-.env');
    console.log('3. צור את מסד הנתונים gates_db');
    console.log('4. בדוק הרשאות משתמש');
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Run the test
testMySQLSetup();
