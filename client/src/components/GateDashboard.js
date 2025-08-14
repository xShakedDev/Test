import React, { useState, useEffect } from 'react';
import { DoorOpen, Users, Edit, Trash2 } from 'lucide-react';
import axios from 'axios';

const GateDashboard = () => {
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

  useEffect(() => {
    fetchGates();
  }, []);

  const fetchGates = async () => {
    try {
      const response = await axios.get('/api/gates');
      setGates(response.data.gates);
    } catch (error) {
      setError('Failed to fetch gates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenGate = async (gate) => {
    try {
      const response = await axios.post(`/api/gates/${gate.id}/open`);
      
      // Refresh gates to get updated information
      fetchGates();
      setError('');
      
      // Show success message
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
      const response = await axios.put(`/api/gates/${editingGate.id}`, {
        name: newGateData.name,
        phoneNumber: newGateData.phoneNumber,
        authorizedNumber: newGateData.authorizedNumber
      });
      
      // Reset form and hide it
      setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '' });
      setEditingGate(null);
      setError('');
      
      // Refresh gates list
      fetchGates();
      
      alert('Gate updated successfully!');
      
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update gate');
    }
  };

  const handleDeleteGate = async (gate) => {
    if (window.confirm(`Are you sure you want to delete "${gate.name}"?`)) {
      try {
        await axios.delete(`/api/gates/${gate.id}`);
        
        // Refresh gates list
        fetchGates();
        setError('');
        
        alert('Gate deleted successfully!');
        
      } catch (error) {
        setError(error.response?.data?.error || 'Failed to delete gate');
      }
    }
  };

  const handleAddGate = async (e) => {
    e.preventDefault();
    
    try {
      const response = await axios.post('/api/gates', {
        name: newGateData.name,
        phoneNumber: newGateData.phoneNumber,
        authorizedNumber: newGateData.authorizedNumber
      });
      
      // Reset form and hide it
      setNewGateData({ name: '', phoneNumber: '', authorizedNumber: '' });
      setShowAddGate(false);
      setError('');
      
      // Refresh gates list
      fetchGates();
      
      alert('Gate created successfully!');
      
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to create gate');
    }
  };

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
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddGate(true)}
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
                  onClick={() => handleEditGate(gate)}
                  title="Edit Gate"
                >
                  <Edit className="btn-icon" />
                </button>
                <button 
                  className="btn btn-small btn-danger"
                  onClick={() => handleDeleteGate(gate)}
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
                <span className="authorized-number">
                  {gate.authorizedNumber}
                </span>
              </div>
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
