const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const gateRoutes = require('./routes/auth');

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
    res.status(401).json({ error: 'Unauthorized: Admin access required' });
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// System status endpoint
app.get('/api/status', (req, res) => {
  try {
    const buildPath = path.join(__dirname, '../client/build');
    const indexPath = path.join(buildPath, 'index.html');
    
    const status = {
      server: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      files: {
        buildPath,
        indexPath,
        buildExists: fs.existsSync(buildPath),
        indexExists: fs.existsSync(indexPath)
      },
      twilio: {
        hasSid: !!process.env.TWILIO_ACCOUNT_SID,
        hasToken: !!process.env.TWILIO_AUTH_TOKEN,
        hasPhone: !!process.env.TWILIO_PHONE_NUMBER
      },
      admin: {
        hasPassword: !!process.env.ADMIN_PASSWORD
      }
    };
    
    res.json(status);
  } catch (error) {
    console.error('Error in status endpoint:', error);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

// File status endpoint
app.get('/api/files', (req, res) => {
  try {
    const buildPath = path.join(__dirname, '../client/build');
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
    console.error('Error checking files:', error);
    res.status(500).json({ error: 'Failed to check files' });
  }
});

// API Routes
app.use('/api', gateRoutes);

// Serve static files from React build (only in production)
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/build');
  const indexPath = path.join(buildPath, 'index.html');
  
  // Check if build files exist
  if (fs.existsSync(buildPath) && fs.existsSync(indexPath)) {
    app.use(express.static(buildPath));

    // Serve React app for any non-API routes
    app.get('*', (req, res) => {
      res.sendFile(indexPath);
    });
    
    console.log('React build files found and will be served');
  } else {
    console.warn('React build files not found. Make sure to run "npm run build" in the client directory');
    
    // Fallback for missing build files
    app.get('*', (req, res) => {
      res.status(404).json({ 
        error: 'React app not built. Please build the client first.',
        path: buildPath,
        exists: fs.existsSync(buildPath)
      });
    });
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', {
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
    res.status(500).json({ error: 'Something went wrong!' });
  } else {
    res.status(500).json({ 
      error: 'Something went wrong!',
      message: err.message,
      stack: err.stack
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Shutting down gracefully...');
  
  server.close(() => {
    console.log('Server closed. Goodbye!');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Shutting down gracefully...');
  
  server.close(() => {
    console.log('Server closed. Goodbye!');
    process.exit(0);
  });
});
