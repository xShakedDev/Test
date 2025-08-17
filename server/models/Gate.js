const mongoose = require('mongoose');

const gateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\+\d{10,15}$/.test(v);
      },
      message: 'מספר טלפון לא תקין'
    }
  },
  authorizedNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\+\d{10,15}$/.test(v);
      },
      message: 'מספר מורשה לא תקין'
    }
  },
  password: {
    type: String,
    default: null,
    trim: true
  },
  lastOpenedAt: {
    type: Date,
    default: null
  },
  lastCallStatus: {
    type: String,
    default: null
  },
  lastCallDuration: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true, // adds createdAt and updatedAt automatically
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Index for better query performance
gateSchema.index({ phoneNumber: 1 });
gateSchema.index({ authorizedNumber: 1 });
gateSchema.index({ isActive: 1 });

// Static method to find active gates
gateSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Instance method to mark as opened
gateSchema.methods.markAsOpened = function() {
  this.lastOpenedAt = new Date();
  return this.save();
};

// Instance method to update call status
gateSchema.methods.updateCallStatus = function(status, duration) {
  this.lastCallStatus = status;
  this.lastCallDuration = duration;
  return this.save();
};

const Gate = mongoose.model('Gate', gateSchema);

module.exports = Gate;
