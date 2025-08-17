import React, { useState, useEffect, useCallback } from 'react';
import { isSessionExpired, handleSessionExpiration } from '../utils/auth';

const UserManagement = ({ user, token }) => {
  const [users, setUsers] = useState([]);
  const [gates, setGates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'user',
    authorizedGates: []
  });

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Users data received:', data); // Debug log
        setUsers(data);
      } else {
        const errorData = await response.json();
        if (isSessionExpired(errorData)) {
          handleSessionExpiration();
          return;
        }
        setError('שגיאה בטעינת משתמשים');
      }
    } catch (error) {
      setError('שגיאת רשת');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchGates = useCallback(async () => {
    try {
      const response = await fetch('/api/gates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGates(data.gates || []);
      } else {
        const errorData = await response.json();
        if (isSessionExpired(errorData)) {
          handleSessionExpiration();
          return;
        }
        console.error('Error fetching gates:', errorData);
      }
    } catch (error) {
      console.error('Error fetching gates:', error);
    }
  }, [token]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
      fetchGates();
    }
  }, [user, fetchUsers, fetchGates]);



  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'authorizedGates') {
      const gateId = value;
      setFormData(prev => ({
        ...prev,
        authorizedGates: checked 
          ? [...prev.authorizedGates, gateId]
          : prev.authorizedGates.filter(id => id !== gateId)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      name: '',
      role: 'user',
      authorizedGates: []
    });
    setEditingUser(null);
    setShowCreateForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      console.log('editingUser:', editingUser); // Debug log
      
      // Validate that editingUser has an id when updating
      if (editingUser && !editingUser.id) {
        console.error('editingUser missing id:', editingUser);
        setError('שגיאה: מזהה משתמש חסר');
        return;
      }
      
      const url = editingUser 
        ? `/api/auth/users/${editingUser.id}` 
        : '/api/auth/users';
      
      console.log('URL:', url); // Debug log
      
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setError('');
        resetForm();
        await fetchUsers();
      } else {
        const data = await response.json();
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }
        setError(data.error || 'שגיאה בשמירת המשתמש');
      }
    } catch (error) {
      setError('שגיאת רשת');
    }
  };

  const handleEdit = (userItem) => {
    console.log('userItem in handleEdit:', userItem); // Debug log
    setEditingUser(userItem);
    setFormData({
      username: userItem.username,
      password: '',
      name: userItem.name,
      role: userItem.role,
      authorizedGates: userItem.authorizedGates ? userItem.authorizedGates.map(gate => 
        typeof gate === 'object' && gate._id ? gate._id.toString() : gate.toString()
      ) : []
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (userId, username) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את המשתמש "${username}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setError('');
        await fetchUsers();
      } else {
        const data = await response.json();
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }
        setError(data.error || 'שגיאה במחיקת המשתמש');
      }
    } catch (error) {
      setError('שגיאת רשת');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>טוען משתמשים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>ניהול משתמשים</h1>
          <p>ניהול משתמשי המערכת והרשאותיהם</p>
          
          <div className="admin-actions">
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn btn-primary"
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>משתמש חדש</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Create/Edit User Form */}
      {showCreateForm && (
        <div className="form-container">
          <h3>{editingUser ? 'ערוך משתמש' : 'משתמש חדש'}</h3>
          <p>{editingUser ? 'עדכן את פרטי המשתמש' : 'צור משתמש חדש במערכת'}</p>
          
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="username">שם משתמש *</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  disabled={editingUser}
                />
                <small>שם משתמש ייחודי להתחברות</small>
              </div>

              <div className="form-group">
                <label htmlFor="password">סיסמה {editingUser ? '' : '*'}</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!editingUser}
                />
                <small>{editingUser ? 'השאר ריק אם אינך רוצה לשנות' : 'סיסמה להתחברות'}</small>
              </div>

              <div className="form-group">
                <label htmlFor="name">שם מלא *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
                <small>שם מלא של המשתמש</small>
              </div>

              <div className="form-group">
                <label htmlFor="role">תפקיד *</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                >
                  <option value="user">משתמש</option>
                  <option value="admin">מנהל</option>
                </select>
                <small>תפקיד המשתמש במערכת</small>
              </div>
            </div>

            <div className="form-group">
              <label>שערים מורשים</label>
              <div className="gates-checkbox-grid">
                {gates.map(gate => {
                  const gateId = gate.id || gate._id;
                  return (
                    <label key={gateId} className="gate-checkbox-item">
                      <input
                        type="checkbox"
                        name="authorizedGates"
                        value={gateId}
                        checked={formData.authorizedGates.some(id => 
                          (typeof id === 'object' && id._id ? id._id.toString() : id.toString()) === gateId.toString()
                        )}
                        onChange={handleInputChange}
                      />
                      <span className="gate-checkbox-label">{gate.name}</span>
                    </label>
                  );
                })}
              </div>
              <small>בחר איזה שערים המשתמש יכול לפתוח</small>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary"
              >
                ביטול
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                {editingUser ? 'עדכן' : 'צור'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="users-table-container">
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>שם משתמש</th>
                <th>שם מלא</th>
                <th>תפקיד</th>
                <th>שערים מורשים</th>
                <th>תאריך יצירה</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {users.map(userItem => (
                <tr key={userItem.id} className="user-row">
                  <td className="user-username">
                    {userItem.username}
                    {userItem.id === user.id && (
                      <span className="current-user-badge">(אתה)</span>
                    )}
                  </td>
                  <td className="user-name">{userItem.name}</td>
                  <td className="user-role">
                    <span className={`role-badge role-${userItem.role}`}>
                      {userItem.role === 'admin' ? 'מנהל' : 'משתמש'}
                    </span>
                  </td>
                  <td className="user-gates">
                    {userItem.role === 'admin' ? (
                      <span className="all-gates-badge">כל השערים</span>
                    ) : userItem.authorizedGates && userItem.authorizedGates.length > 0 ? (
                      <div className="user-gates-list">
                        {userItem.authorizedGates.map(gateId => {
                          // Handle both ObjectId and string cases
                          const gateIdStr = typeof gateId === 'object' && gateId._id ? gateId._id.toString() : gateId.toString();
                          const gate = gates.find(g => g.id === gateIdStr || g._id === gateIdStr);
                          return gate ? (
                            <span key={gate.id || gate._id} className="gate-badge">
                              {gate.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <span className="no-gates-badge">אין הרשאות</span>
                    )}
                  </td>
                  <td className="user-created">
                    {new Date(userItem.createdAt).toLocaleDateString('he-IL')}
                  </td>
                  <td className="user-actions">
                    {userItem.id !== user.id && (
                      <div className="user-action-buttons">
                        <button
                          onClick={() => handleEdit(userItem)}
                          className="btn btn-small"
                        >
                          ערוך
                        </button>
                        <button
                          onClick={() => handleDelete(userItem.id, userItem.username)}
                          className="btn btn-danger btn-small"
                        >
                          מחק
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
