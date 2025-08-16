import React, { useState } from 'react';
import Header from './components/Header';
import GateDashboard from './components/GateDashboard';
import './App.css';

function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const handleAdminLogin = (password) => {
    setAdminPassword(password);
    setIsAdminLoggedIn(true);
  };

  const handleAdminLogout = () => {
    setAdminPassword('');
    setIsAdminLoggedIn(false);
  };

  return (
    <div className="App">
      <Header 
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogin={handleAdminLogin}
        onAdminLogout={handleAdminLogout}
      />
      <main>
        <GateDashboard 
          isAdminLoggedIn={isAdminLoggedIn}
          adminPassword={adminPassword}
        />
      </main>
    </div>
  );
}

export default App;
