import React, { useState, useEffect, useCallback, useRef } from 'react';
import GateHistory from './GateHistory';
import CallerIdValidation from './CallerIdValidation';
import { isSessionExpired, handleSessionExpiration } from '../utils/auth';

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
  
  // Refs for scrolling to errors
  const errorRef = useRef(null);
  const successRef = useRef(null);

  const fetchGates = useCallback(async () => {
    try {
      const response = await fetch('/api/gates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
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
        setError(errorData.error || 'שגיאה בטעינת שערים');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error fetching gates:', error);
      setError('שגיאת רשת');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const fetchVerifiedCallers = useCallback(async () => {
    try {
      const response = await fetch('/api/twilio/verified-callers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
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
  }, [token]);

  useEffect(() => {
    fetchGates();
    if (user?.role === 'admin') {
      fetchVerifiedCallers();
    }
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
    const calculateCooldowns = () => {
      const now = Date.now();
      const COOLDOWN_MS = 30 * 1000; // 30 seconds
      
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
    };

    // Calculate initial cooldowns
    calculateCooldowns();

    // Update timer every second
    const interval = setInterval(calculateCooldowns, 1000);

    return () => clearInterval(interval);
  }, [gates]);



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

  const handleOpenGate = async (gate, password = '') => {
    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/gates/${gate.id}/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(`פותח שער "${gate.name}" באמצעות שיחת טלפון`);
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
        setError(data.error || 'שגיאה בפתיחת השער');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error opening gate:', error);
      setError('שגיאת רשת');
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
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newGateData)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(editingGate 
          ? `שער "${newGateData.name}" עודכן בהצלחה!` 
          : `שער "${newGateData.name}" נוסף בהצלחה!`
        );
        scrollToMessage('success');
        setShowAddGate(false);
        setEditingGate(null);
        setNewGateData({
          name: '',
          phoneNumber: '',
          authorizedNumber: '',
          password: ''
        });
        await fetchGates();
      } else {
        setError(data.error || 'שגיאה בשמירת השער');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error saving gate:', error);
      setError('שגיאת רשת');
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
    setShowAddGate(true);
  };

  const handleDelete = async (gateId, gateName) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את השער "${gateName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/gates/${gateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSuccessMessage(`שער "${gateName}" נמחק בהצלחה!`);
        scrollToMessage('success');
        await fetchGates();
      } else {
        const data = await response.json();
        setError(data.error || 'שגיאה במחיקת השער');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error deleting gate:', error);
      setError('שגיאת רשת');
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
                onClick={() => setShowAddGate(true)}
                className="btn btn-primary"
              >
                <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>הוסף שער חדש</span>
              </button>
              

              
              <button
                onClick={() => setShowCallerIdValidation(true)}
                className="btn btn-secondary"
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

      {/* Error Message */}
      {error && (
        <div className="error-message" ref={errorRef}>
          <span>{error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
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

      {/* No Gates State */}
      {!showAddGate && gates.length === 0 && (
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

      {/* Gates Grid */}
      {!showAddGate && gates.length > 0 && (
        <div className="gates-grid">
          {gates.map(gate => (
            <div key={gate.id} className="gate-card">
              <div className="gate-header">
                <h3>{gate.name}</h3>
                <div className="gate-actions-header">
                  {user?.role === 'admin' && (
                    <>
                      <button
                        onClick={() => handleEdit(gate)}
                        className="btn btn-small"
                      >
                        ערוך
                      </button>
                      <button
                        onClick={() => handleDelete(gate.id, gate.name)}
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
                      : gate.authorizedNumber.replace(/\d/g, '*')
                    }
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
                    onClick={() => handleOpenGateClick(gate)}
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>נסה שוב בעוד {cooldowns[gate.id]} שניות</span>
                      </>
                    ) : (
                      <>
                        <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span>פתח שער</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
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

      {/* Caller ID Validation Modal */}
      {showCallerIdValidation && (
        <CallerIdValidation
          token={token}
          onClose={() => setShowCallerIdValidation(false)}
        />
      )}


    </div>
  );
};

export default GateDashboard;