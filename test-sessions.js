#!/usr/bin/env node

/**
 * Test script for session management
 * Run this to verify sessions are working correctly
 */

const fs = require('fs');
const path = require('path');

const sessionsFilePath = path.join(__dirname, 'server/data/sessions.json');

console.log('🔍 Testing Session Management...\n');

// Test 1: Check if sessions file exists
console.log('1. Checking sessions file...');
if (fs.existsSync(sessionsFilePath)) {
  const stats = fs.statSync(sessionsFilePath);
  console.log(`   ✅ Sessions file exists (${stats.size} bytes)`);
  console.log(`   📁 Path: ${sessionsFilePath}`);
  
  // Test 2: Check if sessions file is valid JSON
  try {
    const data = fs.readFileSync(sessionsFilePath, 'utf8');
    const sessions = JSON.parse(data);
    console.log(`   ✅ Sessions file contains valid JSON`);
    console.log(`   📊 Active sessions: ${Object.keys(sessions).length}`);
    
    // Test 3: Check session structure
    if (Object.keys(sessions).length > 0) {
      const firstSession = Object.values(sessions)[0];
      console.log(`   📋 Sample session structure:`);
      console.log(`      - userId: ${firstSession.userId}`);
      console.log(`      - username: ${firstSession.username}`);
      console.log(`      - role: ${firstSession.role}`);
      console.log(`      - createdAt: ${new Date(firstSession.createdAt).toLocaleString()}`);
      
      // Test 4: Check for expired sessions
      const now = Date.now();
      let expiredCount = 0;
      let validCount = 0;
      
      for (const [token, sessionData] of Object.entries(sessions)) {
        if (now - sessionData.createdAt > 24 * 60 * 60 * 1000) {
          expiredCount++;
        } else {
          validCount++;
        }
      }
      
      console.log(`   ⏰ Session status:`);
      console.log(`      - Valid sessions: ${validCount}`);
      console.log(`      - Expired sessions: ${expiredCount}`);
      
    } else {
      console.log(`   ℹ️  No active sessions found`);
    }
    
  } catch (error) {
    console.log(`   ❌ Sessions file contains invalid JSON: ${error.message}`);
  }
  
} else {
  console.log(`   ❌ Sessions file not found at: ${sessionsFilePath}`);
  console.log(`   💡 This is normal if no users have logged in yet`);
}

// Test 5: Check data directory
console.log('\n2. Checking data directory...');
const dataDir = path.dirname(sessionsFilePath);
if (fs.existsSync(dataDir)) {
  console.log(`   ✅ Data directory exists: ${dataDir}`);
  
  const files = fs.readdirSync(dataDir);
  console.log(`   📁 Files in data directory: ${files.join(', ')}`);
} else {
  console.log(`   ❌ Data directory not found: ${dataDir}`);
}

console.log('\n🎯 Session Management Test Complete!');
console.log('\n💡 Tips:');
console.log('   - Sessions are stored in server/data/sessions.json');
console.log('   - Sessions expire after 24 hours');
console.log('   - Expired sessions are cleaned up automatically');
console.log('   - Sessions persist across server restarts');
console.log('   - Check server logs for session-related messages');
