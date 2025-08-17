const express = require('express');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Gate = require('../models/Gate');

const router = express.Router();

// File-based session storage to persist across server restarts
const sessionsFilePath = path.join(__dirname, '../data/sessions.json');

// Ensure data directory exists
const dataDir = path.dirname(sessionsFilePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load sessions from file
const loadSessions = () => {
  try {
    if (fs.existsSync(sessionsFilePath)) {
      const data = fs.readFileSync(sessionsFilePath, 'utf8');
      const sessions = JSON.parse(data);
      // Filter out expired sessions
      const now = Date.now();
      const validSessions = {};
      let expiredCount = 0;
      
      for (const [token, sessionData] of Object.entries(sessions)) {
        if (now - sessionData.createdAt <= 24 * 60 * 60 * 1000) {
          validSessions[token] = sessionData;
        } else {
          expiredCount++;
        }
      }
      
      console.log(`Loaded ${Object.keys(validSessions).length} valid sessions, cleaned up ${expiredCount} expired sessions`);
      return validSessions;
    }
  } catch (error) {
    console.error('Error loading sessions:', error);
  }
  return {};
};

// Save sessions to file
const saveSessions = (sessions) => {
  try {
    fs.writeFileSync(sessionsFilePath, JSON.stringify(sessions, null, 2));
    console.log(`Saved ${Object.keys(sessions).length} sessions to file`);
  } catch (error) {
    console.error('Error saving sessions:', error);
  }
};

// Initialize sessions from file
let activeSessions = loadSessions();

// Clean up expired sessions periodically (every hour)
setInterval(() => {
  const now = Date.now();
  let hasChanges = false;
  
  for (const [token, sessionData] of Object.entries(activeSessions)) {
    if (now - sessionData.createdAt > 24 * 60 * 60 * 1000) {
      delete activeSessions[token];
      hasChanges = true;
    }
  }
  
  if (hasChanges) {
    saveSessions(activeSessions);
  }
}, 60 * 60 * 1000); // Check every hour

// Generate simple session token
const generateSessionToken = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Middleware to verify session token
const authenticateToken = async (req, res, next) => {
  console.log('🔐 authenticateToken middleware called:', {
    url: req.url,
    method: req.method,
    hasAuthHeader: !!req.headers['authorization'],
    authHeaderType: req.headers['authorization'] ? req.headers['authorization'].split(' ')[0] : 'None'
  });
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({ error: 'נדרש טוקן גישה' });
  }

  try {
    console.log('🔍 Checking token:', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 10) + '...',
      activeSessionsCount: Object.keys(activeSessions).length
    });
    
    const sessionData = activeSessions[token];
    
    if (!sessionData) {
      console.log(`❌ Session not found for token: ${token.substring(0, 10)}...`);
      return res.status(401).json({ error: 'סשן לא תקף או פג תוקף' });
    }

    // Check if session is expired (24 hours)
    if (Date.now() - sessionData.createdAt > 24 * 60 * 60 * 1000) {
      console.log(`Session expired for user: ${sessionData.username}`);
      delete activeSessions[token];
      saveSessions(activeSessions);
      return res.status(401).json({ error: 'סשן פג תוקף' });
    }

    console.log('🔍 Looking up user:', {
      userId: sessionData.userId,
      username: sessionData.username,
      role: sessionData.role
    });
    
    const user = await User.findById(sessionData.userId).populate('authorizedGates');
    
    if (!user || !user.isActive) {
      console.log(`❌ User not found or inactive: ${sessionData.username}`);
      delete activeSessions[token];
      saveSessions(activeSessions);
      return res.status(401).json({ error: 'משתמש לא תקף' });
    }

    console.log(`✅ Authenticated user: ${user.username} (${user.role})`);
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ error: 'שגיאה באימות' });
  }
};

// Middleware to verify admin role
const requireAdmin = (req, res, next) => {
  console.log('requireAdmin middleware check:', {
    userId: req.user._id,
    username: req.user.username,
    role: req.user.role,
    isAdmin: req.user.role === 'admin'
  });
  
  if (req.user.role !== 'admin') {
    console.log('Access denied - user is not admin');
    return res.status(403).json({ error: 'נדרשת הרשאת מנהל' });
  }
  
  console.log('Access granted - user is admin');
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
    const token = generateSessionToken();
    
    // Store session data
    activeSessions[token] = {
      userId: user._id,
      username: user.username,
      role: user.role,
      createdAt: Date.now()
    };
    saveSessions(activeSessions);
    
    console.log(`User logged in: ${user.username} (${user.role}) - Session created`);

    res.json({
      message: 'התחברות הצליחה',
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        authorizedGates: user.authorizedGates ? user.authorizedGates.map(gate => 
          typeof gate === 'object' && gate._id ? gate._id.toString() : gate.toString()
        ) : []
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
        authorizedGates: req.user.authorizedGates ? req.user.authorizedGates.map(gate => 
          typeof gate === 'object' && gate._id ? gate._id.toString() : gate.toString()
        ) : []
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
  
  if (token && activeSessions[token]) {
    delete activeSessions[token];
    saveSessions(activeSessions);
  }
  
  res.json({ message: 'התנתקות הצליחה' });
});

// Admin Routes - User Management

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).populate('authorizedGates').sort({ createdAt: -1 });
    
    // Convert users to plain objects and ensure consistent ID handling
    const usersWithStringIds = users.map(user => {
      const userObj = user.toJSON();
      // Convert authorizedGates ObjectIds to strings
      if (userObj.authorizedGates) {
        userObj.authorizedGates = userObj.authorizedGates.map(gate => 
          typeof gate === 'object' && gate._id ? gate._id.toString() : gate.toString()
        );
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

    // Validate authorized gates exist
    if (authorizedGates.length > 0) {
      const validGates = await Gate.find({ _id: { $in: authorizedGates } });
      if (validGates.length !== authorizedGates.length) {
        return res.status(400).json({ error: 'אחד או יותר מהשערים שנבחרו לא קיימים' });
      }
    }

    const newUser = new User({
      username: username.trim().toLowerCase(),
      password,
      name: name.trim(),
      role,
      authorizedGates
    });

    await newUser.save();
    await newUser.populate('authorizedGates');

    // Convert to plain object and ensure consistent ID handling
    const userObj = newUser.toJSON();
    if (userObj.authorizedGates) {
      userObj.authorizedGates = userObj.authorizedGates.map(gate => 
        typeof gate === 'object' && gate._id ? gate._id.toString() : gate.toString()
      );
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
      // Validate gates exist
      if (authorizedGates.length > 0) {
        const validGates = await Gate.find({ _id: { $in: authorizedGates } });
        if (validGates.length !== authorizedGates.length) {
          return res.status(400).json({ error: 'אחד או יותר מהשערים שנבחרו לא קיימים' });
        }
      }
      user.authorizedGates = authorizedGates;
    }

    await user.save();
    await user.populate('authorizedGates');

    // Convert to plain object and ensure consistent ID handling
    const userObj = user.toJSON();
    if (userObj.authorizedGates) {
      userObj.authorizedGates = userObj.authorizedGates.map(gate => 
        typeof gate === 'object' && gate._id ? gate._id.toString() : gate.toString()
      );
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
