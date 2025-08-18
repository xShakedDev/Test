const fs = require('fs');
const path = require('path');

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB } = require('../config/database');
const Gate = require('../models/Gate');

async function migrateDataToMongoDB() {
  console.log('🚀 Starting migration from JSON to MongoDB...');
  
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await connectDB();
    
    // Read existing JSON data
    const gatesFilePath = path.join(__dirname, '../data/gates.json');
    
    if (!fs.existsSync(gatesFilePath)) {
      console.log('📄 No existing gates.json file found. Creating default gates...');
      await createDefaultGates();
      return;
    }
    
    const jsonData = JSON.parse(fs.readFileSync(gatesFilePath, 'utf8'));
    const gateArray = Object.values(jsonData);
    
    console.log(`📊 Found ${gateArray.length} gates in JSON file`);
    
    // Clear existing data in MongoDB (optional)
    const existingCount = await Gate.countDocuments();
    console.log(`🗄️  Found ${existingCount} existing gates in MongoDB`);
    
    if (existingCount > 0) {
      console.log('⚠️  Warning: MongoDB already contains gate data.');
      console.log('   This migration will skip existing gates and only add new ones.');
    }
    
    // Migrate each gate
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const gateData of gateArray) {
      try {
        // Check if gate already exists (by phone number)
        const existingGate = await Gate.findOne({ 
          phoneNumber: gateData.phoneNumber 
        });
        
        if (existingGate) {
          console.log(`⏭️  Skipping existing gate: ${gateData.name} (${gateData.phoneNumber})`);
          skippedCount++;
          continue;
        }
        
        // Create new gate
        const newGate = new Gate({
          name: gateData.name,
          phoneNumber: gateData.phoneNumber,
          authorizedNumber: gateData.authorizedNumber,
          password: gateData.password,
          lastOpenedAt: gateData.lastOpenedAt ? new Date(gateData.lastOpenedAt) : null,
          lastCallStatus: gateData.lastCallStatus || null,
          lastCallDuration: gateData.lastCallDuration || null,
          isActive: true
        });
        
        await newGate.save();
        console.log(`✅ Migrated: ${gateData.name} (${gateData.phoneNumber})`);
        migratedCount++;
        
      } catch (error) {
        console.error(`❌ Failed to migrate gate ${gateData.name}:`, error.message);
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${migratedCount} gates`);
    console.log(`   ⏭️  Skipped (already exists): ${skippedCount} gates`);
    console.log(`   🗄️  Total gates in MongoDB: ${await Gate.countDocuments()}`);
    
    // Create backup of original JSON file
    const backupPath = gatesFilePath + '.backup.' + Date.now();
    fs.copyFileSync(gatesFilePath, backupPath);
    console.log(`💾 Backup created: ${backupPath}`);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('💡 You can now update your server to use MongoDB routes.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

async function createDefaultGates() {
  console.log('🏗️  Creating default gates...');
  
  const defaultGates = [
    {
      name: 'שער סירקין שטח',
      phoneNumber: '+972505364453',
      authorizedNumber: '+972548827828',
      password: null
    },
    {
      name: 'שער סירקין ראשי',
      phoneNumber: '+972509127873',
      authorizedNumber: '+972548827828',
      password: null
    }
  ];
  
  for (const gateData of defaultGates) {
    const gate = new Gate(gateData);
    await gate.save();
    console.log(`✅ Created default gate: ${gateData.name}`);
  }
  
  console.log(`🎉 Created ${defaultGates.length} default gates`);
}

// Run migration if this script is called directly
if (require.main === module) {
  migrateDataToMongoDB();
}

module.exports = { migrateDataToMongoDB, createDefaultGates };
