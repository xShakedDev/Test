const express = require('express');
const twilio = require('twilio');
const router = express.Router();

// Import database models
const Gate = require('../models/Gate');

// Configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-secret-password';

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
router.get('/gates', async (req, res) => {
  try {
    const gates = await Gate.findAll({
      where: { isActive: true },
      order: [['id', 'ASC']]
    });
    res.json({ gates });
  } catch (error) {
    console.error('שגיאה בטעינת שערים:', error);
    res.status(500).json({ error: 'נכשל בטעינת השערים' });
  }
});

router.post('/gates/:id/open', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`מנסה לפתוח שער ${id}`);
    
    const gate = await Gate.findByPk(id);
    
    if (!gate) {
      console.log(`שער ${id} לא נמצא`);
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    if (!gate.isActive) {
      console.log(`שער ${id} לא פעיל`);
      return res.status(400).json({ error: 'השער לא פעיל' });
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
    
    // Update gate with last opened time
    await gate.update({
      lastOpenedAt: new Date()
    });
    
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

router.post('/gates/:id/call-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { CallStatus, CallDuration } = req.body;
    
    const gate = await Gate.findByPk(id);
    
    if (gate) {
      await gate.update({
        lastCallStatus: CallStatus,
        lastCallDuration: CallDuration
      });
      console.log(`שיחה לשער "${gate.name}" הושלמה: ${CallStatus}`);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('שגיאה בעדכון סטטוס שיחה:', error);
    res.sendStatus(500);
  }
});

router.get('/gates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const gate = await Gate.findByPk(id);
    
    if (!gate) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    res.json({ gate });
  } catch (error) {
    console.error('שגיאה בטעינת שער:', error);
    res.status(500).json({ error: 'נכשל בטעינת השער' });
  }
});

router.post('/gates', requireAdmin, async (req, res) => {
  try {
    const { name, phoneNumber, authorizedNumber } = req.body;
    
    if (!name || !phoneNumber || !authorizedNumber) {
      return res.status(400).json({ error: 'חסרים שדות נדרשים' });
    }
    
    const newGate = await Gate.create({
      name,
      phoneNumber,
      authorizedNumber,
      isActive: true
    });
    
    console.log(`שער חדש נוצר: "${name}"`);
    res.status(201).json({ success: true, gate: newGate });
    
  } catch (error) {
    console.error('שגיאה ביצירת שער:', error);
    res.status(500).json({ error: 'נכשל ביצירת השער' });
  }
});

router.put('/gates/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, authorizedNumber, isActive } = req.body;
    
    const gate = await Gate.findByPk(id);
    
    if (!gate) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (authorizedNumber !== undefined) updateData.authorizedNumber = authorizedNumber;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    await gate.update(updateData);
    
    console.log(`שער עודכן: "${gate.name}"`);
    res.json({ success: true, gate });
    
  } catch (error) {
    console.error('שגיאה בעדכון שער:', error);
    res.status(500).json({ error: 'נכשל בעדכון השער' });
  }
});

router.delete('/gates/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const gate = await Gate.findByPk(id);
    
    if (!gate) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }
    
    // Soft delete - mark as inactive instead of actually deleting
    await gate.update({ isActive: false });
    
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

module.exports = router;
