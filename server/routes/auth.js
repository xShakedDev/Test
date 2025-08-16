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
      console.log('לקוח Twilio אותחל בהצלחה');
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
    '1': { id: '1', name: 'שער ראשי', phoneNumber: '+1234567890', authorizedNumber: '+972542070400' },
    '2': { id: '2', name: 'שער צדדי', phoneNumber: '+0987654321', authorizedNumber: '+972542070400' },
    '3': { id: '3', name: 'שער אחורי', phoneNumber: '+1122334455', authorizedNumber: '+972501234567' }
  };
}

function saveGates(gates) {
  try {
    fs.writeFileSync(gatesFilePath, JSON.stringify(gates, null, 2));
    console.log('השערים נשמרו בהצלחה');
  } catch (error) {
    console.error('שגיאה בשמירת שערים:', error);
  }
}

// Middleware for admin authentication
function requireAdmin(req, res, next) {
  const providedPassword = req.headers['x-admin-password'] || req.body.adminPassword;
  if (providedPassword !== ADMIN_PASSWORD) {
    console.log(ADMIN_PASSWORD)
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
    console.log(`מנסה לפתוח שער ${id}`);
    
    const gates = loadGates();
    const gate = gates[id];
    
    if (!gate) {
      console.log(`שער ${id} לא נמצא`);
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    console.log(`פותח שער: ${gate.name} (${gate.phoneNumber})`);
    
    const client = getTwilioClient();
    const call = await client.calls.create({
      url: 'http://demo.twilio.com/docs/voice.xml',
      to: gate.phoneNumber,
      from: gate.authorizedNumber,
      statusCallback: `${req.protocol}://${req.get('host')}/api/gates/${id}/call-status`,
      statusCallbackEvent: ['completed'],
      statusCallbackMethod: 'POST'
    });
    
    console.log(`שיחת Twilio החלה: ${call.sid}`);
    
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
    console.log(`שיחה לשער "${gate.name}" הושלמה: ${CallStatus}`);
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
    const { name, phoneNumber, authorizedNumber } = req.body;
    
    if (!name || !phoneNumber || !authorizedNumber) {
      return res.status(400).json({ error: 'חסרים שדות נדרשים' });
    }
    
    const gates = loadGates();
    const newId = (Object.keys(gates).length + 1).toString();
    
    const newGate = { id: newId, name, phoneNumber, authorizedNumber };
    gates[newId] = newGate;
    saveGates(gates);
    
    console.log(`שער חדש נוצר: "${name}"`);
    res.status(201).json({ success: true, gate: newGate });
    
  } catch (error) {
    console.error('שגיאה ביצירת שער:', error);
    res.status(500).json({ error: 'נכשל ביצירת השער' });
  }
});

router.put('/gates/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, authorizedNumber } = req.body;
    
    const gates = loadGates();
    const gate = gates[id];
    
    if (!gate) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    if (name) gate.name = name;
    if (phoneNumber) gate.phoneNumber = phoneNumber;
    if (authorizedNumber) gate.authorizedNumber = authorizedNumber;
    
    gates[id] = gate;
    saveGates(gates);
    
    console.log(`שער עודכן: "${gate.name}"`);
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
    
    console.log(`שער נמחק: "${gate.name}"`);
    res.json({ success: true, message: `השער "${gate.name}" נמחק בהצלחה` });
    
  } catch (error) {
    console.error('שגיאה במחיקת שער:', error);
    res.status(500).json({ error: 'נכשל במחיקת השער' });
  }
});

router.get('/twilio/balance', requireAdmin, async (req, res) => {
  try {
    console.log('מביא יתרת Twilio...');
    
    const client = getTwilioClient();
    const balanceData = await client.balance.fetch();
    
    console.log(`יתרת Twilio הובאה: ${balanceData.balance} ${balanceData.currency}`);
    
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

module.exports = router;
