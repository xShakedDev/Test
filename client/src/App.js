import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import GateDashboard from './components/GateDashboard';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import GateHistory from './components/GateHistory';
import AdminSettings from './components/AdminSettings';
import { isSessionExpired, authenticatedFetch } from './utils/auth';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentView, setCurrentView] = useState('gates'); // 'gates' or 'users'
  const [isLoading, setIsLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  const handleLogout = useCallback(() => {
    // Show system notification if enabled
    if (window.showSystemNotification) {
      window.showSystemNotification('התנתקת בהצלחה מהמערכת', 'info');
    }
    
    setUser(null);
    setToken(null);
    setCurrentView('gates');
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
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
          localStorage.setItem('user', JSON.stringify(data.user));
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
    // Store refresh token in localStorage
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setCurrentView('gates'); // Default to gates view after login
  };

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  // Check for saved authentication on app load
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    
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
  }, [verifyToken, handleLogout, checkMaintenanceStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh token every hour
  useEffect(() => {
    if (!token) return;
    
    const refreshInterval = setInterval(async () => {
      try {
        const refreshToken = localStorage.getItem('refreshToken');
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
            localStorage.setItem('authToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            console.log('Token refreshed automatically');
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
  if (!user || !token) {
    return <Login onLogin={handleLogin} isLoading={isLoading} />;
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
        ) : (
          // Fallback to gates if invalid view
          <GateDashboard 
            user={user}
            token={token}
          />
        )}
      </main>
    </div>
  );
}

export default App;
