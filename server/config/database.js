const mongoose = require('mongoose');

// MongoDB connection configuration
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gates';
    
    if (!mongoURI || mongoURI.includes('<db_password>')) {
      throw new Error('MONGODB_URI is not set or contains placeholder. Please set MONGODB_URI in your .env file with your actual MongoDB connection string.');
    }
    
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000,
    });

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
    
    // Provide helpful error messages
    if (error.message.includes('ENOTFOUND') || error.message.includes('querySrv')) {
      console.error('\n❌ MongoDB connection string error:');
      console.error('   The connection string format might be incorrect.');
      console.error('   For MongoDB Atlas, use: mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority');
      console.error('   Make sure to replace <db_password> in your .env file with your actual password.');
    } else if (error.message.includes('authentication failed')) {
      console.error('\n❌ MongoDB authentication failed:');
      console.error('   Check your username and password in the MONGODB_URI.');
    } else if (error.message.includes('not set or contains placeholder')) {
      console.error('\n❌ MongoDB URI not configured:');
      console.error('   Please set MONGODB_URI in your .env file.');
    } else {
      console.error('\n❌ MongoDB connection error:');
      console.error('   Check your MONGODB_URI in the .env file.');
      console.error('   For local MongoDB: mongodb://localhost:27017/gates');
      console.error('   For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority');
    }
    
    // In development, continue without MongoDB for now
    if (process.env.NODE_ENV === 'development') {
      console.warn('\n⚠️  Running without MongoDB in development mode');
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
