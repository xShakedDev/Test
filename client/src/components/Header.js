import React, { useState, useEffect } from 'react';

const Header = ({ user, currentView, onViewChange, onLogout }) => {
  const [twilioBalance, setTwilioBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch Twilio balance for admin users
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchTwilioBalance();
    }
  }, [user]);

  const fetchTwilioBalance = async () => {
    setBalanceLoading(true);
    setBalanceError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/twilio/balance', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTwilioBalance(data.balance);
      } else {
        const errorData = await response.json();
        setBalanceError(errorData.error || 'שגיאה בהבאת יתרה');
      }
    } catch (error) {
      console.error('שגיאה בהבאת יתרת Twilio:', error);
      setBalanceError('שגיאת רשת');
    } finally {
      setBalanceLoading(false);
    }
  };

  const formatBalance = (balance) => {
    if (balance === null || balance === undefined) return 'N/A';
    return `$${parseFloat(balance).toFixed(2)}`;
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileNavClick = (view) => {
    onViewChange(view);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="app-header">
      <div className="header-content">
        {/* Left side - Logo and Navigation */}
        <div className="header-left">
          <div className="app-title">
            <svg className="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            מערכת ניהול שערים
          </div>
          
          {/* Desktop Navigation - Hidden on mobile */}
          {user?.role === 'admin' && (
            <nav className="header-navigation desktop-navigation">
              <button
                onClick={() => onViewChange('gates')}
                className={`nav-button ${currentView === 'gates' ? 'nav-button-active' : ''}`}
              >
                שערים
              </button>
              
              <button
                onClick={() => onViewChange('users')}
                className={`nav-button ${currentView === 'users' ? 'nav-button-active' : ''}`}
              >
                ניהול משתמשים
              </button>

              <button
                onClick={() => onViewChange('history')}
                className={`nav-button ${currentView === 'history' ? 'nav-button-active' : ''}`}
              >
                היסטוריית שערים
              </button>

              <button
                onClick={() => onViewChange('settings')}
                className={`nav-button ${currentView === 'settings' ? 'nav-button-active' : ''}`}
              >
                הגדרות מנהל
              </button>
            </nav>
          )}
        </div>

        {/* Right side - User info, Twilio balance, and logout */}
        <div className="header-right">
          {/* Twilio Balance - Only visible to admins */}
          {user?.role === 'admin' && (
            <div className="twilio-balance">
              <div className="balance-card">
                <div className="balance-icon">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="balance-details">
                  <span className="balance-label">יתרת Twilio</span>
                  {balanceLoading ? (
                    <span className="balance-amount">טוען...</span>
                  ) : balanceError ? (
                    <span className="balance-amount" style={{ color: '#e74c3c' }}>שגיאה</span>
                  ) : (
                    <span className="balance-amount">{formatBalance(twilioBalance)}</span>
                  )}
                </div>
                {balanceError && (
                  <button 
                    onClick={fetchTwilioBalance}
                    className="btn btn-secondary"
                    style={{ 
                      padding: '0.25rem 0.5rem', 
                      fontSize: '0.7rem',
                      marginLeft: '0.5rem'
                    }}
                    title="נסה שוב"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '12px', height: '12px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="admin-status">
            <div className={`admin-badge ${user?.role === 'admin' ? 'admin-badge-admin' : 'admin-badge-user'}`}>
              {user?.role === 'admin' ? (
                <>
                  <svg className="icon-small" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 12c0-1.636-.491-3.154-1.343-4.243a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  מנהל
                </>
              ) : (
                <>
                  <svg className="icon-small" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  משתמש
                </>
              )}
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              className="btn btn-secondary btn-header"
              style={{ minWidth: '160px', width: '160px', maxWidth: '160px', minHeight: '60px', height: '60px', maxHeight: '60px' }}
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>התנתקות</span>
            </button>

            {/* Change Password button */}
            <button
              onClick={() => {
                // For now, just show an alert. In the future, this could open a modal
                alert('פונקציונליות שינוי סיסמה תתווסף בקרוב');
              }}
              className="btn btn-secondary btn-header"
              style={{ minWidth: '160px', width: '160px', maxWidth: '160px', minHeight: '60px', height: '60px', maxHeight: '60px' }}
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span>שנה סיסמה</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation - Collapsible */}
      <div className="mobile-navigation">
        <button 
          className="mobile-menu-toggle"
          onClick={toggleMobileMenu}
          aria-label="Toggle mobile menu"
        >
          <svg 
            className={`hamburger-icon ${isMobileMenuOpen ? 'open' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
            />
          </svg>
          <span>תפריט ניווט</span>
        </button>
        
        <div className={`mobile-nav-content ${isMobileMenuOpen ? 'open' : ''}`}>
          {/* Mobile User Info Section */}
          <div className="mobile-user-info">
            <div className={`mobile-admin-badge ${user?.role === 'admin' ? 'admin-badge-admin' : 'admin-badge-user'}`}>
              {user?.role === 'admin' ? (
                <>
                  <svg className="icon-small" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 12c0-1.636-.491-3.154-1.343-4.243a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  מנהל
                </>
              ) : (
                <>
                  <svg className="icon-small" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  משתמש
                </>
              )}
            </div>

            {/* Mobile Twilio Balance - Only visible to admins */}
            {user?.role === 'admin' && (
              <div className="mobile-twilio-balance">
                <div className="mobile-balance-card">
                  <div className="mobile-balance-icon">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="mobile-balance-details">
                    <span className="mobile-balance-label">יתרת Twilio</span>
                    {balanceLoading ? (
                      <span className="mobile-balance-amount">טוען...</span>
                    ) : balanceError ? (
                      <span className="mobile-balance-amount" style={{ color: '#e74c3c' }}>שגיאה</span>
                    ) : (
                      <span className="mobile-balance-amount">{formatBalance(twilioBalance)}</span>
                    )}
                  </div>
                  {balanceError && (
                    <button 
                      onClick={fetchTwilioBalance}
                      className="btn btn-secondary mobile-refresh-btn"
                      title="נסה שוב"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '12px', height: '12px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Mobile Logout Button */}
            <button
              onClick={onLogout}
              className="btn btn-secondary mobile-logout-btn btn-header"
              style={{ minWidth: '160px', width: '160px', maxWidth: '160px', minHeight: '60px', height: '60px', maxHeight: '60px' }}
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>התנתקות</span>
            </button>

            {/* Mobile Change Password Button */}
            <button
              onClick={() => {
                // For now, just show an alert. In the future, this could open a modal
                alert('פונקציונליות שינוי סיסמה תתווסף בקרוב');
              }}
              className="btn btn-secondary mobile-logout-btn btn-header"
              style={{ minWidth: '160px', width: '160px', maxWidth: '160px', minHeight: '60px', height: '60px', maxHeight: '60px' }}
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span>שנה סיסמה</span>
            </button>
          </div>

          {/* Mobile Navigation Buttons - Only visible to admins */}
          {user?.role === 'admin' && (
            <div className="mobile-nav-buttons">
              <button
                onClick={() => handleMobileNavClick('gates')}
                className={`mobile-nav-button ${currentView === 'gates' ? 'mobile-nav-button-active' : ''}`}
              >
                שערים
              </button>
              
              <button
                onClick={() => handleMobileNavClick('users')}
                className={`mobile-nav-button ${currentView === 'users' ? 'mobile-nav-button-active' : ''}`}
              >
                ניהול משתמשים
              </button>

              <button
                onClick={() => handleMobileNavClick('history')}
                className={`mobile-nav-button ${currentView === 'history' ? 'mobile-nav-button-active' : ''}`}
              >
                היסטוריית שערים
              </button>

              <button
                onClick={() => handleMobileNavClick('settings')}
                className={`mobile-nav-button ${currentView === 'settings' ? 'mobile-nav-button-active' : ''}`}
              >
                הגדרות מנהל
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
