import React, { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '../utils/auth';

const ChangePasswordModal = ({ isOpen, onClose, onSuccess, token }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Refs for scrolling to messages
  const errorRef = useRef(null);
  const successRef = useRef(null);

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError('כל השדות נדרשים');
      return;
    }

    if (formData.newPassword.length < 4) {
      setError('סיסמה חדשה חייבת להכיל לפחות 4 תווים');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('הסיסמה החדשה והאישור אינם תואמים');
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError('הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await authenticatedFetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage('הסיסמה שונתה בהצלחה');
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        
        // Show system notification if enabled
        if (window.showSystemNotification) {
          window.showSystemNotification('הסיסמה שונתה בהצלחה', 'success');
        }
        
        // Close modal after 2 seconds
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        setError(data.error || 'שגיאה בשינוי סיסמה');
        
        // Show system notification if enabled
        if (window.showSystemNotification) {
          window.showSystemNotification(`שגיאה בשינוי סיסמה: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        }
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setError('שגיאת רשת');
      
      // Show system notification if enabled
      if (window.showSystemNotification) {
        window.showSystemNotification('שגיאת רשת בשינוי סיסמה', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setError('');
      setSuccessMessage('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>שנה סיסמה</h3>
          <button 
            onClick={handleClose} 
            className="modal-close-btn"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && !notificationsEnabled && (
            <div className="error-message" ref={errorRef}>
              <span>{error}</span>
              <button onClick={() => setError('')}>✕</button>
            </div>
          )}

          {successMessage && !notificationsEnabled && (
            <div className="success-message" ref={successRef}>
              <span>{successMessage}</span>
              <button onClick={() => setSuccessMessage('')}>✕</button>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="currentPassword">סיסמה נוכחית</label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleInputChange}
              className="form-input"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">סיסמה חדשה</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleInputChange}
              className="form-input"
              required
              disabled={isLoading}
              minLength="4"
            />
            <small className="form-help">לפחות 4 תווים</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">אישור סיסמה חדשה</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className="form-input"
              required
              disabled={isLoading}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={isLoading}
            >
              ביטול
            </button>
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner-small"></div>
                  <span>שומר...</span>
                </>
              ) : (
                <>
                  <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>שנה סיסמה</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
