import React, { useState, useEffect } from 'react';
import { DoorOpen, Users, Edit, Trash2 } from 'lucide-react';
import axios from 'axios';

const GateDashboard = () => {
  // State
  const [gates, setGates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddGate, setShowAddGate] = useState(false);
  const [editingGate, setEditingGate] = useState(null);
  const [newGateData, setNewGateData] = useState({
    name: '',
    phoneNumber: '',
    authorizedNumber: ''
  });
  const [globalPassword, setGlobalPassword] = useState('');
  const [twilioBalance, setTwilioBalance] = useState(null);

  // Effects
  useEffect(() => {
    fetchGates();
  }, []);

  useEffect(() => {
    if (globalPassword) {
      fetchTwilioBalance(globalPassword);
    }
  }, [globalPassword]);

  // API Functions
  const fetchGates = async () => {
    try {
      const response = await axios.get('/api/gates');
      setGates(response.data.gates);
      setError('');
    } catch (error) {
      console.error('Error fetching gates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTwilioBalance = async (password = globalPassword) => {
    if (!password) return;
    
    try {
      const response = await axios.get('/api/twilio/balance', {
        headers: { 'x-admin-password': password }
      });
      setTwilioBalance(response.data);
    } catch (error) {
      console.error('Failed to fetch Twilio balance:', error);
    }
  };

  // Password validation
  const validatePassword = async (password) => {
    try {
      await axios.get('/api/twilio/balance', {
        headers: { 'x-admin-password': password }
      });
      setGlobalPassword(password);
      fetchTwilioBalance(password); // Pass the password to fetch balance
      return true;
    } catch {
      alert('Invalid admin password. Please try again.');
      return false;
    }
  };

  // Gate operations
  const handleOpenGate = async (gate) => {
    try {
      await axios.post(`/api/gates/${gate.id}/open`);
      fetchGates();
      alert(`Opening gate "${gate.name}" via phone call to ${gate.phoneNumber}`);
    } catch (error) {
      setError('Failed to open gate');
    }
  };

  const handleEditGate = (gate) => {
    setEditingGate(gate);
    setNewGateData({
      name: gate.name,
      phoneNumber: gate.phoneNumber,
      authorizedNumber: gate.authorizedNumber
    });
  };

  const handleUpdateGate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/gates/${editingGate.id}`, newGateData, {
        headers: { 'x-admin-password': globalPassword }
      });
      
      setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '' });
      setEditingGate(null);
      setError('');
      alert('Gate updated successfully!');
      
      setTimeout(fetchGates, 500);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update gate');
    }
  };

  const handleDeleteGate = async (gate) => {
    if (window.confirm(`Are you sure you want to delete "${gate.name}"?`)) {
      try {
        await axios.delete(`/api/gates/${gate.id}`, {
          headers: { 'x-admin-password': globalPassword }
        });
        
        alert('Gate deleted successfully!');
        setTimeout(fetchGates, 500);
        setError('');
      } catch (error) {
        setError(error.response?.data?.error || 'Failed to delete gate');
      }
    }
  };

  const handleAddGate = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/gates', newGateData, {
        headers: { 'x-admin-password': globalPassword }
      });
      
      setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '' });
      setShowAddGate(false);
      setError('');
      alert('Gate created successfully!');
      
      setTimeout(fetchGates, 500);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to create gate');
    }
  };

  // Form handlers
  const handleCancelAddGate = () => {
    setShowAddGate(false);
    setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '' });
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingGate(null);
    setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '' });
    setError('');
  };

  // Button click handlers
  const handleAddButtonClick = async () => {
    if (!globalPassword) {
      const password = prompt('Enter admin password to add new gates:');
      if (password && await validatePassword(password)) {
        setShowAddGate(true);
      }
    } else {
      setShowAddGate(true);
    }
  };

  const handleEditButtonClick = async (gate) => {
    if (!globalPassword) {
      const password = prompt(`Enter admin password to edit "${gate.name}":`);
      if (password && await validatePassword(password)) {
        handleEditGate(gate);
      }
    } else {
      handleEditGate(gate);
    }
  };

  const handleDeleteButtonClick = async (gate) => {
    if (!globalPassword) {
      const password = prompt(`Enter admin password to delete "${gate.name}":`);
      if (password && await validatePassword(password)) {
        handleDeleteGate(gate);
      }
    } else {
      handleDeleteGate(gate);
    }
  };

  if (isLoading) {
    return (
      <div className="loading">
        <p>Loading gates...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
             <div className="dashboard-header">
        <div>
          <h2>Gate Control Dashboard</h2>
          <p>Control your gates via phone calls</p>
          <p className="admin-notice">🔒 Admin access required to add, edit, or delete gates</p>
          
          {/* Show Twilio Balance only if password is verified */}
          {globalPassword && (
            <div className="admin-status-section">
              <p className="password-status">✅ Admin password verified - you can now manage gates</p>
              
              {twilioBalance && (
                <div className="twilio-balance">
                  <div className="balance-card">
                    <div className="balance-icon">💰</div>
                    <div className="balance-details">
                      <span className="balance-label">Twilio Account Balance </span>
                      <span className="balance-amount">{twilioBalance.balance} {twilioBalance.currency}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <button 
          className="btn btn-primary"
          onClick={handleAddButtonClick}
        >
          <DoorOpen className="btn-icon" />
          Add New Gate
        </button>
      </div>

      {/* Add New Gate Form */}
      {showAddGate && (
        <div className="form-container">
          <form onSubmit={handleAddGate} className="phone-input-form">
            <h3>Add New Gate</h3>
            <p>Create a new gate with its phone number and authorized number</p>
            
            <div className="form-group">
              <label htmlFor="gateName">Gate Name</label>
              <input
                type="text"
                id="gateName"
                value={newGateData.name}
                onChange={(e) => setNewGateData({...newGateData, name: e.target.value})}
                placeholder="Main Gate"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="gatePhone">Gate Phone Number</label>
              <input
                type="tel"
                id="gatePhone"
                value={newGateData.phoneNumber}
                onChange={(e) => setNewGateData({...newGateData, phoneNumber: e.target.value})}
                placeholder="+1234567890"
                required
              />
              <small>Phone number of the gate device</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="authorizedNumber">Authorized Phone Number</label>
              <input
                type="tel"
                id="authorizedNumber"
                value={newGateData.authorizedNumber}
                onChange={(e) => setNewGateData({...newGateData, authorizedNumber: e.target.value})}
                placeholder="+972542070400"
                required
              />
              <small>Phone number that can open this gate</small>
            </div>
            
                         <div className="form-group">
               <label htmlFor="adminPassword">Admin Password</label>
               <input
                 type="password"
                 id="adminPassword"
                 value="••••••••••"
                 placeholder="Password already verified"
                 required
                 disabled
               />
               <small>Password already verified</small>
             </div>
            
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Create Gate
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={handleCancelAddGate}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Gate Form */}
      {editingGate && (
        <div className="form-container">
          <form onSubmit={handleUpdateGate} className="phone-input-form">
            <h3>Edit Gate: {editingGate.name}</h3>
            <p>Update the gate information</p>
            
            <div className="form-group">
              <label htmlFor="editGateName">Gate Name</label>
              <input
                type="text"
                id="editGateName"
                value={newGateData.name}
                onChange={(e) => setNewGateData({...newGateData, name: e.target.value})}
                placeholder="Main Gate"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="editGatePhone">Gate Phone Number</label>
              <input
                type="tel"
                id="editGatePhone"
                value={newGateData.phoneNumber}
                onChange={(e) => setNewGateData({...newGateData, phoneNumber: e.target.value})}
                placeholder="+1234567890"
                required
              />
              <small>Phone number of the gate device</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="editAuthorizedNumber">Authorized Phone Number</label>
              <input
                type="tel"
                id="editAuthorizedNumber"
                value={newGateData.authorizedNumber}
                onChange={(e) => setNewGateData({...newGateData, authorizedNumber: e.target.value})}
                placeholder="+972542070400"
                required
              />
              <small>Phone number that can open this gate</small>
            </div>
            
                         <div className="form-group">
               <label htmlFor="editAdminPassword">Admin Password</label>
               <input
                 type="password"
                 id="editAdminPassword"
                 value="••••••••••"
                 placeholder="Password already verified"
                 required
                 disabled
               />
               <small>Password already verified</small>
             </div>
            
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Update Gate
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      <div className="gates-grid">
        {gates.map(gate => (
          <div key={gate.id} className="gate-card">
            <div className="gate-header">
              <h3>{gate.name}</h3>
              <div className="gate-actions-header">
                <button 
                  className="btn btn-small btn-secondary"
                  onClick={() => handleEditButtonClick(gate)}
                  title="Edit Gate"
                >
                  <Edit className="btn-icon" />
                </button>
                <button 
                  className="btn btn-small btn-danger"
                  onClick={() => handleDeleteButtonClick(gate)}
                  title="Delete Gate"
                >
                  <Trash2 className="btn-icon" />
                </button>
              </div>
            </div>
            
            <div className="gate-info">
              <p><strong>Gate Phone:</strong> {gate.phoneNumber}</p>
              <p><strong>Last opened:</strong> {gate.lastOpenedAt ? new Date(gate.lastOpenedAt).toLocaleString() : 'never'}</p>
              {gate.lastCallStatus && (
                <p><strong>Last call status:</strong> {gate.lastCallStatus}</p>
              )}
            </div>

            <div className="gate-authorized">
              <h4><Users className="icon-small" /> Authorized Number</h4>
              <div className="authorized-numbers">
                {globalPassword ? (
                  <span className="authorized-number">
                    {gate.authorizedNumber}
                  </span>
                ) : (
                  <span className="authorized-number hidden">
                    ••••••••••
                  </span>
                )}
              </div>
              {!globalPassword && (
                <small className="password-notice">
                  Enter admin password to view authorized numbers
                </small>
              )}
            </div>
            
            <div className="gate-actions">
              <button 
                className="btn btn-primary gate-open-btn"
                onClick={() => handleOpenGate(gate)}
              >
                <DoorOpen className="btn-icon" />
                Open Gate
              </button>
            </div>
          </div>
        ))}
      </div>

      {gates.length === 0 && (
        <div className="no-gates">
          <p>No gates found.</p>
        </div>
      )}
    </div>
  );
};

export default GateDashboard;
