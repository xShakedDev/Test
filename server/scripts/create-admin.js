const path = require('path');

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB } = require('../config/database');
const User = require('../models/User');

async function createAdminUser() {
  console.log('🚀 Creating admin user...');
  
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await connectDB();
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists:');
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Name: ${existingAdmin.name}`);
      console.log('   To create a new admin, please delete the existing one first.');
      return;
    }
    
    // Create default admin user
    const adminUser = new User({
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || '145632', // Use same as gates admin password
      name: 'מנהל המערכת',
      role: 'admin'
    });
    
    await adminUser.save();
    
    console.log('✅ Admin user created successfully!');
    console.log('🔐 Login credentials:');
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD || '145632'}`);
    console.log('   Role: Admin');
    console.log('');
    console.log('💡 The admin can now:');
    console.log('   - Login to the application');
    console.log('   - Create and manage users');
    console.log('   - Assign gate permissions to users');
    console.log('   - Access all gates');
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run if this script is called directly
if (require.main === module) {
  createAdminUser();
}

module.exports = { createAdminUser };
