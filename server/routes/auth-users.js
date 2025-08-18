const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Gate = require('../models/Gate');

const router = express.Router();

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-jwt-key-change-in-production';

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user._id, 
      username: user.username, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
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
    
    // Get user from database to ensure they still exist and are active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'משתמש לא תקף' });
    }

    // Add user info to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'סשן פג תוקף' });
    }
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

// Login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'נדרש שם משתמש וסיסמה' });
    }

    // Find user
    const user = await User.findOne({ username, isActive: true }).populate('authorizedGates');
    
    if (!user) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate JWT token
    const token = generateToken(user);
    
    res.json({
      message: 'התחברות הצליחה',
      token,
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
router.post('/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  // JWT logout is client-side, no server-side session to invalidate here
  // For simplicity, we'll just return a success message
  res.json({ message: 'התנתקות הצליחה' });
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

    // Check if username already exists
    const existingUser = await User.findOne({ username });
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

    res.status(201).json({
      message: 'משתמש נוצר בהצלחה',
      user: userObj
    });

  } catch (error) {
    console.error('Create user error:', error);
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

    // Check if new username already exists (if changing username)
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username: username.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ error: 'שם המשתמש כבר קיים' });
      }
      user.username = username.toLowerCase();
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

    res.json({
      message: 'משתמש עודכן בהצלחה',
      user: userObj
    });

  } catch (error) {
    console.error('Update user error:', error);
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

    await User.findByIdAndDelete(userId);

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

    res.json({ message: 'סיסמה שונתה בהצלחה' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'שגיאה בשינוי סיסמה' });
  }
});

module.exports = { router, authenticateToken, requireAdmin };
