const express = require('express');
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Initialize Twilio client
let twilioClient = null;

function getTwilioClient() {
  if (!twilioClient) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      throw new Error('Twilio credentials not configured. Please check your .env file.');
    }
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
}

// File path for storing gates
const gatesFilePath = path.join(__dirname, '../data/gates.json');

// Ensure data directory exists
const dataDir = path.dirname(gatesFilePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load gates from file
function loadGates() {
  try {
    if (fs.existsSync(gatesFilePath)) {
      const data = fs.readFileSync(gatesFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading gates:', error);
  }
  
  // Return default gates if file doesn't exist or is corrupted
  return {
    '1': {
      id: '1',
      name: 'Main Gate',
      phoneNumber: '+1234567890', // Gate's phone number
      authorizedNumber: '+972542070400' // Number that can open this gate
    },
    '2': {
      id: '2', 
      name: 'Side Gate',
      phoneNumber: '+0987654321', // Gate's phone number
      authorizedNumber: '+972542070400' // Number that can open this gate
    },
    '3': {
      id: '3',
      name: 'Back Gate', 
      phoneNumber: '+1122334455', // Gate's phone number
      authorizedNumber: '+972501234567' // Number that can open this gate
    }
  };
}

// Save gates to file
function saveGates(gates) {
  try {
    fs.writeFileSync(gatesFilePath, JSON.stringify(gates, null, 2));
    console.log('Gates saved to file successfully');
  } catch (error) {
    console.error('Error saving gates:', error);
  }
}

// Get all gates
router.get('/gates', (req, res) => {
  const gates = loadGates();
  const gatesList = Object.values(gates);
  res.json({ gates: gatesList });
});

// Open a gate (this will make a phone call)
router.post('/gates/:id/open', async (req, res) => {
  try {
    const { id } = req.params;
    
    const gates = loadGates();
    const gate = gates[id];
    
    if (!gate) {
      return res.status(404).json({ error: 'Gate not found' });
    }
    
    // Make a phone call to open the gate
    const client = getTwilioClient();
    
    const call = await client.calls.create({
      url: 'http://demo.twilio.com/docs/voice.xml', // Simple TwiML for demo
      to: gate.phoneNumber, // Call the gate's phone number
      from: gate.authorizedNumber, // Call from your Twilio number
      statusCallback: `${req.protocol}://${req.get('host')}/api/gates/${id}/call-status`,
      statusCallbackEvent: ['completed'],
      statusCallbackMethod: 'POST'
    });
    
    // Update gate with call information
    gate.lastOpenedAt = new Date();
    gates[id] = gate;
    
    // Save updated gates to file
    saveGates(gates);
    
    res.json({ 
      success: true, 
      gate: gate,
      message: `Opening gate "${gate.name}" via phone call to ${gate.phoneNumber}`
    });
    
  } catch (error) {
    console.error('Error opening gate:', error);
    res.status(500).json({ error: 'Failed to open gate' });
  }
});



// Call status callback (Twilio will call this when call completes)
router.post('/gates/:id/call-status', (req, res) => {
  const { id } = req.params;
  const { CallStatus, CallDuration } = req.body;
  
  const gates = loadGates();
  const gate = gates[id];
  
  if (gate) {
    console.log(`📞 Call to gate "${gate.name}" completed with status: ${CallStatus}`);
    console.log(`⏱️ Call duration: ${CallDuration} seconds`);
    
    // Update gate with call result
    gate.lastCallStatus = CallStatus;
    gate.lastCallDuration = CallDuration;
    gates[id] = gate;
    
    // Save updated gates to file
    saveGates(gates);
    
    if (CallStatus === 'completed') {
      console.log(`✅ Gate "${gate.name}" call completed successfully!`);
    }
  }
  
  res.sendStatus(200);
});

// Get gate details
router.get('/gates/:id', (req, res) => {
  const { id } = req.params;
  const gates = loadGates();
  const gate = gates[id];
  
  if (!gate) {
    return res.status(404).json({ error: 'Gate not found' });
  }
  
  res.json({ gate: gate });
});

// Get authorized number for a gate
router.get('/gates/:id/authorized', (req, res) => {
  const { id } = req.params;
  const gates = loadGates();
  const gate = gates[id];
  
  if (!gate) {
    return res.status(404).json({ error: 'Gate not found' });
  }
  
  res.json({ 
    gateId: id,
    gateName: gate.name,
    authorizedNumber: gate.authorizedNumber
  });
});

// Create a new gate (Admin only)
router.post('/gates', (req, res, next) => {
  // Check if admin password is provided
  const adminPassword = process.env.ADMIN_PASSWORD || 'your-secret-password';
  const providedPassword = req.headers['x-admin-password'] || req.body.adminPassword;
  
  if (providedPassword !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized: Admin access required to create gates' });
  }
  
  next();
}, (req, res) => {
  try {
    const { name, phoneNumber, authorizedNumber } = req.body;
    
    if (!name || !phoneNumber || !authorizedNumber) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, phoneNumber, and authorizedNumber' 
      });
    }
    
    const gates = loadGates();
    const newId = (Object.keys(gates).length + 1).toString();
    
    const newGate = {
      id: newId,
      name,
      phoneNumber,
      authorizedNumber
    };
    
    gates[newId] = newGate;
    saveGates(gates);
    
    console.log(`🚪 New gate created: "${name}" with phone ${phoneNumber}`);
    
    res.status(201).json({ 
      success: true, 
      gate: newGate,
      message: `Gate "${name}" created successfully!`
    });
    
  } catch (error) {
    console.error('Error creating gate:', error);
    res.status(500).json({ error: 'Failed to create gate' });
  }
});

// Update a gate (Admin only)
router.put('/gates/:id', (req, res, next) => {
  // Check if admin password is provided
  const adminPassword = process.env.ADMIN_PASSWORD || 'your-secret-password';
  const providedPassword = req.headers['x-admin-password'] || req.body.adminPassword;
  
  if (providedPassword !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized: Admin access required to update gates' });
  }
  
  next();
}, (req, res) => {
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
    if (authorizedNumber) {
      gate.authorizedNumber = authorizedNumber;
    }
    
    gates[id] = gate;
    saveGates(gates);
    
    console.log(`🚪 Gate updated: "${gate.name}"`);
    
    res.json({ 
      success: true, 
      gate: gate,
      message: `Gate "${gate.name}" updated successfully!`
    });
    
  } catch (error) {
    console.error('Error updating gate:', error);
    res.status(500).json({ error: 'Failed to update gate' });
  }
});

// Delete a gate (Admin only)
router.delete('/gates/:id', (req, res, next) => {
  // Check if admin password is provided
  const adminPassword = process.env.ADMIN_PASSWORD || 'your-secret-password';
  const providedPassword = req.headers['x-admin-password'] || req.body.adminPassword;
  
  if (providedPassword !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized: Admin access required to delete gates' });
  }
  
  next();
}, (req, res) => {
  try {
    const { id } = req.params;
    const gates = loadGates();
    const gate = gates[id];
    
    if (!gate) {
      return res.status(404).json({ error: 'Gate not found' });
    }
    
    delete gates[id];
    saveGates(gates);
    
    console.log(`🚪 Gate deleted: "${gate.name}"`);
    
    res.json({ 
      success: true, 
      message: `Gate "${gate.name}" deleted successfully!`
    });
    
  } catch (error) {
    console.error('Error deleting gate:', error);
    res.status(500).json({ error: 'Failed to delete gate' });
  }
});

module.exports = router;
