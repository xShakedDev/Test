const express = require('express');
const twilio = require('twilio');
const mongoose = require('mongoose');
const Gate = require('../models/Gate');
const GateHistory = require('../models/GateHistory');
const AdminSettings = require('../models/AdminSettings');
const { isConnected } = require('../config/database');
const { authenticateToken, requireAdmin } = require('./auth-users');
const router = express.Router();

// Configuration (admin authentication now handled by user system)

// Twilio client
let twilioClient = null;
function getTwilioClient() {
  try {
    if (!twilioClient) {
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        console.error('חסרים פרטי התחברות ל-Twilio:', {
          hasSid: !!process.env.TWILIO_ACCOUNT_SID,
          hasToken: !!process.env.TWILIO_AUTH_TOKEN
        });
        throw new Error('פרטי התחברות ל-Twilio לא מוגדרים');
      }
      twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    return twilioClient;
  } catch (error) {
    console.error('שגיאה באתחול לקוח Twilio:', error);
    throw error;
  }
}

// Middleware to check MongoDB connection
const requireMongoDB = (req, res, next) => {
  if (!isConnected()) {
    return res.status(503).json({ 
      error: 'שירות הנתונים לא זמין',
      details: 'MongoDB לא מחובר'
    });
  }
  next();
};

// Admin authentication middleware is imported from auth-users.js

// Routes
router.get('/gates', requireMongoDB, authenticateToken, async (req, res) => {
  try {
    let gates;
    
    // Admin sees all gates, regular users see only their authorized gates
    if (req.user.role === 'admin') {
      gates = await Gate.findActive().sort({ createdAt: -1 });
    } else {
      console.log('User authorized gates:', req.user.authorizedGates);
      console.log('User role:', req.user.role);
      gates = await Gate.find({ 
        id: { $in: req.user.authorizedGates }, 
        isActive: true 
      }).sort({ createdAt: -1 });
      console.log('Found gates for user:', gates.length);
    }
    
    res.json({ 
      gates: gates.map(gate => gate.toJSON()),
      count: gates.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('שגיאה בטעינת שערים:', error);
    res.status(500).json({ error: 'נכשל בטעינת השערים' });
  }
});

// Gate opening endpoint
router.post('/gates/:id/open', requireMongoDB, authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    // Get current admin settings
    const adminSettings = await AdminSettings.getCurrentSettings();
    
    // Check if system is in maintenance mode
    if (adminSettings.systemMaintenance) {
      return res.status(503).json({ 
        error: 'המערכת בתחזוקה', 
        message: adminSettings.maintenanceMessage || 'המערכת בתחזוקה כרגע'
      });
    }
    
    const gate = await Gate.findOne({ id: parseInt(id) });
    
    if (!gate || !gate.isActive) {
        // Log failed gate opening attempt - gate not found
      try {
        await new GateHistory({
          userId: req.user._id,
          gateId: isNaN(parseInt(id, 10)) ? -1 : parseInt(id, 10),
          username: req.user.username,
          gateName: 'Unknown',
          success: false,
          errorMessage: 'השער לא נמצא או לא פעיל'
        }).save();
      } catch (logError) {
        console.error('שגיאה ברישום היסטוריית כישלון:', logError);
      }
      
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    // Check if user has permission to open this gate
    if (req.user.role !== 'admin' && !req.user.canAccessGate(id)) {
      // Log failed gate opening attempt - no permission
      try {
        await new GateHistory({
          userId: req.user._id,
          gateId: gate.id,
          username: req.user.username,
          gateName: gate.name,
          success: false,
          errorMessage: 'אין הרשאה לפתוח שער זה'
        }).save();
      } catch (logError) {
        console.error('שגיאה ברישום היסטוריית כישלון:', logError);
      }
      
      return res.status(403).json({ error: 'אין הרשאה לפתוח שער זה' });
    }
    
    // Check cooldown for this gate
    const now = new Date();
    const cooldownMs = adminSettings.gateCooldownSeconds * 1000;
    
    if (gate.lastOpened && (now - gate.lastOpened) < cooldownMs) {
      const remainingTime = Math.ceil((cooldownMs - (now - gate.lastOpened)) / 1000);
      
      // Log failed attempt due to cooldown
      try {
        await new GateHistory({
          userId: req.user._id,
          gateId: gate.id,
          username: req.user.username,
          gateName: gate.name,
          success: false,
          errorMessage: `דילאי פעיל - נסה שוב בעוד ${remainingTime} שניות`
        }).save();
      } catch (logError) {
        console.error('שגיאה ברישום היסטוריית כישלון:', logError);
      }
      
      return res.status(429).json({ 
        error: 'דילאי פעיל', 
        message: `נסה שוב בעוד ${remainingTime} שניות`,
        remainingTime
      });
    }
    
    // Check retry limit for this user and gate
    const recentAttempts = await GateHistory.find({
      userId: req.user._id,
      gateId: gate.id,
      timestamp: { $gte: new Date(now - 24 * 60 * 60 * 1000) } // Last 24 hours
    });
    
    const failedAttempts = recentAttempts.filter(attempt => !attempt.success).length;
    
    if (failedAttempts >= adminSettings.maxRetries) {
      // Log failed attempt due to retry limit
      try {
        await new GateHistory({
          userId: req.user._id,
          gateId: gate.id,
          username: req.user.username,
          gateName: gate.name,
          success: false,
          errorMessage: `חריגה ממספר הניסיונות המותר (${adminSettings.maxRetries})`
        }).save();
      } catch (logError) {
        console.error('שגיאה ברישום היסטוריית כישלון:', logError);
      }
      
      return res.status(429).json({ 
        error: 'חריגה ממספר הניסיונות', 
        message: `חריגה ממספר הניסיונות המותר (${adminSettings.maxRetries}). נסה שוב מחר.`
      });
    }
    
    // Check if gate requires password
    if (gate.password && gate.password !== password) {
      // Log failed gate opening attempt due to wrong password
      try {
        await new GateHistory({
          userId: req.user._id,
          gateId: gate.id,
          username: req.user.username,
          gateName: gate.name,
          success: false,
          errorMessage: 'סיסמה שגויה'
        }).save();
      } catch (logError) {
        console.error('שגיאה ברישום היסטוריית כישלון:', logError);
      }
      
      return res.status(401).json({ error: 'סיסמה שגויה' });
    }
    
    const client = getTwilioClient();
    const call = await client.calls.create({
      url: 'http://demo.twilio.com/docs/voice.xml',
      to: gate.phoneNumber,
      from: gate.authorizedNumber,
      statusCallback: `${req.protocol}://${req.get('host')}/api/gates/${id}/call-status`,
      statusCallbackEvent: ['completed'],
      statusCallbackMethod: 'POST'
    });
    
    // Update gate with last opened time
    await gate.markAsOpened();
    
    // Log successful gate opening
    await new GateHistory({
      userId: req.user._id,
      gateId: gate.id,
      username: req.user.username,
      gateName: gate.name,
      success: true,
      callSid: call.sid
    }).save();
    
    res.json({ 
      success: true, 
      message: `פותח שער "${gate.name}" באמצעות שיחת טלפון ל-${gate.phoneNumber}`,
      callSid: call.sid,
      gate: gate.toJSON()
    });
    
  } catch (error) {
    console.error('שגיאה בפתיחת השער:', error);
    
    // Log failed gate opening attempt
    try {
      await new GateHistory({
        userId: req.user._id,
        gateId: isNaN(parseInt(req.params.id, 10)) ? -1 : parseInt(req.params.id, 10),
        username: req.user.username,
        gateName: gate?.name || 'Unknown',
        success: false,
        errorMessage: error.message
      }).save();
    } catch (logError) {
      console.error('שגיאה ברישום היסטוריית כישלון:', logError);
    }
    
    // Provide more specific error messages
    if (error.message.includes('פרטי התחברות ל-Twilio לא מוגדרים')) {
      res.status(500).json({ error: 'Twilio לא מוגדר - בדוק את משתני הסביבה' });
    } else if (error.code === 'ENOTFOUND') {
      res.status(500).json({ error: 'שגיאת רשת - לא ניתן להגיע ל-Twilio' });
    } else if (error.code === 'UNAUTHORIZED') {
      res.status(500).json({ error: 'אימות Twilio נכשל - בדוק פרטי התחברות' });
    } else if (error.name === 'CastError') {
      res.status(400).json({ error: 'מזהה השער לא תקין' });
    } else {
      res.status(500).json({ error: 'נכשל בפתיחת השער', details: error.message });
    }
  }
});

router.post('/gates/:id/call-status', requireMongoDB, async (req, res) => {
  try {
    const { id } = req.params;
    const { CallStatus, CallDuration } = req.body;
    
    const gate = await Gate.findOne({ id: parseInt(id) });
    
    if (gate) {
      await gate.updateCallStatus(CallStatus, CallDuration);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('שגיאה בעדכון סטטוס שיחה:', error);
    res.sendStatus(200); // Still return 200 to Twilio to avoid retries
  }
});

// Gate history endpoint (admin only) - MUST be before /gates/:id route
router.get('/gates/history', requireMongoDB, authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 100, gateId, gateName, userId, username } = req.query;
    const limitNum = Math.min(parseInt(limit), 500); // Max 500 records
    
    let history;
    if (gateName) {
      history = await GateHistory.find({ gateName })
        .sort({ timestamp: -1 })
        .limit(limitNum)
        .populate('userId', 'username name');
    } else if (gateId) {
      const numericGateId = parseInt(gateId, 10);
      if (!isNaN(numericGateId)) {
        history = await GateHistory.findByGate(numericGateId, limitNum);
      } else {
        // Backward compatibility: treat non-numeric gateId as gateName
        history = await GateHistory.find({ gateName: gateId })
          .sort({ timestamp: -1 })
          .limit(limitNum)
          .populate('userId', 'username name');
      }
    } else if (username) {
      // Filter by username
      history = await GateHistory.find({ username })
        .sort({ timestamp: -1 })
        .limit(limitNum)
        .populate('userId', 'username name');
    } else if (userId) {
      // Check if userId is a valid ObjectId or if it's actually a username
      if (mongoose.Types.ObjectId.isValid(userId)) {
        history = await GateHistory.findByUser(userId, limitNum);
      } else {
        // If userId is not a valid ObjectId, treat it as username
        history = await GateHistory.find({ username: userId })
          .sort({ timestamp: -1 })
          .limit(limitNum)
          .populate('userId', 'username name');
      }
    } else {
      history = await GateHistory.findAllHistory(limitNum);
    }
    
    res.json({ 
      history: history.map(record => record.toJSON()),
      count: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('שגיאה בטעינת היסטוריית שערים:', error);
    res.status(500).json({ error: 'נכשל בטעינת היסטוריית השערים' });
  }
});

// Bulk delete history records (admin only)
router.delete('/gates/history/bulk-delete', requireMongoDB, authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { logIds } = req.body;
    
    console.log('Bulk delete request received:', { logIds, count: logIds?.length });
    
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({ error: 'רשימת מזההי רשומות נדרשת' });
    }
    
    // Process IDs - GateHistory only has _id field, so we expect ObjectId strings
    const processedIds = logIds.map(id => {
      if (mongoose.Types.ObjectId.isValid(id)) {
        return id; // Keep as ObjectId string
      } else {
        console.warn('Invalid ObjectId format:', id);
        return null; // Invalid ID
      }
    }).filter(id => id !== null); // Remove invalid IDs
    
    console.log('Processed IDs:', { 
      original: logIds, 
      processed: processedIds,
      validCount: processedIds.length,
      invalidCount: logIds.length - processedIds.length
    });
    
    if (processedIds.length === 0) {
      return res.status(400).json({ error: 'לא נמצאו מזההי רשומות תקינים' });
    }
    
    // Query by _id only since GateHistory only has _id field
    const query = { _id: { $in: processedIds } };
    
    console.log('Delete query:', JSON.stringify(query, null, 2));
    
    const result = await GateHistory.deleteMany(query);
    
    console.log('Delete result:', result);
    
    res.json({ 
      success: true, 
      message: `${result.deletedCount} רשומות נמחקו בהצלחה`,
      deletedCount: result.deletedCount,
      requestedCount: logIds.length,
      processedCount: processedIds.length,
      invalidCount: logIds.length - processedIds.length
    });
  } catch (error) {
    console.error('שגיאה במחיקת רשומות היסטוריה:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ error: 'נכשל במחיקת רשומות ההיסטוריה' });
  }
});

// Delete all history records (admin only)
router.delete('/gates/history/delete-all', requireMongoDB, authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await GateHistory.deleteMany({});
    
    res.json({ 
      success: true, 
      message: 'כל ההיסטוריה נמחקה בהצלחה',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('שגיאה במחיקת כל ההיסטוריה:', error);
    res.status(500).json({ error: 'נכשל במחיקת כל ההיסטוריה' });
  }
});

router.get('/gates/:id', requireMongoDB, authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const gate = await Gate.findOne({ id: parseInt(id) });
    
    if (!gate || !gate.isActive) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    // Check if user has permission to view this gate
    if (req.user.role !== 'admin' && !req.user.canAccessGate(id)) {
      return res.status(403).json({ error: 'אין הרשאה לצפות בשער זה' });
    }
    
    res.json({ gate: gate.toJSON() });
  } catch (error) {
    console.error('שגיאה בטעינת שער:', error);
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'מזהה השער לא תקין' });
    } else {
      res.status(500).json({ error: 'נכשל בטעינת השער' });
    }
  }
});

router.post('/gates', requireMongoDB, authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, phoneNumber, authorizedNumber, password } = req.body;
    
    if (!name || !phoneNumber || !authorizedNumber) {
      return res.status(400).json({ error: 'חסרים שדות נדרשים: name, phoneNumber, authorizedNumber' });
    }
    
    // Check if gate with same phone number already exists
    const existingGate = await Gate.findOne({ phoneNumber, isActive: true });
    if (existingGate) {
      return res.status(409).json({ error: 'שער עם מספר טלפון זה כבר קיים' });
    }
    
    // Get the next available numeric ID
    const nextId = await Gate.getNextId();
    
    const newGate = new Gate({
      id: nextId,
      name,
      phoneNumber,
      authorizedNumber,
      password: password || null
    });
    
    const savedGate = await newGate.save();
    
    res.status(201).json({ 
      success: true, 
      gate: savedGate.toJSON(),
      message: `שער "${name}" נוצר בהצלחה`
    });
    
  } catch (error) {
    console.error('שגיאה ביצירת שער:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      res.status(400).json({ error: 'נתונים לא תקינים', details: messages });
    } else {
      res.status(500).json({ error: 'נכשל ביצירת השער' });
    }
  }
});

router.put('/gates/:id', requireMongoDB, authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, authorizedNumber, password } = req.body;
    
    const gate = await Gate.findOne({ id: parseInt(id) });
    
    if (!gate || !gate.isActive) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    // Check if changing phone number conflicts with existing gate
    if (phoneNumber && phoneNumber !== gate.phoneNumber) {
      const existingGate = await Gate.findOne({ 
        phoneNumber, 
        isActive: true,
        id: { $ne: parseInt(id) }
      });
      if (existingGate) {
        return res.status(409).json({ error: 'שער אחר עם מספר טלפון זה כבר קיים' });
    }
    }
    
    // Update fields
    if (name) gate.name = name;
    if (phoneNumber) gate.phoneNumber = phoneNumber;
    if (authorizedNumber) gate.authorizedNumber = authorizedNumber;
    if (password !== undefined) gate.password = password || null;
    
    const updatedGate = await gate.save();
    
    res.json({ 
      success: true, 
      gate: updatedGate.toJSON(),
      message: `שער "${updatedGate.name}" עודכן בהצלחה`
    });
    
  } catch (error) {
    console.error('שגיאה בעדכון שער:', error);
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'מזהה השער לא תקין' });
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      res.status(400).json({ error: 'נתונים לא תקינים', details: messages });
    } else {
      res.status(500).json({ error: 'נכשל בעדכון השער' });
    }
  }
});

router.delete('/gates/:id', requireMongoDB, authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const gate = await Gate.findOne({ id: parseInt(id) });
    
    if (!gate || !gate.isActive) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    // Soft delete - mark as inactive instead of removing
    gate.isActive = false;
    await gate.save();
    
    res.json({ 
      success: true, 
      message: `השער "${gate.name}" נמחק בהצלחה`,
      gate: gate.toJSON()
    });
    
  } catch (error) {
    console.error('שגיאה במחיקת שער:', error);
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'מזהה השער לא תקין' });
    } else {
      res.status(500).json({ error: 'נכשל במחיקת השער' });
    }
  }
});



// Database status endpoint
router.get('/database/status', async (req, res) => {
  try {
    const { getConnectionStatus } = require('../config/database');
    const status = getConnectionStatus();
    const gateCount = isConnected() ? await Gate.countDocuments({ isActive: true }) : 0;
    
    res.json({
      database: status,
      connected: isConnected(),
      gateCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('שגיאה בבדיקת סטטוס מסד הנתונים:', error);
    res.status(500).json({ error: 'נכשל בבדיקת סטטוס מסד הנתונים' });
  }
});

// Existing Twilio routes remain the same
router.get('/twilio/balance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const client = getTwilioClient();
    const balanceData = await client.balance.fetch();
    
    res.json({ 
      balance: balanceData.balance,
      currency: balanceData.currency
    });
    
  } catch (error) {
    console.error('שגיאה בהבאת יתרת Twilio:', error);
    
    if (error.message.includes('פרטי התחברות ל-Twilio לא מוגדרים')) {
      res.status(500).json({ error: 'Twilio לא מוגדר - בדוק את משתני הסביבה' });
    } else if (error.code === 'ENOTFOUND') {
      res.status(500).json({ error: 'שגיאת רשת - לא ניתן להגיע ל-Twilio' });
    } else if (error.code === 'UNAUTHORIZED') {
      res.status(500).json({ error: 'אימות Twilio נכשל - בדוק פרטי התחברות' });
    } else {
      res.status(500).json({ error: 'נכשל בהבאת יתרת Twilio', details: error.message });
    }
  }
});

router.get('/twilio/verified-callers', authenticateToken, requireAdmin, async (req, res) => {
  try {

    const client = getTwilioClient();
    const verifiedCallers = await client.outgoingCallerIds.list();
    
    const callerIds = verifiedCallers.map(caller => ({
      id: caller.sid,
      phoneNumber: caller.phoneNumber,
      friendlyName: caller.friendlyName || caller.phoneNumber
    }));

    res.json({ callerIds });
  } catch (error) {
    console.error('Error fetching verified caller IDs:', error);
    res.status(500).json({ error: 'שגיאה בקבלת מספרי טלפון מורשים' });
  }
});

router.post('/twilio/validate-phone', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { phoneNumber, friendlyName } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'מספר טלפון נדרש' });
    }

    const client = getTwilioClient();
    const validationRequest = await client.validationRequests.create({
      friendlyName: friendlyName || phoneNumber,
      phoneNumber: phoneNumber
    });
    
    res.json({ 
      success: true, 
      message: `בקשת אימות נשלחה ל-${phoneNumber}`,
      validationSid: validationRequest.sid,
      phoneNumber: phoneNumber,
      status: validationRequest.status,
      validationCode: validationRequest.validationCode
    });
    
  } catch (error) {
    console.error('שגיאה ביצירת בקשת אימות:', error);
    
    if (error.message.includes('פרטי התחברות ל-Twilio לא מוגדרים')) {
      res.status(500).json({ error: 'Twilio לא מוגדר - בדוק את משתני הסביבה' });
    } else if (error.code === 'ENOTFOUND') {
      res.status(500).json({ error: 'שגיאת רשת - לא ניתן להגיע ל-Twilio' });
    } else if (error.code === 'UNAUTHORIZED') {
      res.status(500).json({ error: 'אימות Twilio נכשל - בדוק פרטי התחברות' });
    } else if (error.code === 60200) {
      res.status(400).json({ error: 'מספר טלפון לא תקין' });
    } else {
      res.status(500).json({ error: 'נכשל ביצירת בקשת אימות', details: error.message });
    }
  }
});

router.get('/twilio/validation-status/:sid', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { sid } = req.params;
    
    if (!sid) {
      return res.status(400).json({ error: 'SID של בקשת האימות נדרש' });
    }

    const client = getTwilioClient();
    const validationRequest = await client.validationRequests(sid).fetch();
    
    res.json({ 
      success: true,
      validationSid: validationRequest.sid,
      phoneNumber: validationRequest.phoneNumber,
      friendlyName: validationRequest.friendlyName,
      status: validationRequest.status,
      callSid: validationRequest.callSid,
      codeLength: validationRequest.codeLength
    });
    
  } catch (error) {
    console.error('שגיאה בבדיקת סטטוס בקשת אימות:', error);
    
    if (error.code === 20404) {
      res.status(404).json({ error: 'בקשת האימות לא נמצאה' });
    } else {
      res.status(500).json({ error: 'נכשל בבדיקת סטטוס בקשת האימות', details: error.message });
    }
  }
});

// Public route to get current settings (for other parts of the app)
router.get('/settings/current', async (req, res) => {
  try {
    const settings = await AdminSettings.getCurrentSettings();
    
    res.json({ 
      settings: settings.toJSON(),
      lastUpdated: settings.lastUpdated
    });
  } catch (error) {
    console.error('שגיאה בקבלת הגדרות נוכחיות:', error);
    res.status(500).json({ error: 'נכשל בקבלת הגדרות' });
  }
});

// Public route to check maintenance status
router.get('/settings/maintenance', async (req, res) => {
  try {
    const maintenanceStatus = await AdminSettings.isSystemInMaintenance();
    
    res.json(maintenanceStatus);
  } catch (error) {
    console.error('שגיאה בבדיקת מצב תחזוקה:', error);
    res.status(500).json({ error: 'נכשל בבדיקת מצב תחזוקה' });
  }
});

// Admin Settings Routes
router.get('/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await AdminSettings.getCurrentSettings();
    
    res.json({ 
      settings: settings.toJSON(),
      lastUpdated: settings.lastUpdated,
      updatedBy: settings.updatedBy
    });
  } catch (error) {
    console.error('שגיאה בקבלת הגדרות:', error);
    res.status(500).json({ error: 'נכשל בקבלת הגדרות' });
  }
});

router.put('/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { gateCooldownSeconds, maxRetries, enableNotifications, autoRefreshInterval, systemMaintenance, maintenanceMessage } = req.body;
    
    // Validate input
    if (gateCooldownSeconds < 10 || gateCooldownSeconds > 300) {
      return res.status(400).json({ error: 'זמן דילאי חייב להיות בין 10 ל-300 שניות' });
    }
    
    if (maxRetries < 1 || maxRetries > 10) {
      return res.status(400).json({ error: 'מספר ניסיונות חייב להיות בין 1 ל-10' });
    }
    
    if (autoRefreshInterval < 1 || autoRefreshInterval > 60) {
      return res.status(400).json({ error: 'מרווח רענון חייב להיות בין 1 ל-60 דקות' });
    }
    
    // Update settings in MongoDB
    const updatedSettings = await AdminSettings.updateSettings({
      gateCooldownSeconds,
      maxRetries,
      enableNotifications,
      autoRefreshInterval,
      systemMaintenance: systemMaintenance || false,
      maintenanceMessage: maintenanceMessage || 'המערכת בתחזוקה'
    }, req.user._id);
    
    res.json({ 
      message: 'ההגדרות נשמרו בהצלחה',
      settings: updatedSettings.toJSON(),
      lastUpdated: updatedSettings.lastUpdated
    });
  } catch (error) {
    console.error('שגיאה בשמירת הגדרות:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      res.status(400).json({ error: 'נתונים לא תקינים', details: messages });
    } else {
      res.status(500).json({ error: 'נכשל בשמירת הגדרות' });
    }
  }
});

module.exports = router;
