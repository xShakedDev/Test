import React, { useState, useEffect, useRef } from 'react';

const AdminSettings = ({ user, token }) => {
  const [settings, setSettings] = useState({
    gateCooldownSeconds: 30,
    maxRetries: 3,
    enableNotifications: true,
    autoRefreshInterval: 5
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Refs for scrolling to messages
  const errorRef = useRef(null);
  const successRef = useRef(null);

  useEffect(() => {
    fetchSettings();
  }, [token]);

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

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await fetch('/api/admin/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || settings);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'שגיאה בטעינת הגדרות');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setError('שגיאת רשת');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage('ההגדרות נשמרו בהצלחה');
        scrollToMessage('success');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(data.error || 'שגיאה בשמירת ההגדרות');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('שגיאת רשת');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSettings({
      gateCooldownSeconds: 30,
      maxRetries: 3,
      enableNotifications: true,
      autoRefreshInterval: 5
    });
  };

  if (isLoading) {
    return (
      <div className="settings-page">
        <div className="settings-container">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p>טוען הגדרות...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        {/* Header */}
        <div className="settings-header">
          <h2>הגדרות מנהל</h2>
          <p className="settings-description">
            הגדר הגדרות כלליות למערכת ניהול השערים
          </p>
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

        {/* Settings Form */}
        <form onSubmit={handleSubmit} className="settings-form">
          <div className="settings-section">
            <h3>הגדרות שערים</h3>
            
            <div className="form-group">
              <label htmlFor="gateCooldownSeconds">
                זמן דילאי בין פתיחת שערים (שניות)
              </label>
              <input
                type="number"
                id="gateCooldownSeconds"
                name="gateCooldownSeconds"
                value={settings.gateCooldownSeconds}
                onChange={handleInputChange}
                min="10"
                max="300"
                className="form-input"
                required
              />
              <small className="form-help">
                הזמן המינימלי שצריך לחכות בין פתיחת שער אחד לאחר (10-300 שניות)
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="maxRetries">
                מספר ניסיונות מקסימלי לפתיחת שער
              </label>
              <input
                type="number"
                id="maxRetries"
                name="maxRetries"
                value={settings.maxRetries}
                onChange={handleInputChange}
                min="1"
                max="10"
                className="form-input"
                required
              />
              <small className="form-help">
                מספר הניסיונות המקסימלי לפתיחת שער לפני שנכשל (1-10)
              </small>
            </div>
          </div>

          <div className="settings-section">
            <h3>הגדרות מערכת</h3>
            
            <div className="form-group">
              <label htmlFor="autoRefreshInterval">
                מרווח רענון אוטומטי (דקות)
              </label>
              <input
                type="number"
                id="autoRefreshInterval"
                name="autoRefreshInterval"
                value={settings.autoRefreshInterval}
                onChange={handleInputChange}
                min="1"
                max="60"
                className="form-input"
                required
              />
              <small className="form-help">
                מרווח הזמן בין רענון אוטומטי של הנתונים בדף (1-60 דקות)
              </small>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="enableNotifications"
                  checked={settings.enableNotifications}
                  onChange={handleInputChange}
                  className="form-checkbox"
                />
                <span className="checkmark"></span>
                הפעל התראות מערכת
              </label>
              <small className="form-help">
                הצג התראות על פעולות חשובות במערכת
              </small>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              onClick={resetToDefaults}
              className="btn btn-secondary"
              disabled={isSaving}
            >
              איפוס לברירות מחדל
            </button>
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="loading-spinner-small"></div>
                  <span>שומר...</span>
                </>
              ) : (
                <>
                  <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>שמור הגדרות</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Current Settings Info */}
        <div className="settings-info">
          <h3>הגדרות נוכחיות</h3>
          <div className="settings-summary">
            <div className="setting-item">
              <span className="setting-label">זמן דילאי בין שערים:</span>
              <span className="setting-value">{settings.gateCooldownSeconds} שניות</span>
            </div>
            <div className="setting-item">
              <span className="setting-label">מספר ניסיונות מקסימלי:</span>
              <span className="setting-value">{settings.maxRetries}</span>
            </div>
            <div className="setting-item">
              <span className="setting-label">רענון אוטומטי:</span>
              <span className="setting-value">כל {settings.autoRefreshInterval} דקות</span>
            </div>
            <div className="setting-item">
              <span className="setting-label">התראות מערכת:</span>
              <span className="setting-value">
                {settings.enableNotifications ? 'מופעל' : 'מושבת'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
