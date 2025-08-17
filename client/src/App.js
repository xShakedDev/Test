import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import GateDashboard from './components/GateDashboard';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import { isSessionExpired } from './utils/auth';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentView, setCurrentView] = useState('gates'); // 'gates' or 'users'
  const [isLoading, setIsLoading] = useState(true);

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
    setIsLoading(false);
  }, []);

  const verifyToken = async (tokenToVerify, userData) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.log('Token verification failed:', errorData);
        
        // Check if it's a session expiration error
        if (isSessionExpired(errorData)) {
          console.log('Session expired, logging out user');
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
  };

  const handleLogin = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    setCurrentView('gates'); // Default to gates view after login
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setCurrentView('gates');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  };

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

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
