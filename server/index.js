const express = require('express');
const cors = require('cors');
// Using built-in body parsers from Express
const path = require('path');
const fs = require('fs');

// Load environment variables from .env
require('dotenv').config({ path: '.env' });

// MongoDB integration
const { connectDB, isConnected, getConnectionStatus } = require('./config/database');

// Routes - MongoDB-based only
const mongoRoutes = require('./routes/auth-mongo');
const { router: userAuthRoutes } = require('./routes/auth-users');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Admin authentication handled via JWT in auth-users

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
        type: 'MongoDB',
        useMongoDB: true,
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
    // Force MongoDB usage - no more file-based fallback
    let mongoConnection = null;
    
    // Initialize MongoDB connection and wait for it to complete
    mongoConnection = await connectDB();
    
    if (!isConnected()) {
      console.error('MongoDB connection failed. Server cannot start without database.');
      process.exit(1);
    }

    console.log('Using MongoDB for data storage');
    app.use('/api', mongoRoutes);
    // Add user authentication routes (only available with MongoDB)
    app.use('/api/auth', userAuthRoutes);

    // Serve static files from React build (in both development and production)
    const buildPath = path.join(__dirname, '../public');
    const indexPath = path.join(buildPath, 'index.html');

    // Check if build files exist
    if (fs.existsSync(buildPath) && fs.existsSync(indexPath)) {
      // Set no-cache headers for service worker and manifest to force updates
      app.use((req, res, next) => {
        if (req.path === '/service-worker.js' || req.path === '/manifest.json') {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
        next();
      });

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
      console.log(`Server running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Storage: MongoDB`);
      
      // Check JWT_SECRET configuration
      if (process.env.NODE_ENV === 'production') {
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-jwt-key-change-in-production') {
          console.error('');
          console.error('═══════════════════════════════════════════════════════════');
          console.error('⚠️  CRITICAL: JWT_SECRET not properly configured!');
          console.error('⚠️  Users will be logged out on every deployment!');
          console.error('⚠️  Set JWT_SECRET in Google Cloud Run environment variables.');
          console.error('═══════════════════════════════════════════════════════════');
          console.error('');
        } else {
          console.log(`   JWT_SECRET: ✓ Configured`);
        }
      }
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down server...');
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      console.log('\nShutting down server...');
      server.close(() => {
        process.exit(0);
      });
    });

    return server;
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

// Start the server
initializeServer();