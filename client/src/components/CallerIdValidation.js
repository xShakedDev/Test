import React, { useState, useEffect } from 'react';
import { isSessionExpired, handleSessionExpiration, authenticatedFetch } from '../utils/auth';

const CallerIdValidation = ({ token, onClose, mode = 'modal' }) => {
  const isModal = mode !== 'inline';
  const [verifiedCallers, setVerifiedCallers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showValidationForm, setShowValidationForm] = useState(false);
  const [validationData, setValidationData] = useState({
    phoneNumber: '',
    friendlyName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [validationStatus, setValidationStatus] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    fetchVerifiedCallers();
    
    // Cleanup function to clear any pending timeouts
    return () => {
      if (window.validationTimeout) {
        clearTimeout(window.validationTimeout);
        window.validationTimeout = null;
      }
    };
  }, []);

  const fetchVerifiedCallers = async () => {
    try {
      const response = await authenticatedFetch('/api/twilio/verified-callers');

      if (response.ok) {
        const data = await response.json();
        setVerifiedCallers(data.callerIds || []);
        setError('');
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        
        if (isSessionExpired(errorData)) {
          handleSessionExpiration();
          return;
        }
        
        // More specific error handling
        if (response.status === 401) {
          setError('אין הרשאה - אנא התחבר מחדש');
        } else if (response.status === 403) {
          setError('אין הרשאה - נדרשת הרשאת מנהל');
        } else if (response.status === 500) {
          setError(`שגיאת שרת: ${errorData.error || 'שגיאה לא ידועה'}`);
        } else {
          setError(errorData.error || 'שגיאה בטעינת מספרי טלפון מורשים');
        }
      }
    } catch (error) {
      console.error('Network error fetching verified callers:', error);
      setError(`שגיאת רשת: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setValidationData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validationData.phoneNumber) {
      setError('נדרש מספר טלפון');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await authenticatedFetch('/api/twilio/validate-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validationData)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(data.message || 'בקשת אימות נשלחה בהצלחה');
        setValidationResult(data);
        setValidationData({ phoneNumber: '', friendlyName: '' });
        setShowValidationForm(false);
        
        // Show system notification if enabled
        if (window.showSystemNotification) {
          window.showSystemNotification(`בקשת אימות נשלחה למספר ${validationData.phoneNumber}`, 'info');
        }
        
        // Start checking validation status after 30 seconds
        if (data.validationSid) {
          window.validationTimeout = setTimeout(() => {
            checkValidationStatus();
          }, 30000);
        }
        
        // Refresh the list after a short delay to show immediate feedback
        setTimeout(() => {
          fetchVerifiedCallers();
        }, 2000);
      } else {
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }
        setError(data.error || 'שגיאה בשליחת בקשת אימות');
        
        // Show system notification if enabled
        if (window.showSystemNotification) {
          window.showSystemNotification(`שגיאה בשליחת בקשת אימות: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        }
      }
    } catch (error) {
      console.error('Error submitting validation request:', error);
      setError('שגיאת רשת');
      
      // Show system notification if enabled
      if (window.showSystemNotification) {
        window.showSystemNotification('שגיאת רשת בשליחת בקשת אימות', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkValidationStatus = async () => {
    try {
      setIsCheckingStatus(true);
      
      // Refresh the verified callers list to see if the phone number was verified
      const response = await authenticatedFetch('/api/twilio/verified-callers');

      if (response.ok) {
        const data = await response.json();
        const updatedCallers = data.callerIds || [];
        
        // Update the local state with fresh data
        setVerifiedCallers(updatedCallers);
        
        // Check if the phone number from validationResult exists in the updated list
        if (validationResult && validationResult.phoneNumber) {
          const isVerified = updatedCallers.some(caller => 
            caller.phoneNumber === validationResult.phoneNumber
          );
          
          if (isVerified) {
            setSuccessMessage('🎉 המספר אומת בהצלחה!');
            setValidationStatus({
              status: 'approved',
              message: 'המספר נמצא ברשימת המספרים המאומתים'
            });
            
            // Show system notification if enabled
            if (window.showSystemNotification) {
              window.showSystemNotification(`מספר ${validationResult.phoneNumber} אומת בהצלחה!`, 'success');
            }
          } else {
            setValidationStatus({
              status: 'pending',
              message: 'המספר עדיין לא אומת - יבדק שוב בעוד 30 שניות'
            });
            
            // Schedule another check in 30 seconds if not verified yet
            window.validationTimeout = setTimeout(() => {
              checkValidationStatus();
            }, 30000);
          }
        }
      } else {
        console.error('Failed to fetch updated callers list');
        setValidationStatus({
          status: 'error',
          message: 'שגיאה בבדיקת סטטוס האימות'
        });
      }
    } catch (error) {
      console.error('Error checking validation status:', error);
      setValidationStatus({
        status: 'error',
        message: 'שגיאה בבדיקת סטטוס האימות'
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleClose = () => {
    setError('');
    setSuccessMessage('');
    setShowValidationForm(false);
    setValidationData({ phoneNumber: '', friendlyName: '' });
    setValidationResult(null);
    setValidationStatus(null);
    
    // Clear any pending timeouts
    if (window.validationTimeout) {
      clearTimeout(window.validationTimeout);
      window.validationTimeout = null;
    }
    
    onClose();
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error]);

  // Remove the automatic timer for validation result
  // The user will manually close it when they're done

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

  if (isLoading) {
    return isModal ? (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>טוען מספרי טלפון מורשים...</p>
          </div>
        </div>
      </div>
    ) : (
      <div className="form-container caller-id-validation-inline">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>טוען מספרי טלפון מורשים...</p>
        </div>
      </div>
    );
  }

  return isModal ? (
    <div className="modal-overlay">
      <div className="modal-content caller-id-validation-modal">
        <div className="modal-header">
          <h2>אימות מספרי טלפון</h2>
          <button onClick={handleClose} className="modal-close-btn">✕</button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            ניהול מספרי טלפון מורשים לשיחות יוצאות ב-Twilio. 
            מספרים חדשים דורשים אימות לפני שימוש.
          </p>

          {error && !notificationsEnabled && (
            <div className="error-message">
              <span>{error}</span>
              <button onClick={() => setError('')}>✕</button>
            </div>
          )}

          {successMessage && !notificationsEnabled && (
            <div className="success-message">
              <span>{successMessage}</span>
              <button onClick={() => setSuccessMessage('')}>✕</button>
            </div>
          )}

          {validationResult && (
            <div className="validation-result">
              <h3>פרטי בקשת האימות</h3>
              <div className="validation-details">
                <div className="validation-item">
                  <strong>מספר טלפון:</strong> {validationResult.phoneNumber}
                </div>
                {validationResult.friendlyName && (
                  <div className="validation-item">
                    <strong>שם ידידותי:</strong> {validationResult.friendlyName}
                  </div>
                )}
                <div className="validation-item">
                  <strong>סטטוס:</strong> {validationResult.status}
                </div>
                {validationResult.validationCode && (
                  <div className="validation-item verification-code">
                    <strong>קוד האימות:</strong> 
                    <span className="code-display">{validationResult.validationCode}</span>
                    <small>הקש את הקוד בשיחה שתקבל</small>
                  </div>
                )}
                {validationResult.validationSid && (
                  <div className="validation-item">
                    <strong>מזהה בקשת אימות:</strong> {validationResult.validationSid}
                  </div>
                )}
                <div className="validation-item status-check">
                  <strong>בדיקת סטטוס:</strong>
                  <div className="status-info">
                    <span>⏰ בדיקה אוטומטית תתבצע בעוד 30 שניות</span>
                    {isCheckingStatus && (
                      <div className="checking-status">
                        <div className="loading-spinner-small"></div>
                        <span>בודק סטטוס...</span>
                      </div>
                    )}
                    {validationStatus && (
                      <div className="status-update">
                        <strong>סטטוס עדכני:</strong> 
                        {validationStatus.status === 'approved' && (
                          <span className="status-success">✅ מאומת!</span>
                        )}
                        {validationStatus.status === 'pending' && (
                          <span className="status-pending">⏳ ממתין לאימות</span>
                        )}
                        {validationStatus.status === 'error' && (
                          <span className="status-error">❌ שגיאה בבדיקה</span>
                        )}
                        <div className="status-message">{validationStatus.message}</div>
                        {validationStatus.status === 'pending' && (
                          <div className="auto-check-info">
                            <small>🔄 בדיקה אוטומטית נוספת תתבצע בעוד 30 שניות</small>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="validation-actions">
                <button 
                  onClick={() => {
                    setValidationResult(null);
                    setValidationStatus(null);
                  }} 
                  className="btn btn-secondary"
                >
                  סגור
                </button>
                {validationResult && validationResult.phoneNumber && (
                  <button 
                    onClick={checkValidationStatus}
                    className="btn btn-primary"
                    disabled={isCheckingStatus}
                  >
                    {isCheckingStatus ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        <span>בודק...</span>
                      </>
                    ) : (
                      <>
                        <span>🔍 בדוק סטטוס עכשיו</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="validation-actions">
            <button
              onClick={() => {
                setShowValidationForm(true);
                setValidationResult(null);
                setValidationStatus(null);
              }}
              className="btn btn-primary"
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>הוסף מספר טלפון לאימות</span>
            </button>
          </div>

          {showValidationForm && (
            <div className="validation-form">
              <h3>בקשת אימות מספר טלפון</h3>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="phoneNumber">מספר טלפון *</label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    name="phoneNumber"
                    value={validationData.phoneNumber}
                    onChange={handleInputChange}
                    placeholder="+972501234567"
                    required
                    disabled={isSubmitting}
                  />
                  <small>הכנס מספר טלפון בפורמט בינלאומי (למשל: +972501234567)</small>
                </div>

                <div className="form-group">
                  <label htmlFor="friendlyName">שם ידידותי (אופציונלי)</label>
                  <input
                    type="text"
                    id="friendlyName"
                    name="friendlyName"
                    value={validationData.friendlyName}
                    onChange={handleInputChange}
                    placeholder="שם או תיאור"
                    disabled={isSubmitting}
                  />
                  <small>שם או תיאור לזיהוי קל של המספר</small>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => setShowValidationForm(false)}
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
                    {isSubmitting ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        <span>שולח...</span>
                      </>
                    ) : (
                      <>
                        <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>שלח בקשת אימות</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="verified-callers-section">
            <h3>מספרי טלפון מאומתים</h3>
            {verifiedCallers.length === 0 ? (
              <p className="no-callers">אין מספרי טלפון מאומתים</p>
            ) : (
              <div className="callers-list">
                {verifiedCallers.map(caller => (
                  <div key={caller.id} className="caller-item">
                    <div className="caller-info">
                      <div className="caller-phone">{caller.phoneNumber}</div>
                      <div className="caller-name">{caller.friendlyName || 'ללא שם'}</div>
                    </div>
                    <div className="caller-status">
                      <span className="status-badge status-verified">מאומת</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={handleClose} className="btn btn-secondary">
            סגור
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="form-container caller-id-validation-inline">
      <div className="gate-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>אימות מספרי טלפון</h3>
        <button onClick={handleClose} className="btn btn-secondary btn-small">חזרה</button>
      </div>

      <p className="modal-description">
        ניהול מספרי טלפון מורשים לשיחות יוצאות ב-Twilio. 
        מספרים חדשים דורשים אימות לפני שימוש.
      </p>

      {error && !notificationsEnabled && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {successMessage && !notificationsEnabled && (
        <div className="success-message">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')}>✕</button>
        </div>
      )}

      {validationResult && (
        <div className="validation-result">
          <h3>פרטי בקשת האימות</h3>
          <div className="validation-details">
            <div className="validation-item">
              <strong>מספר טלפון:</strong> {validationResult.phoneNumber}
            </div>
            {validationResult.friendlyName && (
              <div className="validation-item">
                <strong>שם ידידותי:</strong> {validationResult.friendlyName}
              </div>
            )}
            <div className="validation-item">
              <strong>סטטוס:</strong> {validationResult.status}
            </div>
            {validationResult.validationCode && (
              <div className="validation-item verification-code">
                <strong>קוד האימות:</strong> 
                <span className="code-display">{validationResult.validationCode}</span>
                <small>הקש את הקוד בשיחה שתקבל</small>
              </div>
            )}
            {validationResult.validationSid && (
              <div className="validation-item">
                <strong>מזהה בקשת אימות:</strong> {validationResult.validationSid}
              </div>
            )}
            <div className="validation-item status-check">
              <strong>בדיקת סטטוס:</strong>
              <div className="status-info">
                <span>⏰ בדיקה אוטומטית תתבצע בעוד 30 שניות</span>
                {isCheckingStatus && (
                  <div className="checking-status">
                    <div className="loading-spinner-small"></div>
                    <span>בודק סטטוס...</span>
                  </div>
                )}
                {validationStatus && (
                  <div className="status-update">
                    <strong>סטטוס עדכני:</strong> 
                    {validationStatus.status === 'approved' && (
                      <span className="status-success">✅ מאומת!</span>
                    )}
                    {validationStatus.status === 'pending' && (
                      <span className="status-pending">⏳ ממתין לאימות</span>
                    )}
                    {validationStatus.status === 'error' && (
                      <span className="status-error">❌ שגיאה בבדיקה</span>
                    )}
                    <div className="status-message">{validationStatus.message}</div>
                    {validationStatus.status === 'pending' && (
                      <div className="auto-check-info">
                        <small>🔄 בדיקה אוטומטית נוספת תתבצע בעוד 30 שניות</small>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="validation-actions">
            <button 
              onClick={() => {
                setValidationResult(null);
                setValidationStatus(null);
              }} 
              className="btn btn-secondary"
            >
              סגור
            </button>
            {validationResult && validationResult.phoneNumber && (
              <button 
                onClick={checkValidationStatus}
                className="btn btn-primary"
                disabled={isCheckingStatus}
              >
                {isCheckingStatus ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    <span>בודק...</span>
                  </>
                ) : (
                  <>
                    <span>🔍 בדוק סטטוס עכשיו</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="validation-actions">
        <button
          onClick={() => {
            setShowValidationForm(true);
            setValidationResult(null);
            setValidationStatus(null);
          }}
          className="btn btn-primary"
        >
          <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>הוסף מספר טלפון לאימות</span>
        </button>
      </div>

      {showValidationForm && (
        <div className="validation-form">
          <h3>בקשת אימות מספר טלפון</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="phoneNumber">מספר טלפון *</label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={validationData.phoneNumber}
                onChange={handleInputChange}
                placeholder="+972501234567"
                required
                disabled={isSubmitting}
              />
              <small>הכנס מספר טלפון בפורמט בינלאומי (למשל: +972501234567)</small>
            </div>

            <div className="form-group">
              <label htmlFor="friendlyName">שם ידידותי (אופציונלי)</label>
              <input
                type="text"
                id="friendlyName"
                name="friendlyName"
                value={validationData.friendlyName}
                onChange={handleInputChange}
                placeholder="שם או תיאור"
                disabled={isSubmitting}
              />
              <small>שם או תיאור לזיהוי קל של המספר</small>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => setShowValidationForm(false)}
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
                {isSubmitting ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    <span>שולח...</span>
                  </>
                ) : (
                  <>
                    <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>שלח בקשת אימות</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="verified-callers-section">
        <h3>מספרי טלפון מאומתים</h3>
        {verifiedCallers.length === 0 ? (
          <p className="no-callers">אין מספרי טלפון מאומתים</p>
        ) : (
          <div className="callers-list">
            {verifiedCallers.map(caller => (
              <div key={caller.id} className="caller-item">
                <div className="caller-info">
                  <div className="caller-phone">{caller.phoneNumber}</div>
                  <div className="caller-name">{caller.friendlyName || 'ללא שם'}</div>
                </div>
                <div className="caller-status">
                  <span className="status-badge status-verified">מאומת</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallerIdValidation;
