import React, { useState } from 'react';
import { authenticatedFetch } from '../utils/auth';

const Login = ({ onLogin, isLoading }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(''); // Clear error when user starts typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      const msg = 'נדרש שם משתמש וסיסמה';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification(msg, 'warning');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Convert username to lowercase to ignore case sensitivity
      const loginData = {
        ...formData,
        username: formData.username.toLowerCase().trim()
      };

      const response = await authenticatedFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
      });

      const data = await response.json();

      if (response.ok) {
        // Save tokens and user info
        localStorage.setItem('authToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Show system notification if enabled
        if (window.showSystemNotification) {
          window.showSystemNotification(`ברוך הבא, ${data.user.username}!`, 'success');
        }
        
        onLogin(data.user, { accessToken: data.accessToken, refreshToken: data.refreshToken });
      } else {
        const msg = data.error || 'שגיאה בהתחברות';
        setError(msg);
        if (window.showSystemNotification) {
          window.showSystemNotification(`שגיאה בהתחברות: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      const msg = 'שגיאת רשת - אנא נסה שוב';
      setError(msg);
      
      // Show system notification if enabled
      if (window.showSystemNotification) {
        window.showSystemNotification(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Header Section */}
      <div className="login-header">
        <div className="login-logo">
          <div className="logo-icon">
            <svg className="logo-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>
        <h2 className="login-title">
          מערכת ניהול שערים
        </h2>
        <p className="login-subtitle">
          התחברות למערכת הניהול
        </p>
      </div>

      {/* Login Form */}
      <div className="login-form-container">
        <div className="form-container">
          <form className="login-form-inner" onSubmit={handleSubmit}>
            {/* Username Field */}
            <div className="form-group">
              <label htmlFor="username" className="form-label">
                שם משתמש
              </label>
              <div className="input-container">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="form-input"
                  placeholder="הכנס שם משתמש"
                />
                <div className="input-icon">
                  <svg className="icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                סיסמה
              </label>
              <div className="input-container">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="form-input"
                  placeholder="הכנס סיסמה"
                />
                <div className="input-icon">
                  <svg className="icon-small" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="error-message">
                <div className="error-content">
                  <span className="error-text">{error}</span>
                  <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="form-actions">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary login-submit-btn"
              >
                {loading ? (
                  <div className="btn-content">
                    <div className="loading-spinner-small"></div>
                    <span>מתחבר למערכת...</span>
                  </div>
                ) : (
                  <div className="btn-content">
                    <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    <span>כניסה למערכת</span>
                  </div>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="login-footer">
            <p className="footer-text">
              מערכת מאובטחת עם ניהול משתמשים מתקדם
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
