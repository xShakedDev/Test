const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'user_created',
      'user_updated',
      'user_deleted',
      'user_activated',
      'user_deactivated',
      'gate_created',
      'gate_updated',
      'gate_deleted',
      'settings_updated',
      'login',
      'logout',
      'password_changed',
      'permissions_changed',
      'bulk_delete_history',
      'delete_all_history',
      'clear_logs',
      'other'
    ]
  },
  resourceType: {
    type: String,
    required: true,
    enum: ['user', 'gate', 'settings', 'history', 'logs', 'auth', 'other']
  },
  resourceId: {
    type: String,
    default: null
  },
  resourceName: {
    type: String,
    default: null
  },
  details: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  success: {
    type: Boolean,
    required: true,
    default: true
  },
  errorMessage: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
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
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ username: 1, timestamp: -1 });

// Static method to create audit log
auditLogSchema.statics.createLog = async function(data) {
  try {
    const log = new this({
      userId: data.userId,
      username: data.username,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId || null,
      resourceName: data.resourceName || null,
      details: data.details || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      success: data.success !== undefined ? data.success : true,
      errorMessage: data.errorMessage || null,
      timestamp: data.timestamp || new Date()
    });
    return await log.save();
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit logging should not break the main flow
    return null;
  }
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
