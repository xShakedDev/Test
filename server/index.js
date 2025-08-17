const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env
require('dotenv').config({ path: 'test.env' });

// MongoDB integration
const { connectDB, isConnected, getConnectionStatus } = require('./config/database');

// Routes - choose between file-based or MongoDB-based
const gateRoutes = require('./routes/auth');
const mongoRoutes = require('./routes/auth-mongo');
const { router: userAuthRoutes } = require('./routes/auth-users');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Basic authentication middleware for admin routes
const authenticateAdmin = (req, res, next) => {
  const adminPassword = process.env.ADMIN_PASSWORD || 'your-secret-password';
  const providedPassword = req.headers['x-admin-password'] || req.body.adminPassword;
  if (providedPassword === adminPassword) {
    next();
  } else {
    res.status(401).json({ error: 'לא מורשה: נדרשת גישת מנהל' });
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// System status endpoint
app.get('/api/status', (req, res) => {
  try {
    const buildPath = path.join(__dirname, '../public');
    const indexPath = path.join(buildPath, 'index.html');
    
    const status = {
      server: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      storage: {
        type: process.env.USE_MONGODB === 'true' ? 'MongoDB' : 'File-based',
        useMongoDB: process.env.USE_MONGODB === 'true',
        mongoConnected: isConnected(),
        mongoStatus: getConnectionStatus()
      },
      files: {
        buildPath,
        indexPath,
        buildExists: fs.existsSync(buildPath),
        indexExists: fs.existsSync(indexPath)
      },
      twilio: {
        hasSid: !!process.env.TWILIO_ACCOUNT_SID,
        hasToken: !!process.env.TWILIO_AUTH_TOKEN,
      },
      admin: {
        hasPassword: !!process.env.ADMIN_PASSWORD
      }
    };
    
    res.json(status);
  } catch (error) {
    console.error('שגיאה בנקודת קצה סטטוס:', error);
    res.status(500).json({ error: 'נכשל בקבלת סטטוס המערכת' });
  }
});

// File status endpoint
app.get('/api/files', (req, res) => {
  try {
    const buildPath = path.join(__dirname, '../public');
    const indexPath = path.join(buildPath, 'index.html');
    
    const fileStatus = {
      buildPath,
      indexPath,
      buildExists: fs.existsSync(buildPath),
      indexExists: fs.existsSync(indexPath),
      buildContents: fs.existsSync(buildPath) ? fs.readdirSync(buildPath) : [],
      timestamp: new Date().toISOString()
    };
    
    res.json(fileStatus);
  } catch (error) {
    console.error('שגיאה בבדיקת קבצים:', error);
    res.status(500).json({ error: 'נכשל בבדיקת קבצים' });
  }
});

// Initialize server with proper MongoDB connection handling
const initializeServer = async () => {
  try {
    // Initialize MongoDB connection and wait for it to complete
    const USE_MONGODB = process.env.USE_MONGODB === 'true';
    let mongoConnection = null;
    
    if (USE_MONGODB) {
      mongoConnection = await connectDB();
    }

    // Choose which routes to use based on MongoDB connection
    if (USE_MONGODB && isConnected()) {
      console.log('📊 Using MongoDB for data storage');
      app.use('/api', mongoRoutes);
      // Add user authentication routes (only available with MongoDB)
      app.use('/api/auth', userAuthRoutes);
    } else {
      console.log('📁 Using file-based storage (JSON)');
      if (USE_MONGODB && !mongoConnection) {
        console.warn('⚠️  MongoDB requested but connection failed, using file storage');
      }
      app.use('/api', gateRoutes);
    }

    // Serve static files from React build (in both development and production)
    const buildPath = path.join(__dirname, '../public');
    const indexPath = path.join(buildPath, 'index.html');

    // Check if build files exist
    if (fs.existsSync(buildPath) && fs.existsSync(indexPath)) {
      app.use(express.static(buildPath));

      // Serve React app for any non-API routes
      app.get('*', (req, res) => {
        res.sendFile(indexPath);
      });
    } else {
      // Fallback for missing build files
      app.get('*', (req, res) => {
        res.status(404).json({ 
          error: 'אפליקציית React לא נבנתה. אנא בנה את הלקוח תחילה.',
          path: buildPath,
          exists: fs.existsSync(buildPath)
        });
      });
    }

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('מטפל שגיאות גלובלי:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        headers: req.headers,
        timestamp: new Date().toISOString()
      });
      
      // Don't expose internal error details in production
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ error: 'שגיאה בפעולה' });
      } else {
        res.status(500).json({ 
          error: 'שגיאה בפעולה',
          message: err.message,
          stack: err.stack
        });
      }
    });

    // Start the server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Storage: ${USE_MONGODB && isConnected() ? 'MongoDB' : 'File-based'}`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n⏹️  Shutting down server...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      console.log('\n⏹️  Shutting down server...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

    return server;
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    process.exit(1);
  }
};

// Start the server
initializeServer();