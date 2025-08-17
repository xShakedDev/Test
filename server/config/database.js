const mongoose = require('mongoose');

// MongoDB connection configuration
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gates';
    
    const conn = await mongoose.connect(mongoURI);

    console.log(`MongoDB connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    // Graceful close on app termination
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('Error closing MongoDB connection:', error);
        process.exit(1);
      }
    });

    return conn;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    
    // In development, continue without MongoDB for now
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Running without MongoDB in development mode');
      console.warn('   Install MongoDB or set MONGODB_URI environment variable');
      return null;
    }
    
    // In production, exit on database connection failure
    process.exit(1);
  }
};

// Check if MongoDB is connected
const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

// Get connection status
const getConnectionStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
  };
};

module.exports = {
  connectDB,
  isConnected,
  getConnectionStatus
};
