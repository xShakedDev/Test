import React, { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '../utils/auth';

const AdminSettings = ({ user, token }) => {
  const [settings, setSettings] = useState({
    gateCooldownSeconds: 30,
    maxRetries: 3,
    enableNotifications: true,
    autoRefreshInterval: 5,
    systemMaintenance: false,
    maintenanceMessage: 'המערכת בתחזוקה'
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [updatedBy, setUpdatedBy] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  // Refs for scrolling to messages
  const errorRef = useRef(null);
  const successRef = useRef(null);

  useEffect(() => {
    fetchSettings();
  }, [token]);

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
      
      const response = await authenticatedFetch('/api/admin/settings');

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || settings);
        setLastUpdated(data.lastUpdated ? new Date(data.lastUpdated) : null);
        setUpdatedBy(data.updatedBy);
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

    try {
      const response = await authenticatedFetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage('ההגדרות נשמרו בהצלחה');
        scrollToMessage('success');
        
        // Show notification if enabled
        if (settings.enableNotifications) {
          showLocalNotification('הגדרות המערכת עודכנו בהצלחה', 'success');
        }
        
        // Update last updated info
        setLastUpdated(new Date());
        setUpdatedBy(user.username);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(data.error || 'שגיאה בשמירת ההגדרות');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('שגיאת רשת');
      scrollToMessage('error');
    } finally {
      setIsSaving(false);
    }
  };

  // System notification function - Global function
  window.showSystemNotification = (message, type = 'info') => {
    // Check if notifications are enabled by fetching current settings
    authenticatedFetch('/api/settings/current')
      .then(response => response.json())
      .then(data => {
        if (!data.settings.enableNotifications) return;
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `system-notification system-notification-${type}`;
        notification.innerHTML = `
          <span class="notification-message">${message}</span>
          <button class="notification-close" onclick="this.parentElement.remove()">✕</button>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          if (notification.parentElement) {
            notification.remove();
          }
        }, 5000);
      })
      .catch(error => {
        console.error('Error checking notification settings:', error);
      });
  };

  // Local notification function for this component
  const showLocalNotification = (message, type = 'info') => {
    if (!settings.enableNotifications) return;
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `system-notification system-notification-${type}`;
    notification.innerHTML = `
      <span class="notification-message">${message}</span>
      <button class="notification-close" onclick="this.parentElement.remove()">✕</button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  };

  const resetToDefaults = () => {
    setSettings({
      gateCooldownSeconds: 30,
      maxRetries: 3,
      enableNotifications: true,
      autoRefreshInterval: 5,
      systemMaintenance: false,
      maintenanceMessage: 'המערכת בתחזוקה'
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
              <div className="checkbox-container">
                <span className="checkbox-text">הפעל התראות מערכת</span>
                <input
                  type="checkbox"
                  name="enableNotifications"
                  checked={settings.enableNotifications}
                  onChange={handleInputChange}
                  className="form-checkbox"
                />
              </div>
              <small className="form-help">
                הצג התראות על פעולות חשובות במערכת
              </small>
            </div>
          </div>

          <div className="settings-section">
            <h3>הגדרות תחזוקה</h3>
            
            <div className="form-group">
              <div className="checkbox-container">
                <span className="checkbox-text">מצב תחזוקה</span>
                <input
                  type="checkbox"
                  name="systemMaintenance"
                  checked={settings.systemMaintenance}
                  onChange={handleInputChange}
                  className="form-checkbox"
                />
              </div>
              <small className="form-help">
                הפעל מצב תחזוקה למערכת
              </small>
            </div>

            {settings.systemMaintenance && (
              <div className="form-group">
                <label htmlFor="maintenanceMessage">
                  הודעת תחזוקה
                </label>
                <textarea
                  id="maintenanceMessage"
                  name="maintenanceMessage"
                  value={settings.maintenanceMessage}
                  onChange={handleInputChange}
                  className="form-input"
                  rows="3"
                  placeholder="הזן הודעת תחזוקה למשתמשים"
                />
                <small className="form-help">
                  הודעה שתוצג למשתמשים במצב תחזוקה
                </small>
              </div>
            )}
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
            <div className="setting-item">
              <span className="setting-label">מצב תחזוקה:</span>
              <span className="setting-value">
                {settings.systemMaintenance ? 'מופעל' : 'מושבת'}
              </span>
            </div>
            {settings.systemMaintenance && (
              <div className="setting-item">
                <span className="setting-label">הודעת תחזוקה:</span>
                <span className="setting-value">{settings.maintenanceMessage}</span>
              </div>
            )}
          </div>
          
          {lastUpdated && (
            <div className="settings-meta">
              <p className="last-updated">
                <strong>עודכן לאחרונה:</strong> {lastUpdated.toLocaleString('he-IL')}
                {updatedBy && <span> על ידי: {updatedBy}</span>}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
