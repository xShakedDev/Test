import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import GateDashboard from './components/GateDashboard';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import GateHistory from './components/GateHistory';
import AdminSettings from './components/AdminSettings';
import GateStatistics from './components/GateStatistics';
import { isSessionExpired, authenticatedFetch, setTokenUpdateCallback } from './utils/auth';
import './styles/design-system.css';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentView, setCurrentView] = useState('gates'); // 'gates' or 'users'
  const [isLoading, setIsLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  // Ensure global system notification is available across the app
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.showSystemNotification) {
      window.showSystemNotification = (message, type = 'info') => {
        try {
          const notification = document.createElement('div');
          notification.className = `system-notification system-notification-${type}`;
          notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">✕</button>
          `;
          document.body.appendChild(notification);
          setTimeout(() => {
            if (notification.parentElement) notification.remove();
          }, 5000);
        } catch (_e) {
          // no-op fallback
        }
      };
    }
  }, []);

  // Set up token update callback for when token is refreshed
  useEffect(() => {
    setTokenUpdateCallback((newToken) => {
      setToken(newToken);
    });

    return () => {
      setTokenUpdateCallback(null);
    };
  }, []);

  // Listen for storage changes to sync token state
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Only handle authToken changes
      if (e.key === 'authToken') {
        const newToken = e.newValue;
        if (newToken && newToken !== token) {
          setToken(newToken);
        } else if (!newToken && token) {
          // Token was removed, but don't logout here as handleLogout handles it
          setToken(null);
        }
      }
    };

    // Listen to both localStorage and sessionStorage changes
    window.addEventListener('storage', handleStorageChange);

    // Also listen to custom storage events (for same-tab updates)
    const handleCustomStorageChange = (e) => {
      if (e.detail && e.detail.key === 'authToken') {
        const newToken = e.detail.newValue;
        if (newToken && newToken !== token) {
          setToken(newToken);
        }
      }
    };

    window.addEventListener('customStorageChange', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('customStorageChange', handleCustomStorageChange);
    };
  }, [token]);

  const handleLogout = useCallback(() => {
    // Show system notification if enabled
    if (window.showSystemNotification) {
      window.showSystemNotification('התנתקת בהצלחה מהמערכת', 'info');
    }

    setUser(null);
    setToken(null);
    setCurrentView('gates');
    // Clear both localStorage and sessionStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
  }, []);

  // Check maintenance status
  const checkMaintenanceStatus = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/settings/maintenance');
      if (response.ok) {
        const data = await response.json();
        setMaintenanceMode(data.inMaintenance);
        setMaintenanceMessage(data.message);
      }
    } catch (error) {
      console.error('Error checking maintenance status:', error);
    }
  }, []);

  const verifyToken = useCallback(async (tokenToVerify, userData) => {
    try {
      const response = await authenticatedFetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Check if it's a session expiration error
        if (isSessionExpired(errorData)) {
          handleLogout();
          return;
        }

        // For other errors, keep user logged in but log the issue
        console.warn('Token verification failed but keeping user logged in:', errorData);
      } else {
        // Token is valid, update user data if needed
        const data = await response.json();
        if (JSON.stringify(data.user) !== JSON.stringify(userData)) {
          setUser(data.user);
          // Save to the same storage where token was found
          const storage = localStorage.getItem('authToken') ? localStorage : sessionStorage;
          storage.setItem('user', JSON.stringify(data.user));
        }
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      // On network error, keep the user logged in with cached data
      // but schedule a retry
      setTimeout(() => verifyToken(tokenToVerify, userData), 30000); // Retry in 30 seconds
    }
  }, [handleLogout]);

  const handleLogin = (userData, tokens) => {
    setUser(userData);
    setToken(tokens.accessToken);
    // Tokens are already stored in Login.js (localStorage or sessionStorage based on rememberMe)
    setCurrentView('gates'); // Default to gates view after login
  };

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  // Check for saved authentication on app load
  useEffect(() => {
    // Check localStorage first (remember me), then sessionStorage (session only)
    let savedToken = localStorage.getItem('authToken');
    let savedUser = localStorage.getItem('user');

    // If not in localStorage, check sessionStorage
    if (!savedToken || !savedUser) {
      savedToken = sessionStorage.getItem('authToken');
      savedUser = sessionStorage.getItem('user');
    }

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
        // Verify token is still valid
        verifyToken(savedToken, parsedUser);
      } catch (error) {
        console.error('Error parsing saved user:', error);
        handleLogout();
      }
    }

    // Check maintenance status
    checkMaintenanceStatus();

    setIsLoading(false);
  }, [verifyToken, handleLogout, checkMaintenanceStatus]);

  // Auto-refresh token every hour
  useEffect(() => {
    if (!token) return;

    const refreshInterval = setInterval(async () => {
      try {
        // Check localStorage first, then sessionStorage
        let refreshToken = localStorage.getItem('refreshToken');
        let storage = localStorage;

        if (!refreshToken) {
          refreshToken = sessionStorage.getItem('refreshToken');
          storage = sessionStorage;
        }

        if (refreshToken) {
          const response = await authenticatedFetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (response.ok) {
            const data = await response.json();
            setToken(data.accessToken);
            // Save to the same storage where refresh token was found
            storage.setItem('authToken', data.accessToken);
            storage.setItem('refreshToken', data.refreshToken);
          }
        }
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }, 60 * 60 * 1000); // Every hour

    return () => clearInterval(refreshInterval);
  }, [token]);

  // Show loading spinner during initial authentication check
  if (isLoading) {
    return (
      <div className="loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>טוען...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  // Check both state and storage to handle token refresh scenarios
  const hasTokenInState = !!(user && token);
  const hasTokenInStorage = !!(localStorage.getItem('authToken') || sessionStorage.getItem('authToken'));

  if (!hasTokenInState && !hasTokenInStorage) {
    return <Login onLogin={handleLogin} isLoading={isLoading} />;
  }

  // If token exists in storage but not in state, try to reload it
  if (!hasTokenInState && hasTokenInStorage) {
    const savedToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing saved user:', error);
      }
    }

    // Show loading while syncing
    return (
      <div className="loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>טוען...</p>
        </div>
      </div>
    );
  }

  // Main application for authenticated users
  return (
    <div className="App">
      {/* Maintenance Mode Banner */}
      {maintenanceMode && (
        <div className="maintenance-banner">
          <div className="maintenance-content">
            <span className="maintenance-icon">⚠️</span>
            <span className="maintenance-text">
              {maintenanceMessage || 'המערכת בתחזוקה כרגע'}
            </span>
          </div>
        </div>
      )}

      <Header
        user={user}
        currentView={currentView}
        onViewChange={handleViewChange}
        onLogout={handleLogout}
      />
      <main>
        {currentView === 'gates' ? (
          <GateDashboard
            user={user}
            token={token}
          />
        ) : currentView === 'users' && user.role === 'admin' ? (
          <UserManagement
            user={user}
            token={token}
          />
        ) : currentView === 'history' ? (
          <GateHistory
            user={user}
            token={token}
          />
        ) : currentView === 'settings' && user.role === 'admin' ? (
          <AdminSettings
            user={user}
            token={token}
          />
        ) : currentView === 'statistics' && user.role === 'admin' ? (
          <GateStatistics />
        ) : (
          // Fallback to gates if invalid view
          <GateDashboard
            user={user}
            token={token}
          />
        )}
      </main>
      <footer className="app-footer">
        <p>כל הזכויות שמורות לשקד יוסף</p>
      </footer>
    </div>
  );
}

export default App;
