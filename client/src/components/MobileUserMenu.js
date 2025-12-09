import React, { useState, useEffect } from 'react';
import ChangePasswordModal from './ChangePasswordModal';
import { authenticatedFetch } from '../utils/auth';

const MobileUserMenu = ({ user, onLogout, isOpen, onClose, onViewChange }) => {
  const [twilioBalance, setTwilioBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState(null);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin' && isOpen) {
      fetchTwilioBalance();
    }
  }, [user, isOpen]);

  const fetchTwilioBalance = async () => {
    setBalanceLoading(true);
    setBalanceError(null);

    try {
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

  if (!isOpen) return null;

  return (
    <>
      <div className="mobile-user-menu-overlay" onClick={onClose}>
        <div className="mobile-user-menu-content" onClick={(e) => e.stopPropagation()}>
          <div className="mobile-user-menu-header">
            <h3>הגדרות</h3>
            <button className="mobile-user-menu-close" onClick={onClose}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="mobile-user-menu-body">
            {/* User Info */}
            <div className="mobile-user-menu-section">
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
              <p style={{ textAlign: 'center', marginTop: '0.5rem', color: 'var(--ios-label-secondary)' }}>
                {user?.username || user?.name || 'משתמש'}
              </p>
            </div>

            {/* Twilio Balance - Only visible to admins */}
            {user?.role === 'admin' && (
              <div className="mobile-user-menu-section">
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
                      <span className="mobile-balance-amount" style={{ color: '#FF3B30' }}>שגיאה</span>
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

            {/* Admin Navigation - Only for admins */}
            {user?.role === 'admin' && (
              <div className="mobile-user-menu-section">
                <h4 style={{ fontSize: 'var(--ios-font-size-subhead)', fontWeight: 600, color: 'var(--ios-label)', marginBottom: 'var(--ios-space-md)' }}>ניהול</h4>
                <div className="mobile-user-menu-nav-buttons">
                  <button
                    onClick={() => {
                      onViewChange('users');
                      onClose();
                    }}
                    className="mobile-user-menu-nav-button"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span>משתמשים</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      onViewChange('console');
                      onClose();
                    }}
                    className="mobile-user-menu-nav-button"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="4 7 10 7 16 13" />
                      <line x1="21" y1="11" x2="10" y2="11" />
                    </svg>
                    <span>קונסול</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      onViewChange('settings');
                      onClose();
                    }}
                    className="mobile-user-menu-nav-button"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>הגדרות מנהל</span>
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mobile-user-menu-actions">
              <button
                onClick={() => setIsChangePasswordModalOpen(true)}
                className="btn btn-primary btn-full"
              >
                <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                שנה סיסמה
              </button>

              <button
                onClick={onLogout}
                className="btn btn-danger btn-full"
                style={{ marginTop: '0.75rem' }}
              >
                <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                התנתקות
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        onSuccess={() => {
          console.log('Password changed successfully');
        }}
        token={localStorage.getItem('authToken')}
      />
    </>
  );
};

export default MobileUserMenu;

