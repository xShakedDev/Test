import React, { useState } from 'react';
import { Shield, LogOut, LogIn, DoorOpen } from 'lucide-react';
import axios from 'axios';

const Header = ({ isAdminLoggedIn, onAdminLogin, onAdminLogout }) => {
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Validate password by trying to fetch Twilio balance
      await axios.get('/api/twilio/balance', {
        headers: { 'x-admin-password': password }
      });
      
      onAdminLogin(password);
      setShowLoginForm(false);
      setPassword('');
    } catch (error) {
      if (error.response?.status === 401) {
        setError('סיסמת מנהל לא תקינה');
      } else {
        setError('שגיאה בהתחברות - בדוק את החיבור לשרת');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    onAdminLogout();
    setError('');
  };

  const handleCancelLogin = () => {
    setShowLoginForm(false);
    setPassword('');
    setError('');
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="app-title">
            <DoorOpen className="header-icon" />
            מערכת שערים
          </h1>
        </div>
        
        <div className="header-right">
          {isAdminLoggedIn ? (
            <div className="admin-status">
              <span className="admin-badge">
                <Shield className="icon-small" />
                מנהל מחובר
              </span>
              <button
                className="btn btn-secondary btn-small"
                onClick={handleLogout}
                title="התנתק"
              >
                <LogOut className="btn-icon" />
                התנתק
              </button>
            </div>
          ) : (
            <div className="login-section">
              {showLoginForm ? (
                <form onSubmit={handleLoginSubmit} className="login-form">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="סיסמת מנהל"
                    required
                    disabled={isSubmitting}
                    className="login-input"
                  />
                  <div className="login-actions">
                    <button
                      type="submit"
                      className="btn btn-primary btn-small"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'מתחבר...' : 'התחבר'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={handleCancelLogin}
                      disabled={isSubmitting}
                    >
                      ביטול
                    </button>
                  </div>
                  {error && <div className="login-error">{error}</div>}
                </form>
              ) : (
                <button
                  className="btn btn-primary btn-small"
                  onClick={() => setShowLoginForm(true)}
                  title="התחבר כמנהל"
                >
                  <LogIn className="btn-icon" />
                  התחבר כמנהל
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
