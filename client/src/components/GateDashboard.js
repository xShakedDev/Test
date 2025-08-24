import React, { useState, useEffect, useCallback, useRef } from 'react';
import GateHistory from './GateHistory';
import CallerIdValidation from './CallerIdValidation';
import { isSessionExpired, handleSessionExpiration, authenticatedFetch } from '../utils/auth';

const GateDashboard = ({ user, token }) => {
  const [gates, setGates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddGate, setShowAddGate] = useState(false);
  const [editingGate, setEditingGate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCallerIdValidation, setShowCallerIdValidation] = useState(false);
  const [newGateData, setNewGateData] = useState({
    name: '',
    phoneNumber: '',
    authorizedNumber: '',
    password: ''
  });
  const [verifiedCallers, setVerifiedCallers] = useState([]);
  const [cooldowns, setCooldowns] = useState({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [selectedGate, setSelectedGate] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Refs for scrolling to errors
  const errorRef = useRef(null);
  const successRef = useRef(null);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchGates = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/gates');
      
      if (response.ok) {
        const data = await response.json();
        setGates(data.gates || []);
        setError('');
      } else {
        const errorData = await response.json();
        if (isSessionExpired(errorData)) {
          handleSessionExpiration();
          return;
        }
        const msg = errorData.error || 'שגיאה בטעינת שערים';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error fetching gates:', error);
      const msg = 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchVerifiedCallers = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/twilio/verified-callers');
      
      if (response.ok) {
        const data = await response.json();
        setVerifiedCallers(data.callerIds || []);
      } else {
        const errorData = await response.json();
        console.error('Error fetching verified callers:', errorData);
      }
    } catch (error) {
      console.error('Error fetching verified callers:', error);
    }
  }, []);

  useEffect(() => {
    fetchGates();
    if (user?.role === 'admin') {
      fetchVerifiedCallers();
    }
  }, [fetchGates, fetchVerifiedCallers, user]);

  // Auto-refresh functionality based on admin settings
  useEffect(() => {
    let refreshInterval;
    
    const setupAutoRefresh = async () => {
      try {
        const response = await authenticatedFetch('/api/settings/current');
        if (response.ok) {
          const data = await response.json();
          const { autoRefreshInterval } = data.settings;
          
          if (autoRefreshInterval && autoRefreshInterval > 0) {
            refreshInterval = setInterval(() => {
              fetchGates();
              if (user?.role === 'admin') {
                fetchVerifiedCallers();
              }
            }, autoRefreshInterval * 60 * 1000); // Convert minutes to milliseconds
          }
        }
      } catch (error) {
        console.error('Error fetching auto-refresh settings:', error);
      }
    };
    
    setupAutoRefresh();
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [fetchGates, fetchVerifiedCallers, user]);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error]);

  // Function to scroll to error or success message
  const scrollToMessage = (type) => {
    const ref = type === 'error' ? errorRef : successRef;
    if (ref.current) {
      ref.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
    }
  };

  // Calculate cooldowns and update timer every second
  useEffect(() => {
    let cooldownInterval;
    
    const calculateCooldowns = async () => {
      try {
        // Get cooldown setting from admin settings
        const response = await authenticatedFetch('/api/settings/current');
        if (response.ok) {
          const data = await response.json();
          const { gateCooldownSeconds } = data.settings;
          
          const now = Date.now();
          const COOLDOWN_MS = (gateCooldownSeconds || 30) * 1000; // Use setting or default to 30 seconds
          
          const newCooldowns = {};
          gates.forEach(gate => {
            if (gate.lastOpenedAt) {
              const timeSinceLastOpen = now - new Date(gate.lastOpenedAt).getTime();
              if (timeSinceLastOpen < COOLDOWN_MS) {
                newCooldowns[gate.id] = Math.ceil((COOLDOWN_MS - timeSinceLastOpen) / 1000);
              }
            }
          });
          
          setCooldowns(newCooldowns);
        }
      } catch (error) {
        console.error('Error fetching cooldown settings:', error);
        // Fallback to default cooldown
        const now = Date.now();
        const COOLDOWN_MS = 30 * 1000; // 30 seconds default
        
        const newCooldowns = {};
        gates.forEach(gate => {
          if (gate.lastOpenedAt) {
            const timeSinceLastOpen = now - new Date(gate.lastOpenedAt).getTime();
            if (timeSinceLastOpen < COOLDOWN_MS) {
              newCooldowns[gate.id] = Math.ceil((COOLDOWN_MS - timeSinceLastOpen) / 1000);
            }
          }
        });
        
        setCooldowns(newCooldowns);
      }
    };

    // Calculate initial cooldowns
    calculateCooldowns();

    // Update timer every second
    cooldownInterval = setInterval(calculateCooldowns, 1000);

    return () => {
      if (cooldownInterval) {
        clearInterval(cooldownInterval);
      }
    };
  }, [gates]);

  // Check notification settings
  useEffect(() => {
    const checkNotificationSettings = async () => {
      try {
        const response = await authenticatedFetch('/api/settings/current');
        if (response.ok) {
          const data = await response.json();
          setNotificationsEnabled(data.settings?.enableNotifications || false);
        }
      } catch (error) {
        console.error('Error fetching notification settings:', error);
      }
    };
    
    checkNotificationSettings();
  }, []);

  // Refresh verified callers when CallerIdValidation component is opened
  useEffect(() => {
    if (showCallerIdValidation && user?.role === 'admin') {
      fetchVerifiedCallers();
    }
  }, [showCallerIdValidation, user, fetchVerifiedCallers]);

  // Refresh verified callers when add/edit gate form is opened
  useEffect(() => {
    if (showAddGate && user?.role === 'admin') {
      fetchVerifiedCallers();
    }
  }, [showAddGate, user, fetchVerifiedCallers]);

  // Refresh verified callers when editing a gate
  useEffect(() => {
    if (editingGate && user?.role === 'admin') {
      fetchVerifiedCallers();
    }
  }, [editingGate, user, fetchVerifiedCallers]);

  // Refresh verified callers when history component is opened
  useEffect(() => {
    if (showHistory && user?.role === 'admin') {
      fetchVerifiedCallers();
    }
  }, [showHistory, user, fetchVerifiedCallers]);

  // Refresh verified callers when a single gate is selected (mobile view)
  useEffect(() => {
    if (selectedGate && user?.role === 'admin') {
      fetchVerifiedCallers();
    }
  }, [selectedGate, user, fetchVerifiedCallers]);


  const handleOpenGateClick = (gate) => {
    if (gate.password) {
      // Show password prompt for protected gates
      const password = prompt(`הכנס סיסמה לפתיחת השער "${gate.name}":`);
      if (password !== null) { // User didn't cancel
        handleOpenGate(gate, password);
      }
    } else {
      // Open gate directly for unprotected gates
      handleOpenGate(gate, '');
    }
  };

  const handleGateSelect = (gate) => {
    if (isMobile) {
      setSelectedGate(gate);
    }
  };

  const handleBackToGates = () => {
    setSelectedGate(null);
  };

  const handleOpenGate = async (gate, password = '') => {
    try {
      setIsSubmitting(true);
      const response = await authenticatedFetch(`/api/gates/${gate.id}/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (response.ok) {
        const msg = `פותח שער "${gate.name}" באמצעות שיחת טלפון`;
        setSuccessMessage(msg);
        if (window.showSystemNotification) window.showSystemNotification(`שער "${gate.name}" נפתח בהצלחה`, 'success');
        scrollToMessage('success');
        
        // Update cooldown immediately
        setCooldowns(prev => ({
          ...prev,
          [gate.id]: 30
        }));
        await fetchGates();
      } else {
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }
        
        // Handle specific error cases
        if (response.status === 503 && data.error === 'המערכת בתחזוקה') {
          const msg = `המערכת בתחזוקה: ${data.message || 'נסה שוב מאוחר יותר'}`;
          setError(msg);
          if (window.showSystemNotification) window.showSystemNotification(msg, 'warning');
        } else if (response.status === 429) {
          if (data.error === 'דילאי פעיל') {
            const msg = `דילאי פעיל: ${data.message}`;
            setError(msg);
            // Update cooldown with remaining time
            if (data.remainingTime) {
              setCooldowns(prev => ({
                ...prev,
                [gate.id]: data.remainingTime
              }));
            }
            if (window.showSystemNotification) window.showSystemNotification(msg, 'warning');
          } else if (data.error === 'חריגה ממספר הניסיונות') {
            const msg = `חריגה ממספר הניסיונות: ${data.message}`;
            setError(msg);
            if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
          } else {
            const msg = data.error || 'יותר מדי בקשות - נסה שוב מאוחר יותר';
            setError(msg);
            if (window.showSystemNotification) window.showSystemNotification(msg, 'warning');
          }
        } else if (response.status === 402 && data.error === 'יתרת Twilio נמוכה') {
          const msg = data.message || 'לשקד תכף נגמר הכסף תפקידו לו';
          setError(msg);
          if (window.showSystemNotification) window.showSystemNotification(msg, 'warning');
        } else {
          const msg = data.error || 'שגיאה בפתיחת השער';
          setError(msg);
          if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
        }
        
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error opening gate:', error);
      const msg = 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification('שגיאת רשת בפתיחת השער', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewGateData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingGate 
        ? `/api/gates/${editingGate.id}` 
        : '/api/gates';
      
      const method = editingGate ? 'PUT' : 'POST';
      
      const response = await authenticatedFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newGateData)
      });

      const data = await response.json();

      if (response.ok) {
        const msg = editingGate 
          ? `שער "${newGateData.name}" עודכן בהצלחה!` 
          : `שער "${newGateData.name}" נוסף בהצלחה!`;
        setSuccessMessage(msg);
        if (window.showSystemNotification) window.showSystemNotification(editingGate ? `שער "${newGateData.name}" עודכן בהצלחה` : `שער "${newGateData.name}" נוסף בהצלחה`, 'success');
        scrollToMessage('success');
        
        setShowAddGate(false);
        setEditingGate(null);
        setNewGateData({
          name: '',
          phoneNumber: '',
          authorizedNumber: '',
          password: ''
        });
        
        // Refresh both gates and verified callers to ensure data consistency
        await fetchGates();
        if (user?.role === 'admin') {
          await fetchVerifiedCallers();
        }
      } else {
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }
        const msg = data.error || 'שגיאה בשמירת השער';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(`שגיאה בשמירת השער: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error saving gate:', error);
      const msg = 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification('שגיאת רשת בשמירת השער', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (gate) => {
    setEditingGate(gate);
    setNewGateData({
      name: gate.name,
      phoneNumber: gate.phoneNumber,
      authorizedNumber: gate.authorizedNumber,
      password: gate.password || ''
    });
  };

  const handleDelete = async (gateId, gateName) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את השער "${gateName}"?`)) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/gates/${gateId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const msg = `שער "${gateName}" נמחק בהצלחה!`;
        setSuccessMessage(msg);
        if (window.showSystemNotification) window.showSystemNotification(`שער "${gateName}" נמחק בהצלחה`, 'info');
        scrollToMessage('success');
        
        await fetchGates();
      } else {
        const data = await response.json();
        const msg = data.error || 'שגיאה במחיקת השער';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(`שגיאה במחיקת השער: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error deleting gate:', error);
      const msg = 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification('שגיאת רשת במחיקת השער', 'error');
    }
  };

  const handleCancel = () => {
    setShowAddGate(false);
    setEditingGate(null);
    setNewGateData({
      name: '',
      phoneNumber: '',
      authorizedNumber: '',
      password: ''
    });
  };

  const handleOpenCallerIdValidation = async () => {
    // Refresh verified callers before opening the validation component
    if (user?.role === 'admin') {
      await fetchVerifiedCallers();
    }
    setShowCallerIdValidation(true);
  };

  const handleCloseCallerIdValidation = () => {
    setShowCallerIdValidation(false);
    // Refresh verified callers after closing to get any updates
    if (user?.role === 'admin') {
      fetchVerifiedCallers();
    }
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
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div>
          <h1>שערים</h1>
          <p>
            {user?.role === 'admin' 
              ? 'ניהול שערים במערכת - הוסף, ערוך ומחק שערים' 
              : 'צפייה בשערים זמינים במערכת'
            }
          </p>
          
          {user?.role === 'admin' && (
            <div className="admin-actions">
              <button
                onClick={() => {
                  setEditingGate(null);
                  setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '', password: '' });
                  setShowAddGate(true);
                }}
                className="btn btn-primary"
              >
                <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>הוסף שער חדש</span>
              </button>
              
              <button
                onClick={handleOpenCallerIdValidation}
                className="btn btn-primary"
              >
                <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>אימות מספרי טלפון</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Message - Only show if notifications are disabled */}
      {error && !notificationsEnabled && (
        <div className="error-message" ref={errorRef}>
          <span>{error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Success Message - Only show if notifications are disabled */}
      {successMessage && !notificationsEnabled && (
        <div className="success-message" ref={successRef}>
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')}>✕</button>
        </div>
      )}

      {/* Add/Edit Gate Form */}
      {showAddGate && (
        <div className="form-container">
          <h3>{editingGate ? 'ערוך שער' : 'הוסף שער חדש'}</h3>
          <p>{editingGate ? 'עדכן את פרטי השער' : 'מלא את הפרטים להוספת שער חדש למערכת'}</p>
          
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="name">שם השער *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={newGateData.name}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting}
                />
                <small>שם ייחודי לזיהוי השער במערכת</small>
              </div>

              <div className="form-group">
                <label htmlFor="phoneNumber">מספר טלפון *</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={newGateData.phoneNumber}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting}
                />
                <small>מספר הטלפון של השער (למשל: 03-1234567)</small>
              </div>

              <div className="form-group">
                <label htmlFor="authorizedNumber">מספר מורשה *</label>
                <select
                  id="authorizedNumber"
                  name="authorizedNumber"
                  value={newGateData.authorizedNumber}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting}
                >
                  <option value="">בחר מספר מורשה</option>
                  {verifiedCallers.map(caller => (
                    <option key={caller.phoneNumber} value={caller.phoneNumber}>
                      {caller.phoneNumber} {caller.friendlyName ? `(${caller.friendlyName})` : ''}
                    </option>
                  ))}
                </select>
                <small>בחר מספר טלפון מורשה מ-Twilio לפתיחת השער</small>
              </div>

              <div className="form-group">
                <label htmlFor="password">סיסמה (אופציונלי)</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={newGateData.password}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                />
                <small>סיסמה להגנה על השער (ריק = ללא הגנה)</small>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={handleCancel}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                ביטול
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'שומר...' : (editingGate ? 'עדכן' : 'הוסף')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mobile: Show selected gate details */}
      {isMobile && selectedGate && (
        <div className="mobile-gate-detail">
          <div className="mobile-gate-header">
            <button onClick={handleBackToGates} className="btn btn-secondary btn-back">
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              חזור לשערים
            </button>
            <h2>{selectedGate.name}</h2>
          </div>
          
          {editingGate && selectedGate && editingGate.id === selectedGate.id && (
            <div className="mobile-gate-content">
              <div className="gate-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>ערוך שער</h3>
                <button
                  onClick={handleCancel}
                  className="btn btn-secondary btn-small"
                >
                  חזרה
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="name">שם השער *</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={newGateData.name}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                    />
                    <small>שם ייחודי לזיהוי השער במערכת</small>
                  </div>
                  <div className="form-group">
                    <label htmlFor="phoneNumber">מספר טלפון *</label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      value={newGateData.phoneNumber}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                    />
                    <small>מספר הטלפון של השער (למשל: 03-1234567)</small>
                  </div>
                  <div className="form-group">
                    <label htmlFor="authorizedNumber">מספר מורשה *</label>
                    <select
                      id="authorizedNumber"
                      name="authorizedNumber"
                      value={newGateData.authorizedNumber}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                    >
                      <option value="">בחר מספר מורשה</option>
                      {verifiedCallers.map(caller => (
                        <option key={caller.phoneNumber} value={caller.phoneNumber}>
                          {caller.phoneNumber} {caller.friendlyName ? `(${caller.friendlyName})` : ''}
                        </option>
                      ))}
                    </select>
                    <small>בחר מספר טלפון מורשה מ-Twilio לפתיחת השער</small>
                  </div>
                  <div className="form-group">
                    <label htmlFor="password">סיסמה (אופציונלי)</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={newGateData.password}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                    />
                    <small>סיסמה להגנה על השער (ריק = ללא הגנה)</small>
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="btn btn-secondary"
                    disabled={isSubmitting}
                  >
                    חזרה
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'שומר...' : 'עדכן'}
                  </button>
                </div>
              </form>
            </div>
          )}
          {!(editingGate && selectedGate && editingGate.id === selectedGate.id) && (
          <div className="mobile-gate-content">
            <div className="gate-info">
              <p><strong>מספר טלפון:</strong> {selectedGate.phoneNumber}</p>
              <p><strong>הגנה:</strong> {selectedGate.password ? 'מוגן' : 'לא מוגן'}</p>
            </div>

            <div className="gate-authorized">
              <h4>
                <svg className="icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                מספר מורשה לפתיחה
              </h4>
              <div className="authorized-numbers">
                <span className="authorized-number">
                  {user?.role === 'admin'
                    ? selectedGate.authorizedNumber
                    : '***********'}
                </span>
              </div>
              <p className="password-notice">
                {selectedGate.password 
                  ? 'שער זה מוגן בסיסמה - תצטרך להזין אותה בעת הפתיחה' 
                  : 'שער זה אינו מוגן בסיסמה - ניתן לפתוח ישירות'
                }
              </p>
            </div>

            <div className="gate-actions">
              <div className="gate-open-section">
                {/* Cooldown indicator */}
                {cooldowns[selectedGate.id] && (
                  <div className="cooldown-indicator">
                    <svg className="cooldown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>השער נפתח לאחרונה - נסה שוב בעוד {cooldowns[selectedGate.id]} שניות</span>
                  </div>
                )}
                
                <button
                  onClick={() => handleOpenGateClick(selectedGate)}
                  disabled={isSubmitting || cooldowns[selectedGate.id]}
                  className={`btn ${cooldowns[selectedGate.id] ? 'btn-secondary cooldown' : 'btn-primary'} gate-open-btn`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      <span>פותח...</span>
                    </>
                  ) : cooldowns[selectedGate.id] ? (
                    <>
                      <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4ל3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>נסה שוב בעוד {cooldowns[selectedGate.id]} שניות</span>
                    </>
                  ) : (
                    <>
                      <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11ל2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span>פתח שער</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {user?.role === 'admin' && (
              <div className="mobile-admin-actions">
                <button
                  onClick={() => handleEdit(selectedGate)}
                  className="btn btn-primary"
                >
                  ערוך שער
                </button>
                <button
                  onClick={() => handleDelete(selectedGate.id, selectedGate.name)}
                  className="btn btn-danger"
                >
                  מחק שער
                </button>
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* No Gates State */}
      {!showAddGate && !showCallerIdValidation && !selectedGate && gates.length === 0 && (
        <div className="no-gates">
          <div className="no-gates-icon">🚪</div>
          <h3>אין שערים במערכת</h3>
          <p>
            {user?.role === 'admin' 
              ? 'התחל על ידי הוספת שער ראשון למערכת' 
              : 'אין שערים זמינים כרגע במערכת'
            }
          </p>
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowAddGate(true)}
              className="btn btn-primary"
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>הוסף שער ראשון</span>
            </button>
          )}
        </div>
      )}

      {/* Gates Grid - Show compact cards on mobile, full cards on desktop */}
      {!showAddGate && !showCallerIdValidation && !selectedGate && gates.length > 0 && (
        <div className={`gates-grid ${isMobile ? 'gates-grid-mobile' : ''}`}>
          {gates.map(gate => (
            <div 
              key={gate.id} 
              className={`gate-card ${isMobile ? 'gate-card-mobile' : ''}`}
              onClick={() => handleGateSelect(gate)}
            >
              {isMobile ? (
                // Mobile: Compact card with just gate name
                <div className="gate-card-mobile-content">
                  <div className="gate-name-with-icon">
                    <h3>{gate.name}</h3>
                    <svg className="gate-icon-mobile" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11ל2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  <div className="gate-status">
                    {gate.password ? (
                      <span className="status-protected">🔒 מוגן</span>
                    ) : (
                      <span className="status-unprotected">🔓 לא מוגן</span>
                    )}
                    {cooldowns[gate.id] && (
                      <span className="status-cooldown">⏰ {cooldowns[gate.id]}s</span>
                    )}
                  </div>
                  <div className="gate-arrow">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ) : (
                // Desktop: Full card or inline edit when editing this gate
                <>
                  {editingGate && editingGate.id === gate.id ? (
                    <div className="form-container" onClick={(e) => e.stopPropagation()}>
                      <div className="gate-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>ערוך שער</h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                          className="btn btn-secondary btn-small"
                        >
                          חזרה
                        </button>
                      </div>
                      <form onSubmit={handleSubmit}>
                        <div className="form-grid">
                          <div className="form-group">
                            <label htmlFor="name">שם השער *</label>
                            <input
                              type="text"
                              id="name"
                              name="name"
                              value={newGateData.name}
                              onChange={handleInputChange}
                              required
                              disabled={isSubmitting}
                            />
                            <small>שם ייחודי לזיהוי השער במערכת</small>
                          </div>

                          <div className="form-group">
                            <label htmlFor="phoneNumber">מספר טלפון *</label>
                            <input
                              type="tel"
                              id="phoneNumber"
                              name="phoneNumber"
                              value={newGateData.phoneNumber}
                              onChange={handleInputChange}
                              required
                              disabled={isSubmitting}
                            />
                            <small>מספר הטלפון של השער (למשל: 03-1234567)</small>
                          </div>

                          <div className="form-group">
                            <label htmlFor="authorizedNumber">מספר מורשה *</label>
                            <select
                              id="authorizedNumber"
                              name="authorizedNumber"
                              value={newGateData.authorizedNumber}
                              onChange={handleInputChange}
                              required
                              disabled={isSubmitting}
                            >
                              <option value="">בחר מספר מורשה</option>
                              {verifiedCallers.map(caller => (
                                <option key={caller.phoneNumber} value={caller.phoneNumber}>
                                  {caller.phoneNumber} {caller.friendlyName ? `(${caller.friendlyName})` : ''}
                                </option>
                              ))}
                            </select>
                            <small>בחר מספר טלפון מורשה מ-Twilio לפתיחת השער</small>
                          </div>

                          <div className="form-group">
                            <label htmlFor="password">סיסמה (אופציונלי)</label>
                            <input
                              type="password"
                              id="password"
                              name="password"
                              value={newGateData.password}
                              onChange={handleInputChange}
                              disabled={isSubmitting}
                            />
                            <small>סיסמה להגנה על השער (ריק = ללא הגנה)</small>
                          </div>
                        </div>

                        <div className="form-actions">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                            className="btn btn-secondary"
                            disabled={isSubmitting}
                          >
                            חזרה
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? 'שומר...' : 'עדכן'}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <>
                      <div className="gate-header">
                        <h3>{gate.name}</h3>
                        <div className="gate-actions-header">
                          {user?.role === 'admin' && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(gate);
                                }}
                                className="btn btn-primary btn-small"
                              >
                                ערוך
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(gate.id, gate.name);
                                }}
                                className="btn btn-danger btn-small"
                              >
                                מחק
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="gate-info">
                        <p><strong>מספר טלפון:</strong> {gate.phoneNumber}</p>
                        <p><strong>הגנה:</strong> {gate.password ? 'מוגן' : 'לא מוגן'}</p>
                      </div>

                      <div className="gate-authorized">
                        <h4>
                          <svg className="icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          מספר מורשה לפתיחה
                        </h4>
                        <div className="authorized-numbers">
                          <span className="authorized-number">
                            {user?.role === 'admin'
                              ? gate.authorizedNumber
                              : '***********'}
                          </span>
                        </div>
                        <p className="password-notice">
                          {gate.password 
                            ? 'שער זה מוגן בסיסמה - תצטרך להזין אותה בעת הפתיחה' 
                            : 'שער זה אינו מוגן בסיסמה - ניתן לפתוח ישירות'
                          }
                        </p>
                      </div>

                      <div className="gate-actions">
                        <div className="gate-open-section">
                          {/* Cooldown indicator */}
                          {cooldowns[gate.id] && (
                            <div className="cooldown-indicator">
                              <svg className="cooldown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>השער נפתח לאחרונה - נסה שוב בעוד {cooldowns[gate.id]} שניות</span>
                            </div>
                          )}
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenGateClick(gate);
                            }}
                            disabled={isSubmitting || cooldowns[gate.id]}
                            className={`btn ${cooldowns[gate.id] ? 'btn-secondary cooldown' : 'btn-primary'} gate-open-btn`}
                          >
                            {isSubmitting ? (
                              <>
                                <div className="loading-spinner-small"></div>
                                <span>פותח...</span>
                              </>
                            ) : cooldowns[gate.id] ? (
                              <>
                                <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4ל3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>נסה שוב בעוד {cooldowns[gate.id]} שניות</span>
                              </>
                            ) : (
                              <>
                                <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11ל2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                <span>פתח שער</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Gate History Modal */}
      {showHistory && (
        <GateHistory
          token={token}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Caller ID Validation Inline (opens like add new gate) */}
      {showCallerIdValidation && !showAddGate && !selectedGate && (
        <div className="form-container">
          <CallerIdValidation
            token={token}
            mode="inline"
            onClose={handleCloseCallerIdValidation}
          />
        </div>
      )}
    </div>
  );
};

export default GateDashboard;