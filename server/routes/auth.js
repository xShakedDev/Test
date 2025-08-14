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
  if (!twilioClient) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

// Data functions
function loadGates() {
  try {
    if (fs.existsSync(gatesFilePath)) {
      return JSON.parse(fs.readFileSync(gatesFilePath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading gates:', error);
  }
  
  // Default gates
  return {
    '1': { id: '1', name: 'Main Gate', phoneNumber: '+1234567890', authorizedNumber: '+972542070400' },
    '2': { id: '2', name: 'Side Gate', phoneNumber: '+0987654321', authorizedNumber: '+972542070400' },
    '3': { id: '3', name: 'Back Gate', phoneNumber: '+1122334455', authorizedNumber: '+972501234567' }
  };
}

function saveGates(gates) {
  try {
    fs.writeFileSync(gatesFilePath, JSON.stringify(gates, null, 2));
    console.log('Gates saved successfully');
  } catch (error) {
    console.error('Error saving gates:', error);
  }
}

// Middleware for admin authentication
function requireAdmin(req, res, next) {
  const providedPassword = req.headers['x-admin-password'] || req.body.adminPassword;
  if (providedPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Admin access required' });
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
    const gates = loadGates();
    const gate = gates[id];
    
    if (!gate) {
      return res.status(404).json({ error: 'Gate not found' });
    }
    
    const client = getTwilioClient();
    await client.calls.create({
      url: 'http://demo.twilio.com/docs/voice.xml',
      to: gate.phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      statusCallback: `${req.protocol}://${req.get('host')}/api/gates/${id}/call-status`,
      statusCallbackEvent: ['completed'],
      statusCallbackMethod: 'POST'
    });
    
    gate.lastOpenedAt = new Date();
    gates[id] = gate;
    saveGates(gates);
    
    res.json({ 
      success: true, 
      message: `Opening gate "${gate.name}" via phone call to ${gate.phoneNumber}` 
    });
    
  } catch (error) {
    console.error('Error opening gate:', error);
    res.status(500).json({ error: 'Failed to open gate' });
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
    console.log(`Call to gate "${gate.name}" completed: ${CallStatus}`);
  }
  
  res.sendStatus(200);
});

router.get('/gates/:id', (req, res) => {
  const { id } = req.params;
  const gates = loadGates();
  const gate = gates[id];
  
  if (!gate) {
    return res.status(404).json({ error: 'Gate not found' });
  }
  
  res.json({ gate });
});

router.post('/gates', requireAdmin, (req, res) => {
  try {
    const { name, phoneNumber, authorizedNumber } = req.body;
    
    if (!name || !phoneNumber || !authorizedNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const gates = loadGates();
    const newId = (Object.keys(gates).length + 1).toString();
    
    const newGate = { id: newId, name, phoneNumber, authorizedNumber };
    gates[newId] = newGate;
    saveGates(gates);
    
    console.log(`New gate created: "${name}"`);
    res.status(201).json({ success: true, gate: newGate });
    
  } catch (error) {
    console.error('Error creating gate:', error);
    res.status(500).json({ error: 'Failed to create gate' });
  }
});

router.put('/gates/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, authorizedNumber } = req.body;
    
    const gates = loadGates();
    const gate = gates[id];
    
    if (!gate) {
      return res.status(404).json({ error: 'Gate not found' });
    }
    
    if (name) gate.name = name;
    if (phoneNumber) gate.phoneNumber = phoneNumber;
    if (authorizedNumber) gate.authorizedNumber = authorizedNumber;
    
    gates[id] = gate;
    saveGates(gates);
    
    console.log(`Gate updated: "${gate.name}"`);
    res.json({ success: true, gate });
    
  } catch (error) {
    console.error('Error updating gate:', error);
    res.status(500).json({ error: 'Failed to update gate' });
  }
});

router.delete('/gates/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const gates = loadGates();
    const gate = gates[id];
    
    if (!gate) {
      return res.status(404).json({ error: 'Gate not found' });
    }
    
    delete gates[id];
    saveGates(gates);
    
    console.log(`Gate deleted: "${gate.name}"`);
    res.json({ success: true, message: `Gate "${gate.name}" deleted successfully` });
    
  } catch (error) {
    console.error('Error deleting gate:', error);
    res.status(500).json({ error: 'Failed to delete gate' });
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
    console.error('Error fetching Twilio balance:', error);
    res.status(500).json({ error: 'Failed to fetch Twilio balance' });
  }
});

module.exports = router;
