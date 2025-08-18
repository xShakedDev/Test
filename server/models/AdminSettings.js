const mongoose = require('mongoose');

const adminSettingsSchema = new mongoose.Schema({
  // Gate settings
  gateCooldownSeconds: {
    type: Number,
    required: true,
    min: 10,
    max: 300,
    default: 30
  },
  maxRetries: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    default: 3
  },
  
  // System settings
  enableNotifications: {
    type: Boolean,
    required: true,
    default: true
  },
  autoRefreshInterval: {
    type: Number,
    required: true,
    min: 1,
    max: 60,
    default: 5
  },
  
  // Additional settings
  systemMaintenance: {
    type: Boolean,
    required: true,
    default: false
  },
  maintenanceMessage: {
    type: String,
    default: 'המערכת בתחזוקה'
  },
  
  // Twilio balance protection
  blockIfLowTwilioBalance: {
    type: Boolean,
    required: true,
    default: true
  },
  twilioBalanceThreshold: {
    type: Number,
    required: true,
    min: 0,
    max: 10000,
    default: 5
  },
  
  // Timestamps
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, {
  timestamps: true
});

// Static method to get current settings (creates default if none exist)
adminSettingsSchema.statics.getCurrentSettings = async function() {
  let settings = await this.findOne().sort({ createdAt: -1 });
  
  if (!settings) {
    // Create default settings
    settings = new this({
      updatedBy: null // Will be set when first admin updates
    });
    await settings.save();
  }
  
  // Backfill newly added fields with defaults for existing documents
  let shouldSave = false;
  if (typeof settings.blockIfLowTwilioBalance === 'undefined') {
    settings.blockIfLowTwilioBalance = true;
    shouldSave = true;
  }
  if (typeof settings.twilioBalanceThreshold === 'undefined') {
    settings.twilioBalanceThreshold = 5;
    shouldSave = true;
  }
  if (shouldSave) {
    await settings.save();
  }
  
  return settings;
};

// Static method to update settings
adminSettingsSchema.statics.updateSettings = async function(newSettings, userId) {
  const currentSettings = await this.getCurrentSettings();
  
  // Update fields
  Object.keys(newSettings).forEach(key => {
    if (currentSettings.schema.paths[key]) {
      if (typeof newSettings[key] !== 'undefined') {
        currentSettings[key] = newSettings[key];
      }
    }
  });
  
  currentSettings.lastUpdated = new Date();
  currentSettings.updatedBy = userId;
  
  return await currentSettings.save();
};

// Static method to check if system is in maintenance mode
adminSettingsSchema.statics.isSystemInMaintenance = async function() {
  const settings = await this.getCurrentSettings();
  return {
    inMaintenance: settings.systemMaintenance,
    message: settings.maintenanceMessage
  };
};

// Instance method to get settings as plain object
adminSettingsSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('AdminSettings', adminSettingsSchema);
