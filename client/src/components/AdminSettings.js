import React, { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '../utils/auth';

const AdminSettings = ({ user, token }) => {
  const [settings, setSettings] = useState({
    gateCooldownSeconds: 30,
    maxRetries: 3,
    enableNotifications: true,
    autoRefreshInterval: 5,
    systemMaintenance: false,
    maintenanceMessage: 'המערכת בתחזוקה',
    blockIfLowTwilioBalance: true,
    twilioBalanceThreshold: 5
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
        const msg = errorData.error || 'שגיאה בטעינת הגדרות';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setError('שגיאת רשת');
      if (window.showSystemNotification) window.showSystemNotification('שגיאת רשת', 'error');
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
        const msg = 'ההגדרות נשמרו בהצלחה';
        setSuccessMessage(msg);
        if (window.showSystemNotification) window.showSystemNotification('הגדרות המערכת עודכנו בהצלחה', 'success');
        scrollToMessage('success');
        
        // Update last updated info
        setLastUpdated(new Date());
        setUpdatedBy(user.username);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        const msg = data.error || 'שגיאה בשמירת ההגדרות';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('שגיאת רשת');
      if (window.showSystemNotification) window.showSystemNotification('שגיאת רשת', 'error');
      scrollToMessage('error');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSettings({
      gateCooldownSeconds: 30,
      maxRetries: 3,
      enableNotifications: true,
      autoRefreshInterval: 5,
      systemMaintenance: false,
      maintenanceMessage: 'המערכת בתחזוקה',
      blockIfLowTwilioBalance: true,
      twilioBalanceThreshold: 5
    });
    if (window.showSystemNotification) window.showSystemNotification('הגדרות שוחזרו לברירות מחדל', 'info');
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
              <div className="checkbox-container">
                <span className="checkbox-text">חסום פתיחת שערים כשהיתרה נמוכה</span>
                <input
                  type="checkbox"
                  name="blockIfLowTwilioBalance"
                  checked={settings.blockIfLowTwilioBalance}
                  onChange={handleInputChange}
                  className="form-checkbox"
                  id="blockIfLowTwilioBalance"
                />
                <label htmlFor="blockIfLowTwilioBalance" className="checkbox-label-mobile">
                  <span className="checkbox-visual"></span>
                </label>
              </div>
              <small className="form-help">
                מנע ממשתמשים שאינם מנהלים לפתוח שערים אם יתרת Twilio נמוכה מהסף
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="twilioBalanceThreshold">
                סף יתרת Twilio (דולר)
              </label>
              <input
                type="number"
                id="twilioBalanceThreshold"
                name="twilioBalanceThreshold"
                value={settings.twilioBalanceThreshold}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="form-input"
                required
              />
              <small className="form-help">
                ברירת מחדל: 5$. מתחת לסכום זה, משתמשים שאינם מנהלים ייחסמו מפתיחה
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
                  id="enableNotifications"
                />
                <label htmlFor="enableNotifications" className="checkbox-label-mobile">
                  <span className="checkbox-visual"></span>
                </label>
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
                  id="systemMaintenance"
                />
                <label htmlFor="systemMaintenance" className="checkbox-label-mobile">
                  <span className="checkbox-visual"></span>
                </label>
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
              <span className="setting-label">סף יתרת Twilio:</span>
              <span className="setting-value">{settings.twilioBalanceThreshold} דולר</span>
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
