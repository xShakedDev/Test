const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Gate = require('../models/Gate');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// Helper function to create audit log
// Can accept either req (with req.user) or user object directly with optional req for IP/userAgent
const createAuditLog = async (reqOrUser, action, resourceType, resourceId = null, resourceName = null, details = null, success = true, errorMessage = null, reqForMetadata = null) => {
  try {
    let userId, username, ipAddress, userAgent;
    const req = reqForMetadata || reqOrUser;
    
    // Check if first parameter is a user object (for login) or req object
    if (reqOrUser && reqOrUser._id && reqOrUser.username && !reqOrUser.user) {
      // It's a user object (direct user - for login route)
      userId = reqOrUser._id;
      username = reqOrUser.username;
      ipAddress = req ? (req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || null) : null;
      userAgent = req ? (req.get('user-agent') || null) : null;
    } else if (reqOrUser && reqOrUser.user) {
      // It's a req object with req.user
      if (!reqOrUser.user._id || !reqOrUser.user.username) {
        console.warn('Audit log skipped: invalid user data', { 
          action, 
          resourceType,
          hasUserId: !!reqOrUser.user._id,
          hasUsername: !!reqOrUser.user.username
        });
        return;
      }
      userId = reqOrUser.user._id;
      username = reqOrUser.user.username;
      ipAddress = reqOrUser.ip || reqOrUser.connection?.remoteAddress || reqOrUser.socket?.remoteAddress || null;
      userAgent = reqOrUser.get('user-agent') || null;
    } else {
      console.warn('Audit log skipped: no user in request', { action, resourceType });
      return;
    }
    
    const logData = {
      userId,
      username,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      resourceName,
      details: details ? String(details) : null,
      ipAddress,
      userAgent,
      success,
      errorMessage: errorMessage ? String(errorMessage) : null
    };
    
    const savedLog = await AuditLog.createLog(logData);
    if (!savedLog) {
      console.warn('Audit log creation returned null', { action, resourceType });
    }
  } catch (error) {
    console.error('Error creating audit log:', error);
    console.error('Error stack:', error.stack);
    // Don't throw - audit logging should not break the main flow
  }
};

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-jwt-key-change-in-production';

// Warn if using default JWT_SECRET in production
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'your-secret-jwt-key-change-in-production') {
  console.error('⚠️  WARNING: Using default JWT_SECRET in production!');
  console.error('⚠️  This will cause all users to be logged out on each deployment.');
  console.error('⚠️  Please set JWT_SECRET environment variable in Google Cloud Service.');
  console.error('⚠️  Go to: Cloud Run > Your Service > Variables & Secrets > Add Variable');
}

// Warn if JWT_SECRET is not set
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET not set in environment variables!');
  console.warn('⚠️  Using default secret. This will cause authentication issues.');
  console.warn('⚠️  Set JWT_SECRET in Google Cloud Service environment variables.');
}

// Token expiration times
const ACCESS_TOKEN_EXPIRY = '1h'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '7d'; // Long-lived refresh token

// Generate JWT token
const generateToken = (user, expiry = ACCESS_TOKEN_EXPIRY) => {
  return jwt.sign(
    { 
      userId: user._id, 
      username: user.username, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: expiry }
  );
};

// Generate both access and refresh tokens
const generateTokenPair = (user) => {
  const accessToken = generateToken(user, ACCESS_TOKEN_EXPIRY);
  const refreshToken = generateToken(user, REFRESH_TOKEN_EXPIRY);
  
  return { accessToken, refreshToken };
};

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'נדרש טוקן גישה' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if MongoDB is connected
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'מסד הנתונים לא זמין. אנא נסה שוב מאוחר יותר.' });
    }
    
    // Get user from database to ensure they still exist and are active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'משתמש לא תקף' });
    }

    // Add user info to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'סשן פג תוקף' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'טוקן לא תקף' });
    }
    // Ensure we always return valid JSON
    return res.status(401).json({ error: 'שגיאה באימות' });
  }
};

// Middleware to require admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'נדרשת הרשאת מנהל' });
  }
  next();
};

// Initialize admin user route (only if no users exist)
router.post('/init-admin', async (req, res) => {
  try {
    // Check if MongoDB is connected
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'מסד הנתונים לא זמין. אנא נסה שוב מאוחר יותר.' });
    }

    // Check if any users exist
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return res.status(400).json({ error: 'משתמשים כבר קיימים במערכת. השתמש ב-login רגיל.' });
    }

    const { username, password, name } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ error: 'נדרש שם משתמש, סיסמה ושם מלא' });
    }

    // Create admin user
    const adminUser = new User({
      username: username.toLowerCase().trim(),
      password,
      name: name.trim(),
      role: 'admin',
      authorizedGates: [],
      isActive: true
    });

    await adminUser.save();

    // Enable auto-open for all gates with location by default
    const allGates = await Gate.find({ 
      'location.latitude': { $exists: true, $ne: null },
      'location.longitude': { $exists: true, $ne: null }
    });
    
    if (allGates.length > 0) {
      allGates.forEach(gate => {
        const gateId = String(gate._id || gate.id);
        adminUser.autoOpenSettings.set(gateId, true);
        // Set default radius to 50 meters if not set
        if (!adminUser.autoOpenRadius.has(gateId)) {
          adminUser.autoOpenRadius.set(gateId, gate.location?.autoOpenRadius || 50);
        }
      });
      await adminUser.save();
    }

    console.log(`Initial admin user created: ${adminUser.username}`);

    // Generate token pair
    const tokens = generateTokenPair(adminUser);

    res.status(201).json({
      message: 'משתמש מנהל ראשוני נוצר בהצלחה',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: adminUser._id,
        username: adminUser.username,
        name: adminUser.name,
        role: adminUser.role,
        authorizedGates: []
      }
    });

  } catch (error) {
    console.error('Init admin error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'שם המשתמש כבר קיים' });
    }
    res.status(500).json({ error: 'שגיאה ביצירת משתמש מנהל' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'נדרש שם משתמש וסיסמה' });
    }

    // Check if MongoDB is connected
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected during login attempt');
      return res.status(503).json({ error: 'מסד הנתונים לא זמין. אנא נסה שוב מאוחר יותר.' });
    }

    // Find user - normalize username to lowercase for case-insensitive search
    const normalizedUsername = username.toLowerCase().trim();
    const user = await User.findOne({ username: normalizedUsername, isActive: true });
    
    if (!user) {
      console.log(`Login attempt failed: User '${normalizedUsername}' not found or inactive`);
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    
    if (!isValidPassword) {
      console.log(`Login attempt failed: Invalid password for user '${normalizedUsername}'`);
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token pair
    const tokens = generateTokenPair(user);
    
    console.log(`Login successful for user: ${normalizedUsername} (${user.role})`);
    
    // Create audit log for login - pass user directly and req for IP/userAgent
    await createAuditLog(
      user,
      'login',
      'auth',
      user._id.toString(),
      user.username,
      `User logged in: ${user.name} (${user.username})`,
      true,
      null,
      req
    );
    
    res.json({
      message: 'התחברות הצליחה',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        authorizedGates: user.authorizedGates && user.authorizedGates.length > 0 ? user.authorizedGates.map(gateId => ({
          id: gateId,
          name: `שער ${gateId}`
        })) : []
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    
    // Check if it's a MongoDB connection error
    if (error.name === 'MongoServerError' || error.message.includes('MongoDB')) {
      return res.status(503).json({ error: 'מסד הנתונים לא זמין. אנא נסה שוב מאוחר יותר.' });
    }
    
    res.status(500).json({ error: 'שגיאה בהתחברות' });
  }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        name: req.user.name,
        role: req.user.role,
        authorizedGates: req.user.authorizedGates && req.user.authorizedGates.length > 0 ? req.user.authorizedGates.map(gateId => ({
          id: gateId,
          name: `שער ${gateId}`
        })) : []
      }
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ error: 'שגיאה בקבלת מידע משתמש' });
  }
});

// Logout route
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    // Try to decode token to get user info for audit log
    let user = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        user = await User.findById(decoded.userId);
      } catch (error) {
        // Token invalid or expired - that's okay for logout
        console.log('Logout with invalid/expired token');
      }
    }
    
    // Create audit log for logout if we have user info
    if (user) {
      await createAuditLog(
        user,
        'logout',
        'auth',
        user._id.toString(),
        user.username,
        `User logged out: ${user.name} (${user.username})`,
        true,
        null,
        req
      );
    }
    
    // JWT logout is client-side, no server-side session to invalidate here
    // For simplicity, we'll just return a success message
    res.json({ message: 'התנתקות הצליחה' });
  } catch (error) {
    console.error('Logout error:', error);
    // Still return success even if audit log fails
    res.json({ message: 'התנתקות הצליחה' });
  }
});

// Refresh token route
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'נדרש טוקן רענון' });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    // Get user from database to ensure they still exist and are active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'משתמש לא תקף' });
    }
    
    // Generate new token pair
    const newTokens = generateTokenPair(user);
    
    res.json({
      message: 'טוקן חודש בהצלחה',
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken
    });
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'סשן פג תוקף' });
    }
    return res.status(401).json({ error: 'שגיאה באימות' });
  }
});

// Admin Routes - User Management

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    
    // Get all gates to map IDs to names
    const allGates = await Gate.find({ isActive: true });
    const gateMap = {};
    allGates.forEach(gate => {
      gateMap[gate.id] = gate.name;
    });
    
    // Convert users to plain objects and ensure consistent ID handling
    const usersWithStringIds = users.map(user => {
      const userObj = user.toJSON();
      
      // Handle authorizedGates - show both ID and real name for better display
      if (userObj.authorizedGates && userObj.authorizedGates.length > 0) {
        userObj.authorizedGates = userObj.authorizedGates.map(gateId => ({
          id: gateId,
          name: gateMap[gateId] || `שער ${gateId}`
        }));
      } else {
        userObj.authorizedGates = [];
      }
      
      return userObj;
    });
    
    res.json(usersWithStringIds);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'שגיאה בקבלת רשימת משתמשים' });
  }
});

// Create new user (admin only)
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, name, role = 'user', authorizedGates = [] } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ error: 'נדרש שם משתמש וסיסמה ושם מלא' });
    }

    // Normalize username to lowercase for case-insensitive storage
    const normalizedUsername = username.toLowerCase().trim();
    
    // Check if username already exists (case-insensitive)
    const existingUser = await User.findOne({ username: normalizedUsername });
    if (existingUser) {
      return res.status(400).json({ error: 'שם המשתמש כבר קיים' });
    }

    // Clean and validate authorized gates - handle both object format {id, name} and direct IDs
    let cleanAuthorizedGates = [];
    if (authorizedGates.length > 0) {
      cleanAuthorizedGates = authorizedGates.map(gateId => {
        if (typeof gateId === 'object') {
          // Handle {id, name} format from client
          if (gateId.id) {
            return parseInt(gateId.id);
          }
        }
        // Handle direct string/ID
        return parseInt(gateId);
      });
      
      // Validate gates exist
      const validGates = await Gate.find({ id: { $in: cleanAuthorizedGates } });
      if (validGates.length !== cleanAuthorizedGates.length) {
        return res.status(400).json({ error: 'אחד או יותר מהשערים שנבחרו לא קיימים' });
      }
    }

    const newUser = new User({
      username: username.trim().toLowerCase(),
      password,
      name: name.trim(),
      role,
      authorizedGates: cleanAuthorizedGates
    });

    await newUser.save();

    // Enable auto-open for all gates with location by default
    const allGates = await Gate.find({ 
      'location.latitude': { $exists: true, $ne: null },
      'location.longitude': { $exists: true, $ne: null }
    });
    
    if (allGates.length > 0) {
      allGates.forEach(gate => {
        const gateId = String(gate._id || gate.id);
        newUser.autoOpenSettings.set(gateId, true);
        // Set default radius to 50 meters if not set
        if (!newUser.autoOpenRadius.has(gateId)) {
          newUser.autoOpenRadius.set(gateId, gate.location?.autoOpenRadius || 50);
        }
      });
      await newUser.save();
    }

    // Convert to plain object and ensure consistent ID handling
    const userObj = newUser.toJSON();
    if (userObj.authorizedGates && userObj.authorizedGates.length > 0) {
      // Get gate names for the response
      const userGates = await Gate.find({ id: { $in: userObj.authorizedGates } });
      const gateMap = {};
      userGates.forEach(gate => {
        gateMap[gate.id] = gate.name;
      });
      
      userObj.authorizedGates = userObj.authorizedGates.map(gateId => ({
        id: gateId,
        name: gateMap[gateId] || `שער ${gateId}`
      }));
    } else {
      userObj.authorizedGates = [];
    }

    // Create audit log
    await createAuditLog(
      req,
      'user_created',
      'user',
      newUser._id.toString(),
      newUser.username,
      `Created user: ${newUser.name} (${newUser.username}) with role: ${newUser.role}`,
      true
    );

    res.status(201).json({
      message: 'משתמש נוצר בהצלחה',
      user: userObj
    });

  } catch (error) {
    console.error('Create user error:', error);
    
    // Log failed attempt
    await createAuditLog(
      req,
      'user_created',
      'user',
      null,
      req.body.username,
      `Failed to create user: ${req.body.username}`,
      false,
      error.message
    );
    
    res.status(500).json({ error: 'שגיאה ביצירת משתמש' });
  }
});

// Update user (admin only)
router.put('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, name, role, authorizedGates, isActive } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    // Check if new username already exists (if changing username) - case-insensitive
    if (username) {
      const normalizedUsername = username.toLowerCase().trim();
      if (normalizedUsername !== user.username.toLowerCase()) {
        const existingUser = await User.findOne({ username: normalizedUsername });
        if (existingUser) {
          return res.status(400).json({ error: 'שם המשתמש כבר קיים' });
        }
        user.username = normalizedUsername;
      }
    }

    // Update fields
    if (name) user.name = name.trim();
    if (role) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    
    // Update authorized gates
    if (Array.isArray(authorizedGates)) {
      // Clean and validate gate IDs - handle both object format {id, name} and direct IDs
      const cleanGateIds = authorizedGates.map(gateId => {
        if (typeof gateId === 'object') {
          // Handle {id, name} format from client
          if (gateId.id) {
            return parseInt(gateId.id);
          }
        }
        // Handle direct string/ID
        return parseInt(gateId);
      });
      
      // Validate gates exist
      if (cleanGateIds.length > 0) {
        const validGates = await Gate.find({ id: { $in: cleanGateIds } });
        if (validGates.length !== cleanGateIds.length) {
          return res.status(400).json({ error: 'אחד או יותר מהשערים שנבחרו לא קיימים' });
        }
      }
      user.authorizedGates = cleanGateIds;
    }

    await user.save();

    // Convert to plain object and ensure consistent ID handling
    const userObj = user.toJSON();
    if (userObj.authorizedGates && userObj.authorizedGates.length > 0) {
      // Get gate names for the response
      const userGates = await Gate.find({ id: { $in: userObj.authorizedGates } });
      const gateMap = {};
      userGates.forEach(gate => {
        gateMap[gate.id] = gate.name;
      });
      
      userObj.authorizedGates = userObj.authorizedGates.map(gateId => ({
        id: gateId,
        name: gateMap[gateId] || `שער ${gateId}`
      }));
    } else {
      userObj.authorizedGates = [];
    }

    // Create audit log
    const changes = [];
    if (username && username !== user.username) changes.push(`username: ${user.username} → ${username}`);
    if (name && name !== user.name) changes.push(`name: ${user.name} → ${name}`);
    if (role && role !== user.role) changes.push(`role: ${user.role} → ${role}`);
    if (typeof isActive === 'boolean' && isActive !== user.isActive) {
      changes.push(`isActive: ${user.isActive} → ${isActive}`);
      await createAuditLog(
        req,
        isActive ? 'user_activated' : 'user_deactivated',
        'user',
        user._id.toString(),
        user.username,
        `${isActive ? 'Activated' : 'Deactivated'} user: ${user.name} (${user.username})`,
        true
      );
    }
    
    if (changes.length > 0) {
      await createAuditLog(
        req,
        'user_updated',
        'user',
        user._id.toString(),
        user.username,
        `Updated user: ${user.name} (${user.username}) - ${changes.join(', ')}`,
        true
      );
    }

    res.json({
      message: 'משתמש עודכן בהצלחה',
      user: userObj
    });

  } catch (error) {
    console.error('Update user error:', error);
    
    // Log failed attempt
    await createAuditLog(
      req,
      'user_updated',
      'user',
      req.params.userId,
      null,
      `Failed to update user`,
      false,
      error.message
    );
    
    res.status(500).json({ error: 'שגיאה בעדכון משתמש' });
  }
});

// Delete user (admin only)
router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent admin from deleting themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ error: 'לא ניתן למחוק את המשתמש שלך' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    const deletedUsername = user.username;
    const deletedName = user.name;
    
    await User.findByIdAndDelete(userId);

    // Create audit log
    await createAuditLog(
      req,
      'user_deleted',
      'user',
      userId,
      deletedUsername,
      `Deleted user: ${deletedName} (${deletedUsername})`,
      true
    );

    res.json({ message: 'משתמש נמחק בהצלחה' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת משתמש' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'נדרשת סיסמה נוכחית וסיסמה חדשה' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'סיסמה חדשה חייבת להכיל לפחות 4 תווים' });
    }

    // Verify current password
    const isValidPassword = await req.user.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'סיסמה נוכחית שגויה' });
    }

    // Update password
    req.user.password = newPassword;
    await req.user.save();

    // Create audit log
    await createAuditLog(
      req,
      'password_changed',
      'auth',
      req.user._id.toString(),
      req.user.username,
      'User changed password',
      true
    );

    res.json({ message: 'סיסמה שונתה בהצלחה' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'שגיאה בשינוי סיסמה' });
  }
});

// Get user auto-open settings
router.get('/user/auto-open-settings', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    // Convert Maps to plain objects for JSON response
    const autoOpenSettings = {};
    if (user.autoOpenSettings instanceof Map) {
      user.autoOpenSettings.forEach((value, key) => {
        autoOpenSettings[key] = value;
      });
    } else if (user.autoOpenSettings) {
      Object.assign(autoOpenSettings, user.autoOpenSettings);
    }

    const autoOpenRadius = {};
    if (user.autoOpenRadius instanceof Map) {
      user.autoOpenRadius.forEach((value, key) => {
        autoOpenRadius[key] = value;
      });
    } else if (user.autoOpenRadius) {
      Object.assign(autoOpenRadius, user.autoOpenRadius);
    }

    res.json({
      autoOpenSettings,
      autoOpenRadius
    });
  } catch (error) {
    console.error('Get auto-open settings error:', error);
    res.status(500).json({ error: 'שגיאה בקבלת הגדרות פתיחה אוטומטית' });
  }
});

// Update user auto-open settings
router.put('/user/auto-open-settings', authenticateToken, async (req, res) => {
  try {
    const { autoOpenSettings, autoOpenRadius } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    // Update autoOpenSettings
    if (autoOpenSettings !== undefined) {
      if (!user.autoOpenSettings) {
        user.autoOpenSettings = new Map();
      }
      Object.keys(autoOpenSettings).forEach(gateId => {
        user.autoOpenSettings.set(String(gateId), !!autoOpenSettings[gateId]);
      });
    }

    // Update autoOpenRadius
    if (autoOpenRadius !== undefined) {
      if (!user.autoOpenRadius) {
        user.autoOpenRadius = new Map();
      }
      Object.keys(autoOpenRadius).forEach(gateId => {
        const radius = parseInt(autoOpenRadius[gateId]);
        if (!isNaN(radius) && radius >= 0 && radius <= 1000) {
          user.autoOpenRadius.set(String(gateId), radius);
        }
      });
    }

    await user.save();

    // Convert Maps to plain objects for response
    const responseAutoOpenSettings = {};
    if (user.autoOpenSettings instanceof Map) {
      user.autoOpenSettings.forEach((value, key) => {
        responseAutoOpenSettings[key] = value;
      });
    }

    const responseAutoOpenRadius = {};
    if (user.autoOpenRadius instanceof Map) {
      user.autoOpenRadius.forEach((value, key) => {
        responseAutoOpenRadius[key] = value;
      });
    }

    res.json({
      success: true,
      autoOpenSettings: responseAutoOpenSettings,
      autoOpenRadius: responseAutoOpenRadius,
      message: 'הגדרות פתיחה אוטומטית עודכנו בהצלחה'
    });
  } catch (error) {
    console.error('Update auto-open settings error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון הגדרות פתיחה אוטומטית' });
  }
});

module.exports = { router, authenticateToken, requireAdmin };
