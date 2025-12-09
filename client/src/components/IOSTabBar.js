import React, { useState, useEffect } from 'react';
import MobileUserMenu from './MobileUserMenu';

const IOSTabBar = ({ currentView, onViewChange, user, onLogout }) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isMobile) {
    return null; // Only show on mobile
  }

  const tabs = [
    {
      id: 'gates',
      label: 'שערים',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    },
    {
      id: 'statistics',
      label: 'סטטיסטיקות',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      )
    },
    {
      id: 'history',
      label: 'היסטוריה',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    },
    {
      id: 'settings-menu',
      label: 'הגדרות',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
        </svg>
      )
    }
  ];

  return (
    <>
      <nav className="ios-tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`ios-tab-item ${currentView === tab.id ? 'active' : ''} ${tab.id === 'settings-menu' && isUserMenuOpen ? 'active' : ''}`}
            onClick={() => {
              if (tab.id === 'settings-menu') {
                setIsUserMenuOpen(true);
              } else {
                onViewChange(tab.id);
              }
            }}
            aria-label={tab.label}
          >
            <span className="ios-tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
      
      <MobileUserMenu
        user={user}
        onLogout={onLogout}
        isOpen={isUserMenuOpen}
        onClose={() => setIsUserMenuOpen(false)}
        onViewChange={onViewChange}
      />
    </>
  );
};

export default IOSTabBar;

