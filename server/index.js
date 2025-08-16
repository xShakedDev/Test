 const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env for temporary testing
require('dotenv').config({ path: '.env' });

// Debug: Log environment variables loading
console.log('🔧 טוען משתני סביבה מ-.env...');
console.log('📁 תיקיית עבודה נוכחית:', process.cwd());
console.log('📄 נתיב קובץ .env:', path.resolve('.env'));
console.log('📄 קובץ .env קיים:', fs.existsSync('.env'));
console.log('🔑 TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✅ נטען' : '❌ לא נטען');
console.log('🔑 TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '✅ נטען' : '❌ לא נטען');
console.log('🔑 ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? '✅ נטען' : '❌ לא נטען');
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('');

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

// Debug endpoint to show file paths
app.get('/api/debug', (req, res) => {
  try {
    const possiblePaths = [
      path.join(__dirname, '../public'),
      path.join(__dirname, '../client/build'),
      path.join(__dirname, './public'),
      path.join(__dirname, './client/build')
    ];
    
    const pathStatus = possiblePaths.map(p => ({
      path: p,
      exists: fs.existsSync(p),
      contents: fs.existsSync(p) ? fs.readdirSync(p) : []
    }));
    
    res.json({
      currentDir: __dirname,
      possiblePaths: pathStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('שגיאה בנקודת קצה בידוד:', error);
    res.status(500).json({ error: 'נכשל בבדיקת נתיבים' });
  }
});

// API Routes
app.use('/api', gateRoutes);

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
  
  console.log('נמצאו קבצי React build והם יוגשו');
} else {
  console.warn('לא נמצאו קבצי React build. ודא שהרצת "npm run build" בתיקיית הלקוח');
  
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

const server = app.listen(PORT, () => {
  console.log(`השרת פועל על פורט ${PORT}`);
  console.log(`סביבה: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nקיבלתי SIGINT. סוגר בצורה מסודרת...');
  
  server.close(() => {
    console.log('השרת נסגר. להתראות!');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nקיבלתי SIGTERM. סוגר בצורה מסודרת...');
  
  server.close(() => {
    console.log('השרת נסגר. להתראות!');
    process.exit(0);
  });
});