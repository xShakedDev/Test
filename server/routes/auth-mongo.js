const express = require('express');
const twilio = require('twilio');
const Gate = require('../models/Gate');
const GateHistory = require('../models/GateHistory');
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
      gates = await Gate.find({ 
        _id: { $in: req.user.authorizedGates }, 
        isActive: true 
      }).sort({ createdAt: -1 });
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

router.post('/gates/:id/open', requireMongoDB, authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    const gate = await Gate.findById(id);
    
    if (!gate || !gate.isActive) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    // Check if user has permission to open this gate
    if (req.user.role !== 'admin' && !req.user.canAccessGate(id)) {
      return res.status(403).json({ error: 'אין הרשאה לפתוח שער זה' });
    }
    
    // Check if gate requires password
    if (gate.password && gate.password !== password) {
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
      gateId: gate._id,
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
        gateId: req.params.id,
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
    
    const gate = await Gate.findById(id);
    
    if (gate) {
      await gate.updateCallStatus(CallStatus, CallDuration);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('שגיאה בעדכון סטטוס שיחה:', error);
    res.sendStatus(200); // Still return 200 to Twilio to avoid retries
  }
});

router.get('/gates/:id', requireMongoDB, authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const gate = await Gate.findById(id);
    
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
    
    const newGate = new Gate({
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
    
    const gate = await Gate.findById(id);
    
    if (!gate || !gate.isActive) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    // Check if changing phone number conflicts with existing gate
    if (phoneNumber && phoneNumber !== gate.phoneNumber) {
      const existingGate = await Gate.findOne({ 
        phoneNumber, 
        isActive: true,
        _id: { $ne: id }
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
    const gate = await Gate.findById(id);
    
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

// Gate history endpoint (admin only)
router.get('/gates/history', requireMongoDB, authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 100, gateId, userId } = req.query;
    const limitNum = Math.min(parseInt(limit), 500); // Max 500 records
    
    let history;
    if (gateId) {
      history = await GateHistory.findByGate(gateId, limitNum);
    } else if (userId) {
      history = await GateHistory.findByUser(userId, limitNum);
    } else {
      history = await GateHistory.findAllHistory(limitNum);
    }
    
    res.json({ 
      history,
      count: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('שגיאה בטעינת היסטוריית שערים:', error);
    res.status(500).json({ error: 'נכשל בטעינת היסטוריית השערים' });
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
router.get('/twilio/balance', (req, res, next) => {
  console.log('🔍 Twilio balance request received:', {
    url: req.url,
    method: req.method,
    headers: {
      authorization: req.headers.authorization ? 'Bearer ***' : 'None',
      'content-type': req.headers['content-type']
    },
    timestamp: new Date().toISOString()
  });
  next();
}, authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('Twilio balance request from user:', {
      userId: req.user._id,
      username: req.user.username,
      role: req.user.role,
      isAdmin: req.user.role === 'admin'
    });
    
    const client = getTwilioClient();
    const balanceData = await client.balance.fetch();
    
    console.log('Twilio balance fetched successfully:', {
      balance: balanceData.balance,
      currency: balanceData.currency
    });
    
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

module.exports = router;
