const mongoose = require('mongoose');

const gateHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gate',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  gateName: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  success: {
    type: Boolean,
    required: true
  },
  callSid: {
    type: String,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better query performance
gateHistorySchema.index({ userId: 1, timestamp: -1 });
gateHistorySchema.index({ gateId: 1, timestamp: -1 });
gateHistorySchema.index({ timestamp: -1 });
gateHistorySchema.index({ success: 1 });

// Static method to find history by gate
gateHistorySchema.statics.findByGate = function(gateId, limit = 100) {
  return this.find({ gateId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'username name');
};

// Static method to find history by user
gateHistorySchema.statics.findByUser = function(userId, limit = 100) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('gateId', 'name phoneNumber');
};

// Static method to find all history (for admins)
gateHistorySchema.statics.findAllHistory = function(limit = 100) {
  return this.find({})
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'username name')
    .populate('gateId', 'name phoneNumber');
};

const GateHistory = mongoose.model('GateHistory', gateHistorySchema);

module.exports = GateHistory;
