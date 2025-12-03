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
    
    // Debug middleware to log all API requests
    app.use('/api', (req, res, next) => {
      console.log(`[API Request] ${req.method} ${req.path}`, {
        query: req.query,
        params: req.params,
        bodyKeys: Object.keys(req.body || {}),
        url: req.url,
        originalUrl: req.originalUrl
      });
      // Special logging for call-status routes
      if (req.path.includes('call-status')) {
        console.log(`[CALL-STATUS] Request detected: ${req.method} ${req.path}`);
      }
      next();
    });
    
    app.use('/api', mongoRoutes);
    // Add user authentication routes (only available with MongoDB)
    app.use('/api/auth', userAuthRoutes);

    // Serve static files from React build (in both development and production)
    // BUT exclude API routes - they should be handled by API middleware above
    const buildPath = path.join(__dirname, '../public');
    const indexPath = path.join(buildPath, 'index.html');

    // Check if build files exist
    if (fs.existsSync(buildPath) && fs.existsSync(indexPath)) {
      // Only serve static files for non-API routes
      app.use((req, res, next) => {
        // Skip static file serving for API routes
        if (req.path.startsWith('/api/')) {
          return next();
        }
        // Serve static files for all other routes
        express.static(buildPath)(req, res, next);
      });

      // Serve React app for any non-API GET routes
      app.get('*', (req, res) => {
        // Don't serve React app for API routes
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ error: 'נקודת קצה לא נמצאה' });
        }
        res.sendFile(indexPath);
      });
    } else {
      // Fallback for missing build files
      app.get('*', (req, res) => {
        // Don't serve fallback for API routes
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ error: 'נקודת קצה לא נמצאה' });
        }
        res.status(404).json({ 
          error: 'אפליקציית React לא נבנתה. אנא בנה את הלקוח תחילה.',
          path: buildPath,
          exists: fs.existsSync(buildPath)
        });
      });
    }

    // Handle 404 for API routes - only catch requests that weren't handled by any route
    // This must be after all routes are defined but before error handler
    app.use('/api/*', (req, res, next) => {
      // Only respond if no response has been sent yet
      if (!res.headersSent) {
        res.status(404).json({ error: 'נקודת קצה לא נמצאה' });
      } else {
        next();
      }
    });

    // Error handling middleware - must be last
    app.use((err, req, res, next) => {
      console.error('מטפל שגיאות גלובלי:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
      });
      
      // Ensure response hasn't been sent already
      if (res.headersSent) {
        return next(err);
      }
      
      // Always return valid JSON
      const statusCode = err.statusCode || err.status || 500;
      const errorResponse = {
        error: 'שגיאה בפעולה',
        timestamp: new Date().toISOString()
      };
      
      // Don't expose internal error details in production
      if (process.env.NODE_ENV !== 'production') {
        errorResponse.message = err.message;
        errorResponse.stack = err.stack;
      }
      
      res.status(statusCode).json(errorResponse);
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