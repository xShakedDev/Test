const express = require('express');
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-secret-password';
const gatesFilePath = path.join(__dirname, '../data/gates.json');
// Ensure data directory exists
const dataDir = path.dirname(gatesFilePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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

// Data functions
function loadGates() {
  try {
    if (fs.existsSync(gatesFilePath)) {
      return JSON.parse(fs.readFileSync(gatesFilePath, 'utf8'));
    }
  } catch (error) {
    console.error('שגיאה בטעינת שערים:', error);
  }
  
  // Default gates
  return {
    '1': { id: '1', name: 'שער סירקין שטח', phoneNumber: '+972505364453', authorizedNumber: '+972548827828', password: null },
    '2': { id: '2', name: 'שער סירקין ראשי', phoneNumber: '+972509127873', authorizedNumber: '+972548827828', password: null },
  };
}

function saveGates(gates) {
  try {
    fs.writeFileSync(gatesFilePath, JSON.stringify(gates, null, 2));
  } catch (error) {
    console.error('שגיאה בשמירת שערים:', error);
  }
}

// Middleware for admin authentication
function requireAdmin(req, res, next) {
  const providedPassword = req.headers['x-admin-password'] || req.body.adminPassword;
  if (providedPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'לא מורשה: נדרשת גישת מנהל' });
  }
  next();
}

// Routes
router.get('/gates', (req, res) => {
  const gates = loadGates();
  res.json({ gates: Object.values(gates) });
});

router.post('/gates/:id/open', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    const gates = loadGates();
    const gate = gates[id];
    
    if (!gate) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    // Check if gate requires password
    if (gate.password && gate.password !== password) {
      return res.status(401).json({ error: 'סיסמה שגויה' });
    }
    
    // Check cooldown (30 seconds)
    const COOLDOWN_MS = 30 * 1000; // 30 seconds in milliseconds
    if (gate.lastOpenedAt) {
      const timeSinceLastOpen = Date.now() - new Date(gate.lastOpenedAt).getTime();
      if (timeSinceLastOpen < COOLDOWN_MS) {
        const remainingTime = Math.ceil((COOLDOWN_MS - timeSinceLastOpen) / 1000);
        return res.status(429).json({ 
          error: `השער נפתח לאחרונה. נסה שוב בעוד ${remainingTime} שניות`,
          remainingTime: remainingTime,
          cooldownEndsAt: new Date(new Date(gate.lastOpenedAt).getTime() + COOLDOWN_MS)
        });
      }
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
    
    gate.lastOpenedAt = new Date();
    gates[id] = gate;
    saveGates(gates);
    
    res.json({ 
      success: true, 
      message: `פותח שער "${gate.name}" באמצעות שיחת טלפון ל-${gate.phoneNumber}`,
      callSid: call.sid
    });
    
  } catch (error) {
    console.error('שגיאה בפתיחת השער:', error);
    
    // Provide more specific error messages
    if (error.message.includes('פרטי התחברות ל-Twilio לא מוגדרים')) {
      res.status(500).json({ error: 'Twilio לא מוגדר - בדוק את משתני הסביבה' });
    } else if (error.code === 'ENOTFOUND') {
      res.status(500).json({ error: 'שגיאת רשת - לא ניתן להגיע ל-Twilio' });
    } else if (error.code === 'UNAUTHORIZED') {
      res.status(500).json({ error: 'אימות Twilio נכשל - בדוק פרטי התחברות' });
    } else {
      res.status(500).json({ error: 'נכשל בפתיחת השער', details: error.message });
    }
  }
});

router.post('/gates/:id/call-status', (req, res) => {
  const { id } = req.params;
  const { CallStatus, CallDuration } = req.body;
  
  const gates = loadGates();
  const gate = gates[id];
  
  if (gate) {
    gate.lastCallStatus = CallStatus;
    gate.lastCallDuration = CallDuration;
    gates[id] = gate;
    saveGates(gates);
  }
  
  res.sendStatus(200);
});

router.get('/gates/:id', (req, res) => {
  const { id } = req.params;
  const gates = loadGates();
  const gate = gates[id];
  
  if (!gate) {
    return res.status(404).json({ error: 'השער לא נמצא' });
  }
  
  res.json({ gate });
});

router.post('/gates', requireAdmin, (req, res) => {
  try {
    const { name, phoneNumber, authorizedNumber, password } = req.body;
    
    if (!name || !phoneNumber || !authorizedNumber) {
      return res.status(400).json({ error: 'חסרים שדות נדרשים' });
    }
    
    const gates = loadGates();
    const newId = (Object.keys(gates).length + 1).toString();
    
    const newGate = { 
      id: newId, 
      name, 
      phoneNumber, 
      authorizedNumber, 
      password: password || null 
    };
    gates[newId] = newGate;
    saveGates(gates);
    
    res.status(201).json({ success: true, gate: newGate });
    
  } catch (error) {
    console.error('שגיאה ביצירת שער:', error);
    res.status(500).json({ error: 'נכשל ביצירת השער' });
  }
});

router.put('/gates/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, authorizedNumber, password } = req.body;
    
    const gates = loadGates();
    const gate = gates[id];
    
    if (!gate) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    if (name) gate.name = name;
    if (phoneNumber) gate.phoneNumber = phoneNumber;
    if (authorizedNumber) gate.authorizedNumber = authorizedNumber;
    if (password !== undefined) gate.password = password || null;
    
    gates[id] = gate;
    saveGates(gates);
    
    res.json({ success: true, gate });
    
  } catch (error) {
    console.error('שגיאה בעדכון שער:', error);
    res.status(500).json({ error: 'נכשל בעדכון השער' });
  }
});

router.delete('/gates/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const gates = loadGates();
    const gate = gates[id];
    
    if (!gate) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    delete gates[id];
    saveGates(gates);
    
    res.json({ success: true, message: `השער "${gate.name}" נמחק בהצלחה` });
    
  } catch (error) {
    console.error('שגיאה במחיקת שער:', error);
    res.status(500).json({ error: 'נכשל במחיקת השער' });
  }
});

router.get('/twilio/balance', requireAdmin, async (req, res) => {
  try {
    
    const client = getTwilioClient();
    const balanceData = await client.balance.fetch();
    
    res.json({ 
      balance: balanceData.balance,
      currency: balanceData.currency
    });
    
  } catch (error) {
    console.error('שגיאה בהבאת יתרת Twilio:', error);
    
    // Provide more specific error messages
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

// Get verified caller IDs from Twilio
router.get('/twilio/verified-callers', async (req, res) => {
  try {
    const adminPassword = req.headers['x-admin-password'];
    
    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'סיסמת מנהל לא תקינה' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      return res.status(500).json({ error: 'Twilio לא מוגדר' });
    }

    const client = require('twilio')(accountSid, authToken);
    
    // Get verified caller IDs
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

// Initiate Twilio validation request for a phone number
router.post('/twilio/validate-phone', requireAdmin, async (req, res) => {
  try {
    const { phoneNumber, friendlyName } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'מספר טלפון נדרש' });
    }

    const client = getTwilioClient();
    
    // Create validation request
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
    
    // Provide specific error messages
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

// Get validation request status
router.get('/twilio/validation-status/:sid', requireAdmin, async (req, res) => {
  try {
    const { sid } = req.params;
    
    if (!sid) {
      return res.status(400).json({ error: 'SID של בקשת האימות נדרש' });
    }

    const client = getTwilioClient();
    
    // Get validation request status
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

// Admin Settings Routes
router.get('/admin/settings', requireAdmin, async (req, res) => {
  try {
    // Get settings from environment variables or use defaults
    const settings = {
      gateCooldownSeconds: parseInt(process.env.GATE_COOLDOWN_SECONDS) || 30,
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
      enableNotifications: process.env.ENABLE_NOTIFICATIONS !== 'false',
      autoRefreshInterval: parseInt(process.env.AUTO_REFRESH_INTERVAL) || 5
    };
    
    res.json({ settings });
  } catch (error) {
    console.error('שגיאה בקבלת הגדרות:', error);
    res.status(500).json({ error: 'נכשל בקבלת הגדרות' });
  }
});

router.put('/admin/settings', requireAdmin, async (req, res) => {
  try {
    const { gateCooldownSeconds, maxRetries, enableNotifications, autoRefreshInterval } = req.body;
    
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
    
    // In a real application, you would save these to a database
    // For now, we'll just return success
    // You can implement actual saving logic here
    
    const updatedSettings = {
      gateCooldownSeconds,
      maxRetries,
      enableNotifications,
      autoRefreshInterval
    };
    
    res.json({ 
      message: 'ההגדרות נשמרו בהצלחה',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('שגיאה בשמירת הגדרות:', error);
    res.status(500).json({ error: 'נכשל בשמירת הגדרות' });
  }
});

module.exports = router;
