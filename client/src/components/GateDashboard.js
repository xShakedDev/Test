import React, { useState, useEffect, useCallback } from 'react';
import { DoorOpen, Users, Edit, Trash2, Plus, ShoppingBag, Shield, Phone, Clock, Activity } from 'lucide-react';
import axios from 'axios';

const GateDashboard = ({ isAdminLoggedIn, adminPassword }) => {
  // State
  const [gates, setGates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddGate, setShowAddGate] = useState(false);
  const [editingGate, setEditingGate] = useState(null);
  const [newGateData, setNewGateData] = useState({
    name: '',
    phoneNumber: '',
    authorizedNumber: '',
    password: ''
  });
  const [twilioBalance, setTwilioBalance] = useState(null);
  const [verifiedCallers, setVerifiedCallers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [lastGateOpenTime, setLastGateOpenTime] = useState(0);
  const [showValidationForm, setShowValidationForm] = useState(false);
  const [validationData, setValidationData] = useState({
    phoneNumber: '',
    friendlyName: ''
  });
  const [validationResult, setValidationResult] = useState(null);
  const [remainingCooldownSeconds, setRemainingCooldownSeconds] = useState(0);

  // Constants
  const GATE_COOLDOWN_MS = 60 * 1000; // 30 seconds cooldown between gate openings

  // Helper function to calculate remaining cooldown time
  const getRemainingCooldown = () => {
    if (lastGateOpenTime === 0) return 0;
    const now = Date.now();
    const timeSinceLastOpen = now - lastGateOpenTime;
    const remaining = GATE_COOLDOWN_MS - timeSinceLastOpen;
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  };

  // Effects
  useEffect(() => {
    fetchGates();
    checkSystemStatus(); // Check system configuration
  }, []);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Update cooldown timer every second
  useEffect(() => {
    if (lastGateOpenTime > 0) {
      const interval = setInterval(() => {
        const remaining = getRemainingCooldown();
        setRemainingCooldownSeconds(remaining);
        
        // If cooldown is finished, clear the timer
        if (remaining <= 0) {
          setLastGateOpenTime(0);
          setRemainingCooldownSeconds(0);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setRemainingCooldownSeconds(0);
    }
  }, [lastGateOpenTime]);



  // API Functions
  const fetchGates = async () => {
    try {
      const response = await axios.get('/api/gates');
      setGates(response.data.gates);
      setError('');
    } catch (error) {
      console.error('Error fetching gates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkSystemStatus = async () => {
    try {
      const response = await axios.get('/api/status');

      // Check if React build files exist
      if (response.data.files && !response.data.files.buildExists) {
        setError('⚠️ אפליקציית React לא נבנתה - חסרים קבצי build');
        return;
      }

      // Check if Twilio is configured
      if (!response.data.twilio.hasSid || !response.data.twilio.hasToken) {
        setError('⚠️ Twilio לא מוגדר - בדוק את משתני הסביבה');
      }

      return response.data;
    } catch (error) {
      console.error('Error checking system status:', error);
      setError('⚠️ לא ניתן לבדוק את סטטוס המערכת');
    }
  };

  const fetchTwilioBalance = useCallback(async (password = adminPassword) => {
    if (!password) return;

    try {
      const response = await axios.get('/api/twilio/balance', {
        headers: { 'x-admin-password': password }
      });
      setTwilioBalance(response.data);
    } catch (error) {
      console.error('Failed to fetch Twilio balance:', error);
      // Show specific error message
      if (error.response?.data?.error) {
        setError(`⚠️ ${error.response.data.error}`);
      }
    }
  }, [adminPassword]);

  const fetchVerifiedCallers = useCallback(async (password = adminPassword) => {
    if (!password) return;

    try {
      const response = await axios.get('/api/twilio/verified-callers', {
        headers: { 'x-admin-password': password }
      });
      setVerifiedCallers(response.data.callerIds);
    } catch (error) {
      console.error('Failed to fetch verified callers:', error);
      if (error.response?.data?.error) {
        setError(`⚠️ ${error.response.data.error}`);
      }
    }
  }, [adminPassword]);

  // Auto-refresh verified callers every 30 seconds when admin is logged in
  useEffect(() => {
    if (isAdminLoggedIn && adminPassword) {
      const interval = setInterval(() => {
        fetchVerifiedCallers(adminPassword);
      }, 30000); // 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [isAdminLoggedIn, adminPassword, fetchVerifiedCallers]);

  // Effect to fetch Twilio data when admin password changes
  useEffect(() => {
    if (adminPassword) {
      fetchTwilioBalance(adminPassword);
      fetchVerifiedCallers(adminPassword);
    }
  }, [adminPassword, fetchTwilioBalance, fetchVerifiedCallers]);



  // Gate operations
  const handleOpenGate = async (gate) => {
    const remainingSeconds = getRemainingCooldown();
    
    if (remainingSeconds > 0) {
      setError(`⏰ נדרש להמתין ${remainingSeconds} שניות לפני פתיחת שער נוסף`);
      return;
    }

    // Check if gate requires password
    if (gate.password) {
      const password = prompt(`הכנס סיסמה לשער "${gate.name}":`);
      
      if (!password) {
        setError('🔐 לא הוכנסה סיסמה');
        return;
      }
      
      try {
        setIsSubmitting(true);
        await axios.post(`/api/gates/${gate.id}/open`, { password });
        setLastGateOpenTime(Date.now());
        fetchGates();
        setSuccessMessage(`🚪 פותח שער "${gate.name}" באמצעות שיחת טלפון ל-${gate.phoneNumber}`);
      } catch (error) {
        if (error.response?.status === 401) {
          setError('🔐 סיסמה שגויה');
        } else {
          setError('נכשל בפתיחת השער');
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // No password required
      try {
        setIsSubmitting(true);
        await axios.post(`/api/gates/${gate.id}/open`);
        setLastGateOpenTime(Date.now());
        fetchGates();
        setSuccessMessage(`🚪 פותח שער "${gate.name}" באמצעות שיחת טלפון ל-${gate.phoneNumber}`);
      } catch (error) {
        setError('נכשל בפתיחת השער');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleEditGate = (gate) => {
    setEditingGate(gate);
    setNewGateData({
      name: gate.name,
      phoneNumber: gate.phoneNumber,
      authorizedNumber: gate.authorizedNumber,
      password: gate.password || ''
    });
  };

  const handleUpdateGate = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await axios.put(`/api/gates/${editingGate.id}`, newGateData, {
        headers: { 'x-admin-password': adminPassword }
      });

      setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '', password: '' });
      setEditingGate(null);
      setError('');
      setSuccessMessage('✅ השער עודכן בהצלחה!');

      setTimeout(fetchGates, 500);
    } catch (error) {
      setError(error.response?.data?.error || 'נכשל בעדכון השער');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGate = async (gate) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את השער "${gate.name}"?`)) {
      try {
        setIsSubmitting(true);
        await axios.delete(`/api/gates/${gate.id}`, {
          headers: { 'x-admin-password': adminPassword }
        });

        setSuccessMessage('🗑️ השער נמחק בהצלחה!');
        setTimeout(fetchGates, 500);
        setError('');
      } catch (error) {
        setError(error.response?.data?.error || 'נכשל במחיקת השער');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleAddGate = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await axios.post('/api/gates', newGateData, {
        headers: { 'x-admin-password': adminPassword }
      });

      setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '', password: '' });
      setShowAddGate(false);
      setError('');
      setSuccessMessage('✅ השער נוצר בהצלחה!');

      setTimeout(fetchGates, 500);
    } catch (error) {
      setError(error.response?.data?.error || 'נכשל ביצירת השער');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form handlers
  const handleCancelAddGate = () => {
    setShowAddGate(false);
    setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '', password: '' });
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingGate(null);
    setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '', password: '' });
    setError('');
  };

  // Validation form handlers
  const handleValidationSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError('');
      
      const response = await axios.post('/api/twilio/validate-phone', validationData, {
        headers: { 'x-admin-password': adminPassword }
      });
      
      setValidationResult(response.data);
      setSuccessMessage(`✅ ${response.data.message}`);
      setShowValidationForm(false);
      setValidationData({ phoneNumber: '', friendlyName: '' });
      
      // Start monitoring validation status
      if (response.data.validationSid) {
        startValidationStatusCheck(response.data.validationSid);
      }
      
      // Refresh verified callers after validation request
      setTimeout(() => {
        if (adminPassword) {
          fetchVerifiedCallers(adminPassword);
        }
      }, 1000);
      
    } catch (error) {
      setError(error.response?.data?.error || 'נכשל בשליחת בקשת האימות');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelValidation = () => {
    setShowValidationForm(false);
    setValidationData({ phoneNumber: '', friendlyName: '' });
    setError('');
    setValidationResult(null);
  };

  // Check validation status periodically
  const startValidationStatusCheck = (validationSid) => {
    const checkStatus = async () => {
      try {
        const response = await axios.get(`/api/twilio/validation-status/${validationSid}`, {
          headers: { 'x-admin-password': adminPassword }
        });
        
        // Update validation result with new status
        setValidationResult(prev => ({
          ...prev,
          status: response.data.status,
          callSid: response.data.callSid
        }));
        
        // If validation is complete, refresh verified callers
        if (response.data.status === 'completed' || response.data.status === 'verified') {
          if (adminPassword) {
            fetchVerifiedCallers(adminPassword);
          }
          // Stop checking status
          return;
        }
        
        // Continue checking every 5 seconds
        setTimeout(checkStatus, 5000);
        
      } catch (error) {
        console.error('Error checking validation status:', error);
        // Stop checking on error
      }
    };
    
    // Start checking after 2 seconds
    setTimeout(checkStatus, 2000);
  };

  // Button click handlers
  const handleAddButtonClick = () => {
    if (isAdminLoggedIn) {
      setShowAddGate(true);
    }
  };

  const handleEditButtonClick = (gate) => {
    if (isAdminLoggedIn) {
      handleEditGate(gate);
    }
  };

  const handleDeleteButtonClick = (gate) => {
    if (isAdminLoggedIn) {
      handleDeleteGate(gate);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'מעולם לא';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Format time in Hebrew locale
    const timeString = date.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });

    if (diffDays === 1) return `היום ${timeString}`;
    if (diffDays === 2) return `אתמול ${timeString}`;
    if (diffDays <= 7) return `לפני ${diffDays - 1} ימים ${timeString}`;

    return `${date.toLocaleDateString('he-IL')} ${timeString}`;
  };

  // Get status display text in Hebrew
  const getStatusDisplayText = (status) => {
    const statusMap = {
      'pending': 'ממתין לאימות',
      'completed': 'הושלם בהצלחה',
      'verified': 'אומת בהצלחה',
      'failed': 'נכשל',
      'cancelled': 'בוטל',
      'in-progress': 'בתהליך אימות'
    };
    
    return statusMap[status] || status;
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>טוען שערים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Success Message */}
      {successMessage && (
        <div className="success-message">
          <p>{successMessage}</p>
          <button onClick={() => setSuccessMessage('')}>×</button>
        </div>
      )}

      <div className="dashboard-header">
        <div>
          <h1>
            <DoorOpen className="icon-big" />
            לוח בקרת שערים</h1>
          {!isAdminLoggedIn && (
            <span className="admin-notice">
              <Shield className="icon-small" />
              נדרש גישת מנהל כדי להוסיף, לערוך או למחוק שערים
            </span>
          )}

          {/* Show Twilio Balance only if admin is logged in */}
          {isAdminLoggedIn && (
            <div className="admin-status-section">
              <span className="password-status">
                <Shield className="icon-small" />
                מנהל מחובר - כעת תוכל לנהל שערים
              </span>

              {twilioBalance && (
                <div className="twilio-balance">
                  <div className="balance-card">
                    <div className="balance-details">
                      <span className="balance-label">
                        <ShoppingBag className="icon-small" />
                        יתרת חשבון Twilio:</span>
                      <span className="balance-amount">{twilioBalance.balance} {twilioBalance.currency}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Global Cooldown Indicator */}
          {(() => {
            const isInCooldown = remainingCooldownSeconds > 0;
            
            return isInCooldown ? (
              <div className="cooldown-indicator">
                <Clock className="icon-small" />
                <span className="cooldown-text">השער נפתח! אנא המתן {remainingCooldownSeconds} שניות לפני פתיחת שער נוסף.</span>
              </div>
            ) : null;
          })()}
        </div>
        {isAdminLoggedIn && (
          <div className="admin-actions">
            <button
              className="btn btn-primary"
              onClick={handleAddButtonClick}
              disabled={isSubmitting}
              title="הוסף שער חדש"
            >
              <Plus className="btn-icon" />
              הוסף שער חדש
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowValidationForm(true)}
              disabled={isSubmitting}
              title="אמת מספר טלפון"
            >
              <Phone className="btn-icon" />
              אמת מספר טלפון
            </button>
          </div>
        )}
      </div>

      {/* Add New Gate Form */}
      {showAddGate && (
        <div className="form-container">
          <form onSubmit={handleAddGate} className="phone-input-form">
            <h3><Plus className="icon-small" /> הוסף שער חדש</h3>

            <div className="form-group">
              <label htmlFor="gateName">שם השער</label>
              <input
                type="text"
                id="gateName"
                value={newGateData.name}
                onChange={(e) => setNewGateData({ ...newGateData, name: e.target.value })}
                placeholder="שער ראשי"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="gatePhone">מספר טלפון השער</label>
              <input
                type="tel"
                id="gatePhone"
                value={newGateData.phoneNumber}
                onChange={(e) => setNewGateData({ ...newGateData, phoneNumber: e.target.value })}
                placeholder="+1234567890"
                required
                disabled={isSubmitting}
              />
              <small><Phone className="icon-small" /> מספר הטלפון של מכשיר השער</small>
            </div>

            <div className="form-group">
              <label htmlFor="authorizedNumber">מספר טלפון מורשה</label>
              {verifiedCallers.length > 0 ? (
                <select
                  id="authorizedNumber"
                  value={newGateData.authorizedNumber}
                  onChange={(e) => setNewGateData({ ...newGateData, authorizedNumber: e.target.value })}
                  required
                  disabled={isSubmitting}
                >
                  <option value="">בחר מספר טלפון מורשה</option>
                  {verifiedCallers.map(caller => (
                    <option key={caller.id} value={caller.phoneNumber}>
                      {caller.friendlyName} ({caller.phoneNumber})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="tel"
                  id="authorizedNumber"
                  value={newGateData.authorizedNumber}
                  onChange={(e) => setNewGateData({ ...newGateData, authorizedNumber: e.target.value })}
                  placeholder="+972541231231"
                  required
                  disabled={isSubmitting}
                />
              )}
              <small>
                <Users className="icon-small" />
                {verifiedCallers.length > 0
                  ? 'מספר הטלפון שיכול לפתוח שער זה (נבחר מרשימת המספרים המורשים ב-Twilio)'
                  : 'מספר הטלפון שיכול לפתוח שער זה'
                }
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="gatePassword">סיסמת שער (אופציונלי)</label>
              <input
                type="password"
                id="gatePassword"
                value={newGateData.password}
                onChange={(e) => setNewGateData({ ...newGateData, password: e.target.value })}
                placeholder="השאר ריק ללא סיסמה"
                disabled={isSubmitting}
              />
              <small>
                <Shield className="icon-small" />
                אם מוגדרת סיסמה, היא תידרש כדי לפתוח את השער. השאר ריק אם השער לא דורש סיסמה.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="adminPassword">סיסמת מנהל</label>
              <input
                type="password"
                id="adminPassword"
                value="••••••••••"
                placeholder="הסיסמה כבר אומתה"
                required
                disabled
              />
              <small><Shield className="icon-small" /> הסיסמה כבר אומתה</small>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'יוצר...' : 'צור שער'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelAddGate}
                disabled={isSubmitting}
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Phone Number Validation Form */}
      {showValidationForm && (
        <div className="form-container">
          <form onSubmit={handleValidationSubmit} className="phone-input-form">
            <h3><Phone className="icon-small" /> אמת מספר טלפון</h3>
            <p>שלח בקשת אימות למספר טלפון חדש</p>

            <div className="form-group">
              <label htmlFor="validationPhoneNumber">מספר טלפון לאימות</label>
              <input
                type="tel"
                id="validationPhoneNumber"
                value={validationData.phoneNumber}
                onChange={(e) => setValidationData({ ...validationData, phoneNumber: e.target.value })}
                placeholder="+972541231231"
                required
                disabled={isSubmitting}
              />
              <small><Phone className="icon-small" /> מספר הטלפון שיאומת על ידי Twilio</small>
            </div>

            <div className="form-group">
              <label htmlFor="validationFriendlyName">שם ידידותי (אופציונלי)</label>
              <input
                type="text"
                id="validationFriendlyName"
                value={validationData.friendlyName}
                onChange={(e) => setValidationData({ ...validationData, friendlyName: e.target.value })}
                placeholder="מספר הבית שלי"
                disabled={isSubmitting}
              />
              <small><Users className="icon-small" /> שם לזיהוי קל של המספר</small>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'שולח...' : 'שלח בקשת אימות'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelValidation}
                disabled={isSubmitting}
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Validation Result Display */}
      {validationResult && (
        <div className="validation-result">
          <div className="validation-result-header">
            <h3>📞 שיחת אימות מתבצעת!</h3>
            <button 
              className="close-btn" 
              onClick={() => setValidationResult(null)}
              title="סגור"
            >
              ×
            </button>
          </div>
          
          <div className="validation-details">
            <div className="validation-info">
              <p><strong>מספר טלפון:</strong> {validationResult.phoneNumber}</p>
              {validationResult.friendlyName && (
                <p><strong>שם ידידותי:</strong> {validationResult.friendlyName}</p>
              )}

            </div>
            
            <div className="verification-code-section">
              <h4>🔐 קוד האימות שלך:</h4>
              <div className="verification-code">
                <span className="code-display">{validationResult.validationCode}</span>
              </div>
            </div>
          </div>
          
          <p className="verification-instructions">
            <strong>הוראות:</strong> כאשר תקבל שיחת טלפון מ-Twilio, הכנס את הקוד הזה כדי לאמת את מספר הטלפון שלך.
          </p>
        </div>
      )}

      {/* Edit Gate Form */}
      {editingGate && (
        <div className="form-container">
          <form onSubmit={handleUpdateGate} className="phone-input-form">
            <h3><Edit className="icon-small" /> ערוך שער: {editingGate.name}</h3>
            <p>עדכן את פרטי השער</p>

            <div className="form-group">
              <label htmlFor="editGateName">שם השער</label>
              <input
                type="text"
                id="editGateName"
                value={newGateData.name}
                onChange={(e) => setNewGateData({ ...newGateData, name: e.target.value })}
                placeholder="שער ראשי"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="editGatePhone">מספר טלפון השער</label>
              <input
                type="tel"
                id="editGatePhone"
                value={newGateData.phoneNumber}
                onChange={(e) => setNewGateData({ ...newGateData, phoneNumber: e.target.value })}
                placeholder="+1234567890"
                required
                disabled={isSubmitting}
              />
              <small><Phone className="icon-small" /> מספר הטלפון של מכשיר השער</small>
            </div>

            <div className="form-group">
              <label htmlFor="editAuthorizedNumber">מספר טלפון מורשה</label>
              {verifiedCallers.length > 0 ? (
                <select
                  id="editAuthorizedNumber"
                  value={newGateData.authorizedNumber}
                  onChange={(e) => setNewGateData({ ...newGateData, authorizedNumber: e.target.value })}
                  required
                  disabled={isSubmitting}
                >
                  <option value="">בחר מספר טלפון מורשה</option>
                  {verifiedCallers.map(caller => (
                    <option key={caller.id} value={caller.phoneNumber}>
                      {caller.friendlyName} ({caller.phoneNumber})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="tel"
                  id="editAuthorizedNumber"
                  value={newGateData.authorizedNumber}
                  onChange={(e) => setNewGateData({ ...newGateData, authorizedNumber: e.target.value })}
                  placeholder="+972541231231"
                  required
                  disabled={isSubmitting}
                />
              )}
              <small>
                <Users className="icon-small" />
                {verifiedCallers.length > 0
                  ? 'מספר הטלפון שיכול לפתוח שער זה (נבחר מרשימת המספרים המורשים ב-Twilio)'
                  : 'מספר הטלפון שיכול לפתוח שער זה'
                }
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="editGatePassword">סיסמת שער (אופציונלי)</label>
              <input
                type="password"
                id="editGatePassword"
                value={newGateData.password}
                onChange={(e) => setNewGateData({ ...newGateData, password: e.target.value })}
                placeholder="השאר ריק ללא סיסמה"
                disabled={isSubmitting}
              />
              <small>
                <Shield className="icon-small" />
                אם מוגדרת סיסמה, היא תידרש כדי לפתוח את השער. השאר ריק אם השער לא דורש סיסמה.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="editAdminPassword">סיסמת מנהל</label>
              <input
                type="password"
                id="editAdminPassword"
                value="••••••••••"
                placeholder="הסיסמה כבר אומתה"
                required
                disabled
              />
              <small><Shield className="icon-small" /> הסיסמה כבר אומתה</small>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'מעדכן...' : 'עדכן שער'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="gates-grid">
        {gates.map(gate => (
          <div key={gate.id} className="gate-card">
            <div className="gate-header">
              <h3>{gate.name}</h3>
              {isAdminLoggedIn && (
                <div className="gate-actions-header">
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => handleEditButtonClick(gate)}
                    title="ערוך שער"
                    disabled={isSubmitting}
                  >
                    <Edit className="btn-icon" />
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => handleDeleteButtonClick(gate)}
                    title="מחק שער"
                    disabled={isSubmitting}
                  >
                    <Trash2 className="btn-icon" />
                  </button>
                </div>
              )}
            </div>

            <div className="gate-info">
              <p><Phone className="icon-small" /> <strong>מספר השער:</strong> {gate.phoneNumber}</p>
              <p><Clock className="icon-small" /> <strong>נפתח לאחרונה:</strong> {formatDate(gate.lastOpenedAt)}</p>
              {gate.lastCallStatus && (
                <p><Activity className="icon-small" /> <strong>סטטוס שיחה אחרונה:</strong> {gate.lastCallStatus}</p>
              )}
              {gate.password && (
                <p><Shield className="icon-small" /> <strong>מצב אבטחה:</strong> <span className="security-status protected">מוגן בסיסמה</span></p>
              )}
            </div>

            <div className="gate-authorized">
              <h4><Users className="icon-small" /> מספר מורשה</h4>
              <div className="authorized-numbers">
                {isAdminLoggedIn ? (
                  <span className="authorized-number">
                    {gate.authorizedNumber}
                  </span>
                ) : (
                  <span className="authorized-number hidden">
                    ••••••••••
                  </span>
                )}
              </div>
              {!isAdminLoggedIn && (
                <small className="password-notice">
                  התחבר כמנהל כדי לצפות במספרים המורשים
                </small>
              )}
            </div>

            <div className="gate-actions">
              {(() => {
                const isInCooldown = remainingCooldownSeconds > 0;
                
                return (
                  <button
                    className={`btn ${isInCooldown ? 'btn-secondary' : 'btn-primary'} gate-open-btn`}
                    onClick={() => handleOpenGate(gate)}
                    disabled={isSubmitting || isInCooldown}
                    title={isInCooldown ? `נדרש להמתין ${remainingCooldownSeconds} שניות` : 'פתח שער'}
                  >
                    <DoorOpen className="btn-icon" />
                    {isSubmitting ? 'פותח...' : isInCooldown ? `המתן ${remainingCooldownSeconds}s` : 'פתח שער'}
                  </button>
                );
              })()}
            </div>
          </div>
        ))}
      </div>

      {gates.length === 0 && (
        <div className="no-gates">
          <div className="no-gates-icon">🚪</div>
          <h3>לא נמצאו שערים</h3>
          <p>התחל על ידי הוספת השער הראשון למערכת</p>
          {isAdminLoggedIn && (
            <button
              className="btn btn-primary"
              onClick={handleAddButtonClick}
              disabled={isSubmitting}
              title="הוסף את השער הראשון שלך"
            >
              <Plus className="btn-icon" />
              הוסף את השער הראשון שלך
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GateDashboard;