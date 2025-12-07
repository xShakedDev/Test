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
      gates = await Gate.findActive().sort({ order: 1, createdAt: -1 });
    } else {
      gates = await Gate.find({
        id: { $in: req.user.authorizedGates },
        isActive: true
      }).sort({ order: 1, createdAt: -1 });
    }

    // Apply personal order preferences for all users (including admins)
    if (req.user.gateOrderPreferences) {
      // Convert Mongoose Map to plain object if needed
      const userPreferences = req.user.gateOrderPreferences instanceof Map
        ? req.user.gateOrderPreferences
        : new Map(Object.entries(req.user.gateOrderPreferences || {}));

      if (userPreferences.size > 0) {
        gates.sort((a, b) => {
          const orderA = userPreferences.get(String(a.id)) ?? userPreferences.get(a.id) ?? a.order ?? 999;
          const orderB = userPreferences.get(String(b.id)) ?? userPreferences.get(b.id) ?? b.order ?? 999;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          // If same order, sort by createdAt
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      }
    }

    res.json({
      gates: gates.map(gate => gate.toJSON()),
      count: gates.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('שגיאה בטעינת שערים:', error);
    console.error('Error stack:', error.stack);
    // Ensure we always return valid JSON
    res.status(500).json({ 
      error: 'נכשל בטעינת השערים',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Gate opening endpoint
router.post('/gates/:id/open', requireMongoDB, authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { password, autoOpened } = req.body;

    // Get current admin settings
    const adminSettings = await AdminSettings.getCurrentSettings();

    // If not admin, block opening when Twilio balance is below threshold
    if (req.user.role !== 'admin' && adminSettings.blockIfLowTwilioBalance) {
      try {
        const client = getTwilioClient();
        const balanceData = await client.balance.fetch();
        const balanceNumeric = parseFloat(balanceData.balance);
        if (!isNaN(balanceNumeric) && balanceNumeric < (adminSettings.twilioBalanceThreshold || 5)) {
          // Log blocked attempt due to low balance
          try {
            const gateIdForLog = parseInt(id, 10);
            const gateForLog = isNaN(gateIdForLog) ? null : await Gate.findOne({ id: gateIdForLog });
            await new GateHistory({
              userId: req.user._id,
              gateId: gateForLog?.id || (isNaN(gateIdForLog) ? -1 : gateIdForLog),
              username: req.user.username,
              success: false,
              errorMessage: 'חסימת פתיחת שערים - יתרת Twilio נמוכה'
            }).save();
          } catch (_) { }
          return res.status(402).json({
            error: 'יתרת Twilio נמוכה',
            message: 'לשקד תכף נגמר הכסף תפקידו לו'
          });
        }
      } catch (twilioErr) {
        // If Twilio not configured or unreachable, do not block by this rule
        // Continue with normal flow
      }
    }

    // Check if system is in maintenance mode
    if (adminSettings.systemMaintenance) {
      return res.status(503).json({
        error: 'המערכת בתחזוקה',
        message: adminSettings.maintenanceMessage || 'המערכת בתחזוקה כרגע'
      });
    }

    // Validate and parse the ID
    const gateId = parseInt(id, 10);
    if (isNaN(gateId)) {
      return res.status(400).json({ error: 'מזהה השער לא תקין' });
    }

    const gate = await Gate.findOne({ id: gateId });

    if (!gate || !gate.isActive) {
      // Log failed gate opening attempt - gate not found
      try {
        await new GateHistory({
          userId: req.user._id,
          gateId: isNaN(parseInt(id, 10)) ? -1 : parseInt(id, 10),
          username: req.user.username,
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
          gateName: gate.name,
          username: req.user.username,
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

    if (gate.lastOpenedAt && (now - new Date(gate.lastOpenedAt)) < cooldownMs) {
      const remainingTime = Math.ceil((cooldownMs - (now - new Date(gate.lastOpenedAt))) / 1000);

      // Log failed attempt due to cooldown
      try {
        await new GateHistory({
          userId: req.user._id,
          gateId: gate.id,
          gateName: gate.name,
          username: req.user.username,
          success: false,
          errorMessage: `אנא המתן ${remainingTime} שניות לפני פתיחת השער שוב!`
        }).save();
      } catch (logError) {
        console.error('שגיאה ברישום היסטוריית כישלון:', logError);
      }

      return res.status(429).json({
        error: 'דילאי פעיל',
        message: `אנא המתן ${remainingTime} שניות לפני פתיחת השער שוב!`,
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
          gateName: gate.name,
          username: req.user.username,
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
          gateName: gate.name,
          username: req.user.username,
          success: false,
          errorMessage: 'סיסמה שגויה'
        }).save();
      } catch (logError) {
        console.error('שגיאה ברישום היסטוריית כישלון:', logError);
      }

      return res.status(401).json({ error: 'סיסמה שגויה' });
    }

    const client = getTwilioClient();
    // Build full URL for voice.xml file
    // In localhost/development, use external URL; otherwise use local URL
    const host = req.get('host');
    const isLocalhost = host && (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('::1'));
    const voiceXmlUrl = isLocalhost 
      ? 'https://gates.linkpc.net/voice.xml'
      : `${req.protocol}://${host}/voice.xml`;
    const call = await client.calls.create({
      url: voiceXmlUrl,
      to: gate.phoneNumber,
      from: gate.authorizedNumber,
      statusCallback: `${req.protocol}://${host}/api/gates/${id}/call-status`,
      statusCallbackEvent: ['completed'],
      statusCallbackMethod: 'POST'
    });

    // Update gate with last opened time
    await gate.markAsOpened();

    // Log successful gate opening
    await new GateHistory({
      userId: req.user._id,
      gateId: gate.id,
      gateName: gate.name,
      username: req.user.username,
      success: true,
      callSid: call.sid,
      autoOpened: autoOpened === true
    }).save();

    res.json({
      success: true,
      message: `פותח שער "${gate.name}" באמצעות שיחת טלפון ל-${gate.phoneNumber}`,
      callSid: call.sid,
      gate: gate.toJSON()
    });

  } catch (error) {
    console.error('שגיאה בפתיחת השער:', error);

    // Convert error to user-friendly Hebrew message
    let userFriendlyError = 'שגיאה לא ידועה בפתיחת השער';
    
    if (error.message && error.message.includes('פרטי התחברות ל-Twilio לא מוגדרים')) {
      userFriendlyError = 'Twilio לא מוגדר - בדוק את משתני הסביבה';
    } else if (error.code === 'ENOTFOUND' || error.message?.includes('ENOTFOUND')) {
      userFriendlyError = 'שגיאת רשת - לא ניתן להגיע ל-Twilio';
    } else if (error.code === 'UNAUTHORIZED' || error.message?.includes('UNAUTHORIZED')) {
      userFriendlyError = 'אימות Twilio נכשל - בדוק פרטי התחברות';
    } else if (error.name === 'CastError' || error.message?.includes('CastError')) {
      userFriendlyError = 'מזהה השער לא תקין';
    } else if (error.message?.includes('Invalid phone number') || error.message?.includes('phone number')) {
      userFriendlyError = 'מספר טלפון לא תקין';
    } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
      userFriendlyError = 'פג זמן ההמתנה - שרת Twilio לא הגיב';
    } else if (error.message?.includes('ECONNREFUSED')) {
      userFriendlyError = 'חיבור נדחה - שרת Twilio לא זמין';
    } else if (error.message?.includes('balance') || error.message?.includes('insufficient')) {
      userFriendlyError = 'יתרת Twilio נמוכה - לא ניתן לבצע שיחה';
    } else if (error.message) {
      // Try to extract meaningful information from error message
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('network') || errorMsg.includes('connection')) {
        userFriendlyError = 'שגיאת רשת - לא ניתן להתחבר ל-Twilio';
      } else if (errorMsg.includes('authentication') || errorMsg.includes('auth')) {
        userFriendlyError = 'שגיאת אימות - פרטי Twilio שגויים';
      } else if (errorMsg.includes('permission') || errorMsg.includes('forbidden')) {
        userFriendlyError = 'אין הרשאה לבצע פעולה זו';
      } else {
        // Use original error message but add context
        userFriendlyError = `שגיאה בפתיחת השער: ${error.message}`;
      }
    }

    // Log failed gate opening attempt with user-friendly error message
    try {
      await new GateHistory({
        userId: req.user._id,
        gateId: isNaN(parseInt(req.params.id, 10)) ? -1 : parseInt(req.params.id, 10),
        username: req.user.username,
        success: false,
        errorMessage: userFriendlyError
      }).save();
    } catch (logError) {
      console.error('שגיאה ברישום היסטוריית כישלון:', logError);
    }

    // Provide more specific error messages for API response
    if (error.message && error.message.includes('פרטי התחברות ל-Twilio לא מוגדרים')) {
      res.status(500).json({ error: 'Twilio לא מוגדר - בדוק את משתני הסביבה' });
    } else if (error.code === 'ENOTFOUND') {
      res.status(500).json({ error: 'שגיאת רשת - לא ניתן להגיע ל-Twilio' });
    } else if (error.code === 'UNAUTHORIZED') {
      res.status(500).json({ error: 'אימות Twilio נכשל - בדוק פרטי התחברות' });
    } else if (error.name === 'CastError') {
      res.status(400).json({ error: 'מזהה השער לא תקין' });
    } else {
      res.status(500).json({ error: userFriendlyError });
    }
  }
});

// Handle call-status callbacks from Twilio (POST) and URL verification (GET)
router.post('/gates/:id/call-status', requireMongoDB, async (req, res) => {
  try {
    console.log('\n=== CALL-STATUS ROUTE HIT (POST) ===');
    console.log('Timestamp:', new Date().toISOString());
    const { id } = req.params;
    
    // Log all incoming data from Twilio for debugging
    console.log('=== Twilio Call Status Callback ===');
    console.log('Gate ID:', id);
    console.log('Request method:', req.method);
    console.log('Request path:', req.path);
    console.log('Request url:', req.url);
    console.log('User-Agent:', req.get('user-agent'));
    console.log('Content-Type:', req.get('content-type'));
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    
    // Twilio sends data in form-urlencoded format
    // Check all possible price field names that Twilio might use
    const CallStatus = req.body.CallStatus || req.body.Status;
    const CallDuration = req.body.CallDuration || req.body.Duration;
    const CallSid = req.body.CallSid || req.body.Sid;
    
    // Twilio can send price in different fields: Price, CallPrice, or PriceUnit
    const Price = req.body.Price || req.body.price;
    const CallPrice = req.body.CallPrice || req.body.callPrice;
    const PriceUnit = req.body.PriceUnit || req.body.priceUnit;
    
    console.log('Extracted values:', {
      CallStatus,
      CallDuration,
      CallSid,
      Price,
      CallPrice,
      PriceUnit
    });

    // Validate and parse the ID
    const gateId = parseInt(id, 10);
    if (isNaN(gateId)) {
      console.error('Invalid gate ID:', id);
      return res.status(400).json({ error: 'מזהה השער לא תקין' });
    }

    const gate = await Gate.findOne({ id: gateId });

    if (gate) {
      await gate.updateCallStatus(CallStatus, CallDuration);
    }

    // Update call cost in history if CallSid is provided
    if (CallSid) {
      try {
        console.log(`Processing cost update for CallSid: ${CallSid}`);
        
        let cost = null;
        
        // If call status is busy, set cost to 0
        if (CallStatus === 'busy') {
          cost = 0;
          console.log(`Call status is busy, setting cost to 0`);
        } else {
          // Try all possible price fields
          const priceValue = Price || CallPrice || PriceUnit;
          
          console.log('Price value from callback:', priceValue);
          
          // First try to get price from callback
          if (priceValue !== undefined && priceValue !== null && priceValue !== '') {
            // Handle string values like "-0.01" or "$0.01" or "0.01" or "-0.0100"
            const cleanedPrice = String(priceValue).replace(/[^0-9.-]/g, '');
            const parsedPrice = parseFloat(cleanedPrice);
            if (!isNaN(parsedPrice)) {
              cost = Math.abs(parsedPrice);
              console.log(`Parsed cost from callback: $${cost.toFixed(4)}`);
            }
          }
          
          // If no price in callback and call is completed, fetch from Twilio API
          if ((cost === null || isNaN(cost)) && CallStatus === 'completed') {
            console.log('No price in callback, fetching from Twilio API...');
            try {
              const client = getTwilioClient();
              const call = await client.calls(CallSid).fetch();
              console.log('Twilio API call data:', {
                sid: call.sid,
                status: call.status,
                price: call.price,
                priceUnit: call.priceUnit
              });
              
              // Twilio returns price as a string like "-0.01" (negative means charged)
              // Also check priceUnit field
              const apiPrice = call.price || call.priceUnit;
              if (apiPrice !== null && apiPrice !== undefined && apiPrice !== '') {
                const cleanedPrice = String(apiPrice).replace(/[^0-9.-]/g, '');
                const parsedPrice = parseFloat(cleanedPrice);
                if (!isNaN(parsedPrice)) {
                  cost = Math.abs(parsedPrice);
                  console.log(`Parsed cost from Twilio API: $${cost.toFixed(4)}`);
                }
              }
            } catch (apiError) {
              console.error(`Error fetching call price from Twilio API for ${CallSid}:`, apiError.message);
            }
          }
        }
        
        // Update history if we have a cost (including 0 cost calls)
        if (cost !== null && !isNaN(cost)) {
          // First try to find and update by callSid
          let updateResult = await GateHistory.updateOne(
            { callSid: CallSid },
            { $set: { cost: cost } }
          );
          
          console.log('Update result (by callSid):', {
            matchedCount: updateResult.matchedCount,
            modifiedCount: updateResult.modifiedCount,
            cost: cost
          });
          
          // If not found by callSid, try to find by gateId and recent timestamp
          if (updateResult.matchedCount === 0) {
            console.warn(`No history record found for callSid: ${CallSid}, trying fallback...`);
            const recentHistory = await GateHistory.findOne({
              gateId: gateId,
              timestamp: { $gte: new Date(Date.now() - 10 * 60 * 1000) } // Last 10 minutes (increased window)
            }).sort({ timestamp: -1 });
            
            if (recentHistory) {
              // Update the record with both callSid and cost
              updateResult = await GateHistory.updateOne(
                { _id: recentHistory._id },
                { $set: { cost: cost, callSid: CallSid } }
              );
              console.log('Fallback update result:', {
                matchedCount: updateResult.matchedCount,
                modifiedCount: updateResult.modifiedCount,
                cost: cost,
                callSid: CallSid
              });
              
              if (updateResult.modifiedCount > 0) {
                console.log(`✓ Successfully updated cost via fallback for gate ${gateId}: $${cost.toFixed(4)}`);
              }
            } else {
              console.warn(`No recent history record found for gate ${gateId} to associate with callSid ${CallSid}`);
            }
          } else if (updateResult.modifiedCount > 0) {
            console.log(`✓ Successfully updated cost for callSid ${CallSid}: $${cost.toFixed(4)}`);
          } else {
            console.log(`Cost already set to $${cost.toFixed(4)} for callSid ${CallSid}`);
          }
        } else if (CallStatus === 'completed') {
          // Log if call completed but no cost found
          console.warn(`⚠ Call ${CallSid} completed but no cost available.`, {
            Price,
            CallPrice,
            PriceUnit,
            CallStatus
          });
        }
      } catch (updateError) {
        console.error('שגיאה בעדכון עלות שיחה:', updateError);
        console.error('Error stack:', updateError.stack);
      }
    } else {
      console.warn('No CallSid provided in callback');
    }

    console.log('=== End Call Status Callback ===');
    console.log('✓ Successfully processed POST callback from Twilio\n');
    res.sendStatus(200);
  } catch (error) {
    console.error('שגיאה בעדכון סטטוס שיחה:', error);
    console.error('Error stack:', error.stack);
    console.error('⚠ Error in POST callback, but returning 200 to prevent Twilio retries\n');
    res.sendStatus(200); // Still return 200 to Twilio to avoid retries
  }
});

// GET endpoint for call-status (handles busy calls and URL verification)
// Twilio sometimes sends busy/failed callbacks via GET with query parameters
router.get('/gates/:id/call-status', requireMongoDB, async (req, res) => {
  try {
    console.log('\n=== CALL-STATUS GET REQUEST ===');
    console.log('Timestamp:', new Date().toISOString());
    const { id } = req.params;
    console.log('Gate ID:', id);
    console.log('Request query:', req.query);
    console.log('User-Agent:', req.get('user-agent'));
    
    // Check if this is a Twilio callback with status information (busy calls often come via GET)
    const CallStatus = req.query.CallStatus || req.query.Status;
    const CallSid = req.query.CallSid || req.query.Sid;
    const CallDuration = req.query.CallDuration || req.query.Duration;
    
    // If we have call status info, treat it as a callback (common for busy/failed calls)
    if (CallStatus || CallSid) {
      console.log('⚠ Twilio callback detected in GET request (likely busy/failed call)');
      console.log('CallStatus:', CallStatus);
      console.log('CallSid:', CallSid);
      console.log('CallDuration:', CallDuration);
      
      // Validate and parse the ID
      const gateId = parseInt(id, 10);
      if (isNaN(gateId)) {
        console.error('Invalid gate ID:', id);
        return res.status(200).send('OK'); // Return 200 to Twilio even on error
      }

      const gate = await Gate.findOne({ id: gateId });
      if (gate) {
        await gate.updateCallStatus(CallStatus, CallDuration);
      }

      // Update call cost in history if CallSid is provided
      if (CallSid) {
        try {
          console.log(`Processing cost update for CallSid: ${CallSid} (via GET)`);
          
          let cost = null;
          
          // If call status is busy, set cost to 0
          if (CallStatus === 'busy' || CallStatus === 'no-answer' || CallStatus === 'failed' || CallStatus === 'canceled') {
            cost = 0;
            console.log(`Call status is ${CallStatus}, setting cost to 0`);
          } else {
            // Try to get price from query parameters
            const Price = req.query.Price || req.query.price;
            const CallPrice = req.query.CallPrice || req.query.callPrice;
            const PriceUnit = req.query.PriceUnit || req.query.priceUnit;
            const priceValue = Price || CallPrice || PriceUnit;
            
            if (priceValue !== undefined && priceValue !== null && priceValue !== '') {
              const cleanedPrice = String(priceValue).replace(/[^0-9.-]/g, '');
              const parsedPrice = parseFloat(cleanedPrice);
              if (!isNaN(parsedPrice)) {
                cost = Math.abs(parsedPrice);
                console.log(`Parsed cost from GET callback: $${cost.toFixed(4)}`);
              }
            }
          }
          
          // Update history if we have a cost (including 0 cost calls)
          if (cost !== null && !isNaN(cost)) {
            let updateResult = await GateHistory.updateOne(
              { callSid: CallSid },
              { $set: { cost: cost } }
            );
            
            if (updateResult.matchedCount === 0) {
              // Try to find by gateId and recent timestamp
              const recentHistory = await GateHistory.findOne({
                gateId: gateId,
                timestamp: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
              }).sort({ timestamp: -1 });
              
              if (recentHistory) {
                updateResult = await GateHistory.updateOne(
                  { _id: recentHistory._id },
                  { $set: { cost: cost, callSid: CallSid } }
                );
              }
            }
            
            if (updateResult.modifiedCount > 0) {
              console.log(`✓ Successfully updated cost via GET callback for callSid ${CallSid}: $${cost.toFixed(4)}`);
            }
          }
        } catch (updateError) {
          console.error('שגיאה בעדכון עלות שיחה (GET):', updateError);
        }
      }
      
      console.log('✓ Successfully processed GET callback from Twilio\n');
      return res.status(200).send('OK'); // Return simple OK for Twilio
    }
    
    // Otherwise, this is just URL verification/test
    console.log('This appears to be a URL verification/test request');
    console.log('NOTE: Twilio callbacks typically use POST, but busy calls may use GET with query params');
    
    res.status(200).json({
      status: 'ok',
      message: 'Call-status endpoint is available. Twilio callbacks use POST method, but busy calls may use GET.',
      gateId: id,
      method: 'GET',
      timestamp: new Date().toISOString(),
      note: 'This endpoint accepts both POST and GET requests for call status updates from Twilio'
    });
  } catch (error) {
    console.error('שגיאה ב-GET call-status:', error);
    console.error('Error stack:', error.stack);
    // Always return 200 to Twilio to avoid retries
    res.status(200).send('OK');
  }
});

// Gate statistics endpoint - admin sees all, regular users see only their own
router.get('/gates/stats', requireMongoDB, authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = {};

    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        matchStage.timestamp.$lte = endDateTime;
      }
    }

    // Get list of active gate IDs to filter statistics
    const activeGates = await Gate.find({ isActive: true }).select('id name');
    const activeGateIds = activeGates.map(g => g.id);

    // Add filter for active gates only
    matchStage.gateId = { $in: activeGateIds };

    // For regular users, only show their own statistics
    let userGates = [];
    if (req.user.role !== 'admin') {
      matchStage.userId = req.user._id;
      
      // Get list of authorized gates for the user
      const authorizedGateIds = req.user.authorizedGates || [];
      if (authorizedGateIds.length > 0) {
        userGates = await Gate.find({
          id: { $in: authorizedGateIds },
          isActive: true
        }).select('id name').lean();
      }
    }

    // Top Gates (for user: only gates they opened)
    // Group by gateId instead of gateName
    const topGatesByGateId = await GateHistory.aggregate([
      { $match: matchStage },
      { $group: { _id: "$gateId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get gate names for the top gates
    const topGates = await Promise.all(
      topGatesByGateId.map(async ({ _id: gateId, count }) => {
        const gate = await Gate.findOne({ id: gateId });
        return {
          _id: gate ? gate.name : `שער ${gateId}`,
          count
        };
      })
    );

    // Top Users (only for admin, for regular users this will be empty or just them)
    let topUsers = [];
    if (req.user.role === 'admin') {
      topUsers = await GateHistory.aggregate([
        { $match: matchStage },
        { $group: { _id: "$username", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
    } else {
      // For regular users, show their own stats
      const userStats = await GateHistory.aggregate([
        { $match: matchStage },
        { $group: { _id: "$username", count: { $sum: 1 } } }
      ]);
      topUsers = userStats;
    }

    // Hourly Activity
    const hourlyActivity = await GateHistory.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $hour: { date: "$timestamp", timezone: "Asia/Jerusalem" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Fill in missing hours
    const fullHourlyActivity = Array.from({ length: 24 }, (_, i) => {
      const found = hourlyActivity.find(h => h._id === i);
      return { hour: i, count: found ? found.count : 0 };
    });

    // For regular users, fill in missing gates with 0 count
    let completeTopGates = topGates;
    if (req.user.role !== 'admin' && userGates.length > 0) {
      const gatesMap = new Map(topGates.map(g => [g._id, g.count]));
      completeTopGates = userGates.map(gate => ({
        _id: gate.name,
        count: gatesMap.get(gate.name) || 0
      })).sort((a, b) => {
        // Sort by count (descending), then by name
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a._id.localeCompare(b._id);
      });
    }

    // Calculate total cost (only for admin)
    // Only sum costs that are not null - don't count null as 0
    let totalCost = null;
    let costCount = 0;
    if (req.user.role === 'admin') {
      const costStats = await GateHistory.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalCost: { 
              $sum: { 
                $cond: [
                  { $and: [{ $ne: ['$cost', null] }, { $gt: ['$cost', 0] }] },
                  '$cost',
                  0
                ]
              } 
            },
            callCount: { $sum: 1 },
            costCount: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ['$cost', null] }, { $gt: ['$cost', 0] }] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);
      if (costStats.length > 0) {
        totalCost = costStats[0].totalCost;
        costCount = costStats[0].costCount || 0;
      }
    }

    res.json({
      topGates: completeTopGates,
      topUsers,
      hourlyActivity: fullHourlyActivity,
      isPersonal: req.user.role !== 'admin', // Flag to indicate if these are personal stats
      totalCost: totalCost, // Total cost in USD (only for admin, only for calls with cost data)
      costCount: costCount // Number of calls with cost data (only for admin)
    });
  } catch (error) {
    console.error('שגיאה בטעינת סטטיסטיקות:', error);
    res.status(500).json({ error: 'נכשל בטעינת סטטיסטיקות' });
  }
});

// Gate history endpoint - admin sees all, regular users see only their own
router.get('/gates/history', requireMongoDB, authenticateToken, async (req, res) => {
  try {
    const { limit = 50, page = 1, gateId, gateName, userId, username, startDate, endDate } = req.query;
    const limitNum = Math.min(parseInt(limit), 500); // Max 500 records per page
    const pageNum = Math.max(parseInt(page), 1); // Minimum page is 1
    const skip = (pageNum - 1) * limitNum;

    let query = {};

    // For regular users, only show their own gate history
    if (req.user.role !== 'admin') {
      query.userId = req.user._id;
    }

    // Build date filter if provided
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add 23:59:59 to end date to include the entire day
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query.timestamp.$lte = endDateTime;
      }
    }

    // Build query based on filters
    if (gateName) {
      // If gateName is provided, find the gate by name first, then filter by gateId
      const gate = await Gate.findOne({ name: gateName });
      if (gate) {
        query.gateId = gate.id;
      } else {
        // If gate not found, return empty result
        query.gateId = -1; // Non-existent gate ID
      }
    } else if (gateId) {
      const numericGateId = parseInt(gateId, 10);
      if (!isNaN(numericGateId)) {
        query.gateId = numericGateId;
      }
    } else if (username) {
      // Filter by username
      query.username = username;
    } else if (userId) {
      // Check if userId is a valid ObjectId or if it's actually a username
      if (mongoose.Types.ObjectId.isValid(userId)) {
        query.userId = userId;
      } else {
        // If userId is not a valid ObjectId, treat it as username
        query.username = userId;
      }
    }

    // Get total count for pagination
    const totalCount = await GateHistory.countDocuments(query);

    // Get paginated history
    const history = await GateHistory.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('userId', 'username name')
      .lean(); // Use lean() for better performance and to avoid Mongoose document issues

    const totalPages = Math.ceil(totalCount / limitNum);

    // Transform history records to ensure proper JSON format
    const transformedHistory = history.map(record => {
      const transformed = {
        id: record._id ? record._id.toString() : record.id,
        userId: record.userId ? (typeof record.userId === 'object' ? record.userId._id?.toString() : record.userId.toString()) : null,
        gateId: record.gateId,
        username: record.username,
        gateName: record.gateName,
        timestamp: record.timestamp,
        success: record.success,
        cost: record.cost !== undefined ? record.cost : null, // Include cost field
        callSid: record.callSid,
        errorMessage: record.errorMessage,
        autoOpened: record.autoOpened || false
      };
      
      // Add user info if populated
      if (record.userId && typeof record.userId === 'object') {
        transformed.userName = record.userId.name || record.userId.username || record.username;
      }
      
      return transformed;
    });

    // Send response immediately to user
    res.json({
      history: transformedHistory,
      count: transformedHistory.length,
      totalCount: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
      timestamp: new Date().toISOString()
    });

    // Update missing costs in background (don't await - run asynchronously)
    // Find records in current page that have callSid but no cost
    const recordsWithoutCost = history.filter(record => 
      record.callSid && 
      (record.cost === null || record.cost === undefined) &&
      record.success === true // Only update successful calls
    );

    if (recordsWithoutCost.length > 0) {
      // Run in background without blocking
      (async () => {
        try {
          console.log(`מחפש עלויות חסרות עבור ${recordsWithoutCost.length} רשומות...`);
          const client = getTwilioClient();
          
          for (const record of recordsWithoutCost) {
            try {
              if (!record.callSid) continue;
              
              // Fetch call data from Twilio API
              const call = await client.calls(record.callSid).fetch();
              
              let cost = null;
              
              // If call status is busy, set cost to 0
              if (call.status === 'busy') {
                cost = 0;
                console.log(`Call status is busy for callSid ${record.callSid}, setting cost to 0`);
              } else {
                // Twilio returns price as a string like "-0.01" (negative means charged)
                const apiPrice = call.price || call.priceUnit;
                if (apiPrice !== null && apiPrice !== undefined && apiPrice !== '') {
                  const cleanedPrice = String(apiPrice).replace(/[^0-9.-]/g, '');
                  const parsedPrice = parseFloat(cleanedPrice);
                  if (!isNaN(parsedPrice)) {
                    cost = Math.abs(parsedPrice);
                  }
                }
              }
              
              // Update the record if we have a cost (including 0 for busy calls)
              if (cost !== null && !isNaN(cost)) {
                await GateHistory.updateOne(
                  { _id: record._id },
                  { $set: { cost: cost } }
                );
                
                console.log(`✓ עודכן עלות עבור callSid ${record.callSid}: $${cost.toFixed(4)} (status: ${call.status})`);
              }
            } catch (updateError) {
              // Log error but continue with other records
              console.error(`שגיאה בעדכון עלות עבור callSid ${record.callSid}:`, updateError.message);
            }
          }
          
          console.log(`סיום עדכון עלויות חסרות`);
        } catch (error) {
          console.error('שגיאה כללית בעדכון עלויות חסרות:', error);
        }
      })();
    }
  } catch (error) {
    console.error('שגיאה בטעינת היסטוריית שערים:', error);
    console.error('Error stack:', error.stack);
    // Ensure we always return valid JSON
    res.status(500).json({ 
      error: 'נכשל בטעינת היסטוריית השערים',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

    // Validate and parse the ID
    const gateId = parseInt(id, 10);
    if (isNaN(gateId)) {
      return res.status(400).json({ error: 'מזהה השער לא תקין' });
    }

    const gate = await Gate.findOne({ id: gateId });

    if (!gate || !gate.isActive) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }

    // Check if user has permission to view this gate
    if (req.user.role !== 'admin' && !req.user.canAccessGate(gateId)) {
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
    const { name, phoneNumber, authorizedNumber, password, location } = req.body;

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

    // Get the highest order value and add 1 for the new gate
    const lastGate = await Gate.findOne().sort({ order: -1 });
    const nextOrder = lastGate ? (lastGate.order || 0) + 1 : 0;

    const newGate = new Gate({
      id: nextId,
      name,
      phoneNumber,
      authorizedNumber,
      password: password || null,
      order: nextOrder,
      location: location || { latitude: null, longitude: null, autoOpenRadius: 50, address: null }
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

// Reorder gates endpoint - MUST be before /gates/:id route to avoid route matching conflict
// Allow all authenticated users to reorder gates (not just admins)
router.put('/gates/reorder', requireMongoDB, authenticateToken, async (req, res) => {
  try {
    const { gateOrders } = req.body; // Array of { gateId: number, order: number }

    // Validate request body
    if (!gateOrders) {
      return res.status(400).json({ error: 'gateOrders חסר בבקשה' });
    }

    if (!Array.isArray(gateOrders)) {
      return res.status(400).json({ error: 'gateOrders חייב להיות מערך' });
    }

    if (gateOrders.length === 0) {
      return res.status(400).json({ error: 'gateOrders לא יכול להיות ריק' });
    }

    // Validate and filter valid entries
    const validUpdates = [];

    for (const item of gateOrders) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      // Get values - they should already be numbers from the client
      const gateId = item.gateId;
      const order = item.order;

      // Convert to numbers if needed
      let parsedGateId = gateId;
      let parsedOrder = order;

      if (typeof gateId !== 'number') {
        parsedGateId = parseInt(gateId, 10);
      }

      if (typeof order !== 'number') {
        parsedOrder = parseInt(order, 10);
      }

      // Validate
      if (isNaN(parsedGateId) || isNaN(parsedOrder)) {
        continue;
      }

      validUpdates.push({
        gateId: parsedGateId,
        order: parsedOrder
      });
    }

    if (validUpdates.length === 0) {
      return res.status(400).json({ error: 'מזהה השער לא תקין' });
    }

    // Update personal gate order preferences for all users (including admins)
    // Mongoose Map needs to be initialized if it doesn't exist
    if (!req.user.gateOrderPreferences) {
      req.user.gateOrderPreferences = new Map();
    }

    // Ensure it's a Map instance
    const preferences = req.user.gateOrderPreferences instanceof Map
      ? req.user.gateOrderPreferences
      : new Map(Object.entries(req.user.gateOrderPreferences || {}));

    validUpdates.forEach(({ gateId, order }) => {
      preferences.set(String(gateId), order);
    });

    // Mongoose will automatically convert Map to object for storage
    req.user.gateOrderPreferences = preferences;
    await req.user.save();

    res.json({
      success: true,
      message: 'סדר השערים עודכן בהצלחה'
    });

  } catch (error) {
    console.error('שגיאה בעדכון סדר שערים:', error);
    res.status(500).json({ error: 'נכשל בעדכון סדר השערים' });
  }
});

router.put('/gates/:id', requireMongoDB, authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, authorizedNumber, password, location } = req.body;

    // Validate and parse the ID
    const gateId = parseInt(id, 10);
    if (isNaN(gateId)) {
      return res.status(400).json({ error: 'מזהה השער לא תקין' });
    }

    const gate = await Gate.findOne({ id: gateId });

    if (!gate || !gate.isActive) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }

    // Check if changing phone number conflicts with existing gate
    if (phoneNumber && phoneNumber !== gate.phoneNumber) {
      const existingGate = await Gate.findOne({
        phoneNumber,
        isActive: true,
        id: { $ne: gateId }
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
    if (location !== undefined) gate.location = location;

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

    // Validate and parse the ID
    const gateId = parseInt(id, 10);
    if (isNaN(gateId)) {
      return res.status(400).json({ error: 'מזהה השער לא תקין' });
    }

    const gate = await Gate.findOne({ id: gateId });

    if (!gate || !gate.isActive) {
      return res.status(404).json({ error: 'השער לא נמצא' });
    }

    // Soft delete - mark as inactive instead of removing
    gate.isActive = false;
    await gate.save();

    // Delete all history records for this gate
    await GateHistory.deleteMany({ gateId: gate.id });

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
    console.error('שגיאה בקבלת הגדרות נוכחיות:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack
    });
    // Return safe defaults to avoid breaking the client if DB is unavailable
    const fallbackSettings = {
      gateCooldownSeconds: 30,
      maxRetries: 3,
      enableNotifications: true,
      autoRefreshInterval: 5,
      systemMaintenance: false,
      maintenanceMessage: 'המערכת בתחזוקה',
      blockIfLowTwilioBalance: true,
      twilioBalanceThreshold: 5
    };
    res.status(200).json({
      settings: fallbackSettings,
      lastUpdated: null,
      warning: 'מוחזרות הגדרות ברירת מחדל עקב שגיאה במסד הנתונים'
    });
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
    const { gateCooldownSeconds, maxRetries, enableNotifications, autoRefreshInterval, systemMaintenance, maintenanceMessage, blockIfLowTwilioBalance, twilioBalanceThreshold } = req.body;

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
    if (twilioBalanceThreshold !== undefined && (isNaN(Number(twilioBalanceThreshold)) || Number(twilioBalanceThreshold) < 0)) {
      return res.status(400).json({ error: 'סף יתרת Twilio חייב להיות מספר אי-שלילי' });
    }

    // Update settings in MongoDB
    const updatedSettings = await AdminSettings.updateSettings({
      gateCooldownSeconds,
      maxRetries,
      enableNotifications,
      autoRefreshInterval,
      systemMaintenance: systemMaintenance || false,
      maintenanceMessage: maintenanceMessage || 'המערכת בתחזוקה',
      blockIfLowTwilioBalance: !!blockIfLowTwilioBalance,
      twilioBalanceThreshold: twilioBalanceThreshold !== undefined ? Number(twilioBalanceThreshold) : undefined
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

// Get USD to ILS exchange rate
router.get('/exchange-rate', async (req, res) => {
  try {
    // Try to get exchange rate from a free API
    // Using exchangerate-api.com (free tier allows 1500 requests/month)
    const https = require('https');
    
    const fetchExchangeRate = () => {
      return new Promise((resolve, reject) => {
        https.get('https://api.exchangerate-api.com/v4/latest/USD', (response) => {
          let data = '';
          
          response.on('data', (chunk) => {
            data += chunk;
          });
          
          response.on('end', () => {
            try {
              if (response.statusCode === 200) {
                const jsonData = JSON.parse(data);
                resolve({
                  ok: true,
                  data: jsonData
                });
              } else {
                resolve({
                  ok: false,
                  data: null
                });
              }
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', (error) => {
          reject(error);
        });
      });
    };
    
    const result = await fetchExchangeRate();
    
    if (result.ok && result.data) {
      const ilsRate = result.data.rates?.ILS || 3.7; // Fallback to 3.7 if API fails
      res.json({ 
        rate: ilsRate,
        timestamp: new Date().toISOString()
      });
    } else {
      // Fallback to default rate if API fails
      res.json({ 
        rate: 3.7,
        timestamp: new Date().toISOString(),
        note: 'Using default rate - API unavailable'
      });
    }
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    // Fallback to default rate
    res.json({ 
      rate: 3.7,
      timestamp: new Date().toISOString(),
      note: 'Using default rate - API error'
    });
  }
});

module.exports = router;