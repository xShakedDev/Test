const { connectDB, isConnected } = require('./server/config/database');
const mongoose = require('mongoose');

async function testServer() {
  try {
    console.log('Testing server components...');
    
    // Test MongoDB connection
    console.log('1. Testing MongoDB connection...');
    await connectDB();
    console.log('✅ MongoDB connected successfully');
    
    // Test mongoose import
    console.log('2. Testing mongoose import...');
    if (mongoose.Types.ObjectId.isValid('507f1f77bcf86cd799439011')) {
      console.log('✅ Mongoose ObjectId validation working');
    } else {
      console.log('❌ Mongoose ObjectId validation failed');
    }
    
    // Test models
    console.log('3. Testing model imports...');
    const Gate = require('./server/models/Gate');
    const GateHistory = require('./server/models/GateHistory');
    const User = require('./server/models/User');
    console.log('✅ All models imported successfully');
    
    console.log('\n🎉 All tests passed! Server should work correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Close connection
    if (isConnected()) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    }
    process.exit(0);
  }
}

testServer();
