import React, { useState, useEffect, useRef } from 'react';
import ChangePasswordModal from './ChangePasswordModal';
import { authenticatedFetch } from '../utils/auth';

const Header = ({ user, currentView, onViewChange, onLogout }) => {
  const [twilioBalance, setTwilioBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const mobileNavContentRef = useRef(null);
  const mobileMenuToggleRef = useRef(null);
  const [mobileNavMaxHeight, setMobileNavMaxHeight] = useState('80vh');
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Fetch Twilio balance for admin users
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchTwilioBalance();
    }
  }, [user]);

  // Detect viewport to differentiate mobile vs desktop rendering
  useEffect(() => {
    const updateIsMobile = () => {
      try {
        setIsMobile(window.innerWidth <= 768);
      } catch (_e) {
        setIsMobile(false);
      }
    };
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  // Recalculate available height for the mobile nav content when open
  useEffect(() => {
    const recalcMaxHeight = () => {
      if (!isMobileMenuOpen || !mobileNavContentRef.current) return;
      const top = mobileNavContentRef.current.getBoundingClientRect().top || 0;
      const available = Math.max(120, window.innerHeight - top - 8);
      setMobileNavMaxHeight(`${available}px`);
    };

    if (isMobileMenuOpen) {
      recalcMaxHeight();
      window.addEventListener('resize', recalcMaxHeight);
      window.addEventListener('orientationchange', recalcMaxHeight);
      setTimeout(recalcMaxHeight, 0);
    }
    return () => {
      window.removeEventListener('resize', recalcMaxHeight);
      window.removeEventListener('orientationchange', recalcMaxHeight);
    };
  }, [isMobileMenuOpen]);

  // Close mobile menu on outside click/tap
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    let touchStartY = null;
    let isScrolling = false;

    const handlePointerDown = (e) => {
      // Store initial touch position for scroll detection
      if (e.type === 'touchstart') {
        touchStartY = e.touches[0].clientY;
        isScrolling = false;
      }
    };

    const handleTouchMove = (e) => {
      // If touch moves significantly, it's a scroll, not a click
      if (touchStartY !== null) {
        const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
        if (deltaY > 10) {
          isScrolling = true;
        }
      }
    };

    const handlePointerUp = (e) => {
      // Only close menu if it wasn't a scroll
      if (isScrolling) {
        touchStartY = null;
        isScrolling = false;
        return;
      }

      const menuEl = mobileNavContentRef.current;
      const toggleEl = mobileMenuToggleRef.current;
      if (!menuEl) return;
      const clickedInsideMenu = menuEl.contains(e.target);
      const clickedToggle = toggleEl && toggleEl.contains(e.target);
      if (!clickedInsideMenu && !clickedToggle) {
        setIsMobileMenuOpen(false);
      }

      touchStartY = null;
      isScrolling = false;
    };

    const handleMouseDown = (e) => {
      const menuEl = mobileNavContentRef.current;
      const toggleEl = mobileMenuToggleRef.current;
      if (!menuEl) return;
      const clickedInsideMenu = menuEl.contains(e.target);
      const clickedToggle = toggleEl && toggleEl.contains(e.target);
      if (!clickedInsideMenu && !clickedToggle) {
        setIsMobileMenuOpen(false);
      }
    };

    // For touch devices: use touch events with scroll detection
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handlePointerUp, { passive: true });

    // For mouse devices: use mousedown
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handlePointerUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isMobileMenuOpen]);

  // Handle header visibility on scroll
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      // Don't hide header if mobile menu is open
      if (isMobileMenuOpen) {
        setIsHeaderVisible(true);
        return;
      }

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          // Always show header at the top of the page
          if (currentScrollY < 10) {
            setIsHeaderVisible(true);
          } else if (currentScrollY < lastScrollY.current - 5) {
            // Scrolling up (with threshold to avoid flickering)
            setIsHeaderVisible(true);
          } else if (currentScrollY > lastScrollY.current + 5) {
            // Scrolling down (with threshold to avoid flickering)
            setIsHeaderVisible(false);
          }

          lastScrollY.current = currentScrollY;
          ticking = false;
        });

        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobileMenuOpen]);

  const fetchTwilioBalance = async () => {
    setBalanceLoading(true);
    setBalanceError(null);

    try {
      const token = localStorage.getItem('authToken');
      const response = await authenticatedFetch('/api/twilio/balance');

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
    <header className={`app-header ${isHeaderVisible ? 'header-visible' : 'header-hidden'}`}>
      <div className="header-content">
        {/* Left side - Logo and Navigation */}
        <div className="header-left">
          <div className="app-title">
            <img src={`${process.env.PUBLIC_URL || ''}/logo.png`} alt="Shaked Gates" className="header-logo-img" />
          </div>

          {/* Desktop Navigation - Hidden on mobile */}
          {!isMobile && (
            <nav className="header-navigation desktop-navigation">
              <button
                onClick={() => onViewChange('gates')}
                className={`nav-button ${currentView === 'gates' ? 'nav-button-active' : ''}`}
              >
                שערים
              </button>

              {user?.role === 'admin' && (
                <button
                  onClick={() => onViewChange('users')}
                  className={`nav-button ${currentView === 'users' ? 'nav-button-active' : ''}`}
                >
                  ניהול משתמשים
                </button>
              )}

              <button
                onClick={() => onViewChange('history')}
                className={`nav-button ${currentView === 'history' ? 'nav-button-active' : ''}`}
              >
                היסטוריית שערים
              </button>

              <button
                onClick={() => onViewChange('statistics')}
                className={`nav-button ${currentView === 'statistics' ? 'nav-button-active' : ''}`}
              >
                {user?.role === 'admin' ? 'סטטיסטיקות' : 'הסטטיסטיקות שלי'}
              </button>

              {user?.role === 'admin' && (
                <>
                  <button
                    onClick={() => onViewChange('settings')}
                    className={`nav-button ${currentView === 'settings' ? 'nav-button-active' : ''}`}
                  >
                    הגדרות מנהל
                  </button>
                  <button
                    onClick={() => onViewChange('console')}
                    className={`nav-button ${currentView === 'console' ? 'nav-button-active' : ''}`}
                  >
                    קונסול
                  </button>
                </>
              )}
            </nav>
          )}
        </div>

        {/* Right side - User info, Twilio balance, and logout */}
        <div className="header-right">
          {/* Twilio Balance - Only visible to admins */}
          {!isMobile && user?.role === 'admin' && (
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

          {!isMobile && (
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

              {/* Logout and Change Password buttons - desktop only */}
              <>
                <button
                  onClick={onLogout}
                  className="btn btn-primary btn-header"
                  style={{ minWidth: '160px', width: '160px', maxWidth: '160px', minHeight: '60px', height: '60px', maxHeight: '60px' }}
                >
                  <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>התנתקות</span>
                </button>

                <button
                  onClick={() => setIsChangePasswordModalOpen(true)}
                  className="btn btn-primary btn-header"
                  style={{ minWidth: '160px', width: '160px', maxWidth: '160px', minHeight: '60px', height: '60px', maxHeight: '60px' }}
                >
                  <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span>שנה סיסמה</span>
                </button>
              </>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation - iOS Style Sidebar */}
      {isMobile && (
        <div className={`mobile-navigation ${isMobileMenuOpen ? 'open' : ''}`}>
          <div
            className={`mobile-nav-content ${isMobileMenuOpen ? 'open' : ''}`}
            ref={mobileNavContentRef}
          >
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
              className="btn btn-primary mobile-logout-btn btn-header"
              style={{ minWidth: '160px', width: '160px', maxWidth: '160px', minHeight: '60px', height: '60px', maxHeight: '60px' }}
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>התנתקות</span>
            </button>

            {/* Mobile Change Password Button */}
            <button
              onClick={() => setIsChangePasswordModalOpen(true)}
              className="btn btn-primary mobile-logout-btn btn-header"
              style={{ minWidth: '160px', width: '160px', maxWidth: '160px', minHeight: '60px', height: '60px', maxHeight: '60px' }}
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span>שנה סיסמה</span>
            </button>
          </div>

          {/* Mobile Navigation Buttons */}
          <div className="mobile-nav-buttons">
            <button
              onClick={() => handleMobileNavClick('gates')}
              className={`mobile-nav-button ${currentView === 'gates' ? 'mobile-nav-button-active' : ''}`}
            >
              שערים
            </button>

            {user?.role === 'admin' && (
              <button
                onClick={() => handleMobileNavClick('users')}
                className={`mobile-nav-button ${currentView === 'users' ? 'mobile-nav-button-active' : ''}`}
              >
                ניהול משתמשים
              </button>
            )}

            <button
              onClick={() => handleMobileNavClick('history')}
              className={`mobile-nav-button ${currentView === 'history' ? 'mobile-nav-button-active' : ''}`}
            >
              היסטוריית שערים
            </button>

            <button
              onClick={() => handleMobileNavClick('statistics')}
              className={`mobile-nav-button ${currentView === 'statistics' ? 'mobile-nav-button-active' : ''}`}
            >
              {user?.role === 'admin' ? 'סטטיסטיקות' : 'הסטטיסטיקות שלי'}
            </button>

            {user?.role === 'admin' && (
              <>
                <button
                  onClick={() => handleMobileNavClick('settings')}
                  className={`mobile-nav-button ${currentView === 'settings' ? 'mobile-nav-button-active' : ''}`}
                >
                  הגדרות מנהל
                </button>
                <button
                  onClick={() => handleMobileNavClick('console')}
                  className={`mobile-nav-button ${currentView === 'console' ? 'mobile-nav-button-active' : ''}`}
                >
                  קונסול
                </button>
              </>
            )}
          </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        onSuccess={() => {
          // Could show a success message or perform other actions
          console.log('Password changed successfully');
        }}
        token={localStorage.getItem('authToken')}
      />
    </header>
  );
};

export default Header;
