import React from 'react';
import GateDashboard from './components/GateDashboard';
import './index.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>🚪 Gate Control System</h1>
        <p>Simple gate control without phone verification</p>
      </header>
      <main>
        <GateDashboard />
      </main>
    </div>
  );
}

export default App;
