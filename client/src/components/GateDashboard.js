import React, { useState, useEffect } from 'react';
import { DoorOpen, Users, Edit, Trash2, Plus, ShoppingBag, Shield, Phone, Clock, Activity } from 'lucide-react';
import axios from 'axios';

const GateDashboard = () => {
  // State
  const [gates, setGates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddGate, setShowAddGate] = useState(false);
  const [editingGate, setEditingGate] = useState(null);
  const [newGateData, setNewGateData] = useState({
    name: '',
    phoneNumber: '',
    authorizedNumber: ''
  });
  const [globalPassword, setGlobalPassword] = useState('');
  const [twilioBalance, setTwilioBalance] = useState(null);
  const [verifiedCallers, setVerifiedCallers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Effects
  useEffect(() => {
    fetchGates();
    checkSystemStatus(); // Check system configuration
  }, []);

  useEffect(() => {
    if (globalPassword) {
      fetchTwilioBalance(globalPassword);
      fetchVerifiedCallers(globalPassword); // Fetch verified callers when password is set
    }
  }, [globalPassword]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

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
      console.log('System status:', response.data);

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

  const fetchTwilioBalance = async (password = globalPassword) => {
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
  };

  const fetchVerifiedCallers = async (password = globalPassword) => {
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
  };

  // Password validation
  const validatePassword = async (password) => {
    try {
      await axios.get('/api/twilio/balance', {
        headers: { 'x-admin-password': password }
      });
      setGlobalPassword(password);
      fetchTwilioBalance(password); // Pass the password to fetch balance
      fetchVerifiedCallers(password); // Also fetch verified callers
      return true;
    } catch {
      alert('סיסמת מנהל לא תקינה. אנא נסה שוב.');
      return false;
    }
  };

  // Gate operations
  const handleOpenGate = async (gate) => {
    try {
      setIsSubmitting(true);
      await axios.post(`/api/gates/${gate.id}/open`);
      fetchGates();
      setSuccessMessage(`🚪 פותח שער "${gate.name}" באמצעות שיחת טלפון ל-${gate.phoneNumber}`);
    } catch (error) {
      setError('נכשל בפתיחת השער');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditGate = (gate) => {
    setEditingGate(gate);
    setNewGateData({
      name: gate.name,
      phoneNumber: gate.phoneNumber,
      authorizedNumber: gate.authorizedNumber
    });
  };

  const handleUpdateGate = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await axios.put(`/api/gates/${editingGate.id}`, newGateData, {
        headers: { 'x-admin-password': globalPassword }
      });

      setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '' });
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

  const handleDeleteGate = async (gate, password) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את השער "${gate.name}"?`)) {
      try {
        setIsSubmitting(true);
        await axios.delete(`/api/gates/${gate.id}`, {
          headers: { 'x-admin-password': password }
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
        headers: { 'x-admin-password': globalPassword }
      });

      setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '' });
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
    setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '' });
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingGate(null);
    setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '' });
    setError('');
  };

  // Button click handlers
  const handleAddButtonClick = async () => {
    if (!globalPassword) {
      const password = prompt('הכנס סיסמת מנהל כדי להוסיף שערים חדשים:');
      if (password && await validatePassword(password)) {
        setShowAddGate(true);
      }
    } else {
      setShowAddGate(true);
    }
  };

  const handleEditButtonClick = async (gate) => {
    if (!globalPassword) {
      const password = prompt(`הכנס סיסמת מנהל כדי לערוך את השער "${gate.name}":`);
      if (password && await validatePassword(password)) {
        handleEditGate(gate);
      }
    } else {
      handleEditGate(gate);
    }
  };

  const handleDeleteButtonClick = async (gate) => {
    if (!globalPassword) {
      const password = prompt(`הכנס סיסמת מנהל כדי למחוק את השער "${gate.name}":`);
      if (password && await validatePassword(password)) {
        // Pass the password directly instead of relying on state update
        handleDeleteGate(gate, password);
      }
    } else {
      handleDeleteGate(gate, globalPassword);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'מעולם לא';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'היום';
    if (diffDays === 2) return 'אתמול';
    if (diffDays <= 7) return `לפני ${diffDays - 1} ימים`;

    return date.toLocaleDateString('he-IL');
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
          <span className="admin-notice">
            <Shield className="icon-small" />
            נדרש גישת מנהל כדי להוסיף, לערוך או למחוק שערים
          </span>

          {/* Show Twilio Balance only if password is verified */}
          {globalPassword && (
            <div className="admin-status-section">
              <span className="password-status">
                <Shield className="icon-small" />
                סיסמת מנהל אומתה - כעת תוכל לנהל שערים
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
        </div>
        <button
          className="btn btn-primary"
          onClick={handleAddButtonClick}
          disabled={isSubmitting}
        >
          <Plus className="btn-icon" />
          הוסף שער חדש
        </button>
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
                  placeholder="+972542070400"
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
                  placeholder="+972542070400"
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
            </div>

            <div className="gate-info">
              <p><Phone className="icon-small" /> <strong>מספר השער:</strong> {gate.phoneNumber}</p>
              <p><Clock className="icon-small" /> <strong>נפתח לאחרונה:</strong> {formatDate(gate.lastOpenedAt)}</p>
              {gate.lastCallStatus && (
                <p><Activity className="icon-small" /> <strong>סטטוס שיחה אחרונה:</strong> {gate.lastCallStatus}</p>
              )}
            </div>

            <div className="gate-authorized">
              <h4><Users className="icon-small" /> מספר מורשה</h4>
              <div className="authorized-numbers">
                {globalPassword ? (
                  <span className="authorized-number">
                    {gate.authorizedNumber}
                  </span>
                ) : (
                  <span className="authorized-number hidden">
                    ••••••••••
                  </span>
                )}
              </div>
              {!globalPassword && (
                <small className="password-notice">
                  הכנס סיסמת מנהל כדי לצפות במספרים המורשים
                </small>
              )}
            </div>

            <div className="gate-actions">
              <button
                className="btn btn-primary gate-open-btn"
                onClick={() => handleOpenGate(gate)}
                disabled={isSubmitting}
              >
                <DoorOpen className="btn-icon" />
                {isSubmitting ? 'פותח...' : 'פתח שער'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {gates.length === 0 && (
        <div className="no-gates">
          <div className="no-gates-icon">🚪</div>
          <h3>לא נמצאו שערים</h3>
          <p>התחל על ידי הוספת השער הראשון למערכת</p>
          <button
            className="btn btn-primary"
            onClick={handleAddButtonClick}
            disabled={isSubmitting}
          >
            <Plus className="btn-icon" />
            הוסף את השער הראשון שלך
          </button>
        </div>
      )}
    </div>
  );
};

export default GateDashboard;
