import React, { useState, useEffect, useCallback, useRef } from 'react';
import { isSessionExpired, handleSessionExpiration, authenticatedFetch } from '../utils/auth';

const UserManagement = ({ user, token }) => {
  const [users, setUsers] = useState([]);
  const [gates, setGates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'user',
    authorizedGates: []
  });

  // Search state for gates
  const [gateSearchInput, setGateSearchInput] = useState('');
  const gateInputRefCreate = useRef(null);
  const gateInputRefEdit = useRef(null);
  
  // Mobile gate item hint
  const [gateHint, setGateHint] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Refs for scrolling to messages
  const errorRef = useRef(null);
  const successRef = useRef(null);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/auth/users');
      
        if (response.ok) {
          const data = await response.json();
          setUsers(data);
        } else {
          const errorData = await response.json();
          if (isSessionExpired(errorData)) {
            handleSessionExpiration();
            return;
          }
          const msg = 'שגיאה בטעינת משתמשים';
          setError(msg);
          if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
          scrollToMessage('error');
        }
    } catch (error) {
      const msg = 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
      scrollToMessage('error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGates = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/gates');
      
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
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
      fetchGates();
    }
  }, [user, fetchUsers, fetchGates]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error]);

  // Check notification settings
  useEffect(() => {
    const checkNotificationSettings = async () => {
      try {
        const response = await authenticatedFetch('/api/settings/current');
        if (response.ok) {
          const data = await response.json();
          setNotificationsEnabled(data.settings?.enableNotifications || false);
        }
      } catch (error) {
        console.error('Error fetching notification settings:', error);
      }
    };
    
    checkNotificationSettings();
  }, []);

  // Function to scroll to error or success message
  const scrollToMessage = (type) => {
    const ref = type === 'error' ? errorRef : successRef;
    if (ref.current) {
      ref.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
    }
  };

  // Handle cell click on mobile - show gate information tooltip
  const handleCellClick = (content, element) => {
    if (isMobile) {
      setGateHint({ content, element });
      // Auto-hide after 3 seconds
      setTimeout(() => {
        setGateHint(null);
      }, 3000);
    }
  };



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

  // Handle gate search input change
  const handleGateSearchChange = (e) => {
    const value = e.target.value;
    setGateSearchInput(value);
  };

  // Handle gate removal
  const handleGateRemove = (gateIdToRemove) => {
    setFormData(prev => ({
      ...prev,
      authorizedGates: prev.authorizedGates.filter(id => {
        const idStr = typeof id === 'object' && id.id ? id.id.toString() : id.toString();
        return idStr !== gateIdToRemove.toString();
      })
    }));
  };

  // Handle moving gate from available to selected
  const handleGateAdd = (gateId) => {
    const idStr = gateId.toString();
    const isAlreadySelected = formData.authorizedGates.some(id => {
      const idStr2 = typeof id === 'object' && id.id ? id.id.toString() : id.toString();
      return idStr2 === idStr;
    });

    if (!isAlreadySelected) {
      setFormData(prev => ({
        ...prev,
        authorizedGates: [...prev.authorizedGates, idStr]
      }));
    }
  };

  // Get filtered gates based on search
  const getFilteredGates = () => {
    const selectedGateIds = formData.authorizedGates.map(id => 
      typeof id === 'object' && id.id ? id.id.toString() : id.toString()
    );

    let filtered = gates;

    // Filter by search input if exists
    if (gateSearchInput.trim() !== '') {
      filtered = gates.filter(gate => {
        const gateId = (gate.id || gate._id).toString();
        return gate.name.toLowerCase().includes(gateSearchInput.toLowerCase()) ||
               gateId.includes(gateSearchInput);
      });
    }

    // Split into available and selected
    const available = filtered.filter(gate => {
      const gateId = (gate.id || gate._id).toString();
      return !selectedGateIds.includes(gateId);
    });

    const selected = filtered.filter(gate => {
      const gateId = (gate.id || gate._id).toString();
      return selectedGateIds.includes(gateId);
    });

    return { available, selected };
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
    setError('');
    setSuccessMessage('');
    setGateSearchInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Validate that editingUser has an id when updating
      if (editingUser && !editingUser.id) {
        const msg = 'שגיאה: מזהה משתמש חסר';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
        scrollToMessage('error');
        return;
      }

      // For editing users, if password is empty, don't send it
      // Convert username to lowercase to ignore case sensitivity
      const dataToSend = { 
        ...formData,
        username: formData.username.toLowerCase().trim()
      };
      if (editingUser && !dataToSend.password.trim()) {
        delete dataToSend.password;
      }
      
      const url = editingUser 
        ? `/api/auth/users/${editingUser.id}` 
        : '/api/auth/users';
      
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await authenticatedFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        const data = await response.json();
        setError('');
        const msg = data.message || (editingUser ? 'משתמש עודכן בהצלחה!' : 'משתמש נוצר בהצלחה!');
        setSuccessMessage(msg);
        scrollToMessage('success');
        
        // Show system notification
        if (window.showSystemNotification) {
          if (editingUser) {
            window.showSystemNotification(`משתמש "${formData.username}" עודכן בהצלחה`, 'success');
          } else {
            window.showSystemNotification(`משתמש "${formData.username}" נוצר בהצלחה`, 'success');
          }
        }
        
        resetForm();
        await fetchUsers();
      } else {
        const data = await response.json();
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }
        const msg = data.error || 'שגיאה בשמירת המשתמש';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(`שגיאה בשמירת המשתמש: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        scrollToMessage('error');
      }
    } catch (error) {
      const msg = 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification('שגיאת רשת בשמירת המשתמש', 'error');
    }
  };

  const handleEdit = (userItem) => {
    setEditingUser(userItem);
    setFormData({
      username: userItem.username,
      password: '',
      name: userItem.name,
      role: userItem.role,
      authorizedGates: userItem.authorizedGates ? userItem.authorizedGates.map(gate => 
        typeof gate === 'object' && gate.id ? gate.id.toString() : gate.toString()
      ) : []
    });
    setGateSearchInput('');
  };

  const handleDelete = async (userId, username) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את המשתמש "${username}"?`)) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/auth/users/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const data = await response.json();
        setError('');
        const msg = data.message || 'משתמש נמחק בהצלחה!';
        setSuccessMessage(msg);
        scrollToMessage('success');
        
        if (window.showSystemNotification) {
          window.showSystemNotification(`משתמש "${username}" נמחק בהצלחה`, 'info');
        }
        
        await fetchUsers();
      } else {
        const data = await response.json();
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }
        const msg = data.error || 'שגיאה במחיקת המשתמש';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(`שגיאה במחיקת המשתמש: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        scrollToMessage('error');
      }
    } catch (error) {
      const msg = 'שגיאת רשת';
      console.error('Delete user error:', error);
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification('שגיאת רשת במחיקת המשתמש', 'error');
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

      {/* Error/Success - kept for accessibility if notifications disabled */}
      {error && !notificationsEnabled && (
        <div className="error-message" ref={errorRef}>
          <span>{error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {successMessage && !notificationsEnabled && (
        <div className="success-message" ref={successRef}>
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')}>✕</button>
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && !editingUser && (
        <div className="form-container">
          <h3>משתמש חדש</h3>
          <p>צור משתמש חדש במערכת</p>
          
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="username">שם משתמש:</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  className="form-input"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                />
                <small>שם משתמש ייחודי להתחברות</small>
              </div>

              <div className="form-group">
                <label htmlFor="password">סיסמה:</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="form-input"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="הזן סיסמה"
                  autoComplete="new-password"
                />
                <small>סיסמה להתחברות</small>
              </div>

              <div className="form-group">
                <label htmlFor="name">שם מלא:</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="form-input"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
                <small>שם מלא של המשתמש</small>
              </div>

              <div className="form-group">
                <label htmlFor="role">תפקיד:</label>
                <select
                  id="role"
                  name="role"
                  className="form-select"
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

            <div className="form-group gates-form-group">
              <label>שערים מורשים</label>
              
              {/* Search input */}
              <div className="gate-search-wrapper">
                <input
                  type="text"
                  className="form-input gate-search-input"
                  placeholder="חפש שער לפי שם או מספר..."
                  value={gateSearchInput}
                  onChange={handleGateSearchChange}
                  ref={gateInputRefCreate}
                />
              </div>

              {/* Two-column gates table */}
              {(() => {
                const { available, selected } = getFilteredGates();
                return (
                  <div className="gates-transfer-table">
                    <div className="gates-column gates-available">
                      <div className="gates-column-header">
                        <h4>שערים זמינים</h4>
                        <span className="gates-count">({available.length})</span>
                      </div>
                      <div className="gates-list">
                        {available.length > 0 ? (
                          available.map(gate => {
                            const gateId = (gate.id || gate._id).toString();
                            return (
                              <div 
                                key={gateId} 
                                className="gate-item"
                                onClick={(e) => {
                                  if (isMobile && e.target.tagName !== 'BUTTON') {
                                    handleCellClick(`${gate.name} (#${gateId})`, e.currentTarget);
                                  }
                                }}
                              >
                                <span className="gate-item-name">{gate.name}</span>
                                <span className="gate-item-id">#{gateId}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGateAdd(gateId);
                                  }}
                                  className="gate-transfer-btn gate-add-btn"
                                  aria-label="הוסף שער"
                                  title="הוסף שער"
                                >
                                  ←
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <div className="gates-empty">אין שערים זמינים</div>
                        )}
                      </div>
                    </div>

                    <div className="gates-column gates-selected">
                      <div className="gates-column-header">
                        <h4>שערים מורשים</h4>
                        <span className="gates-count">({selected.length})</span>
                      </div>
                      <div className="gates-list">
                        {selected.length > 0 ? (
                          selected.map(gate => {
                            const gateId = (gate.id || gate._id).toString();
                            return (
                              <div 
                                key={gateId} 
                                className="gate-item"
                                onClick={(e) => {
                                  if (isMobile && e.target.tagName !== 'BUTTON') {
                                    handleCellClick(`${gate.name} (#${gateId})`, e.currentTarget);
                                  }
                                }}
                              >
                                <span className="gate-item-name">{gate.name}</span>
                                <span className="gate-item-id">#{gateId}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGateRemove(gateId);
                                  }}
                                  className="gate-transfer-btn gate-remove-btn"
                                  aria-label="הסר שער"
                                  title="הסר שער"
                                >
                                  →
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <div className="gates-empty">אין שערים מורשים</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              <small>השתמש בשדה החיפוש כדי לסנן שערים, והעבר שערים בין הטורים</small>
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
                צור
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Form */}
      {editingUser && (
        <div className="form-container">
          <h3>ערוך משתמש</h3>
          <p>ערוך פרטי משתמש במערכת</p>
          
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor={`username-edit-${editingUser.id}`}>שם משתמש:</label>
                <input
                  type="text"
                  id={`username-edit-${editingUser.id}`}
                  name="username"
                  className="form-input"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  disabled={true}
                />
                <small>שם משתמש ייחודי להתחברות</small>
              </div>

              <div className="form-group">
                <label htmlFor={`password-edit-${editingUser.id}`}>סיסמה:</label>
                <input
                  type="password"
                  id={`password-edit-${editingUser.id}`}
                  name="password"
                  className="form-input"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="השאר ריק אם אינך רוצה לשנות"
                  autoComplete="new-password"
                />
                <small>השאר ריק אם אינך רוצה לשנות</small>
              </div>

              <div className="form-group">
                <label htmlFor={`name-edit-${editingUser.id}`}>שם מלא:</label>
                <input
                  type="text"
                  id={`name-edit-${editingUser.id}`}
                  name="name"
                  className="form-input"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
                <small>שם מלא של המשתמש</small>
              </div>

              <div className="form-group">
                <label htmlFor={`role-edit-${editingUser.id}`}>תפקיד:</label>
                <select
                  id={`role-edit-${editingUser.id}`}
                  name="role"
                  className="form-select"
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

            <div className="form-group gates-form-group">
              <label>שערים מורשים</label>
              
              {/* Search input */}
              <div className="gate-search-wrapper">
                <input
                  type="text"
                  className="form-input gate-search-input"
                  placeholder="חפש שער לפי שם או מספר..."
                  value={gateSearchInput}
                  onChange={handleGateSearchChange}
                  ref={gateInputRefEdit}
                />
              </div>

              {/* Two-column gates table */}
              {(() => {
                const { available, selected } = getFilteredGates();
                return (
                  <div className="gates-transfer-table">
                    <div className="gates-column gates-available">
                      <div className="gates-column-header">
                        <h4>שערים זמינים</h4>
                        <span className="gates-count">({available.length})</span>
                      </div>
                      <div className="gates-list">
                        {available.length > 0 ? (
                          available.map(gate => {
                            const gateId = (gate.id || gate._id).toString();
                            return (
                              <div 
                                key={gateId} 
                                className="gate-item"
                                onClick={(e) => {
                                  if (isMobile && e.target.tagName !== 'BUTTON') {
                                    handleCellClick(`${gate.name} (#${gateId})`, e.currentTarget);
                                  }
                                }}
                              >
                                <span className="gate-item-name">{gate.name}</span>
                                <span className="gate-item-id">#{gateId}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGateAdd(gateId);
                                  }}
                                  className="gate-transfer-btn gate-add-btn"
                                  aria-label="הוסף שער"
                                  title="הוסף שער"
                                >
                                  ←
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <div className="gates-empty">אין שערים זמינים</div>
                        )}
                      </div>
                    </div>

                    <div className="gates-column gates-selected">
                      <div className="gates-column-header">
                        <h4>שערים מורשים</h4>
                        <span className="gates-count">({selected.length})</span>
                      </div>
                      <div className="gates-list">
                        {selected.length > 0 ? (
                          selected.map(gate => {
                            const gateId = (gate.id || gate._id).toString();
                            return (
                              <div 
                                key={gateId} 
                                className="gate-item"
                                onClick={(e) => {
                                  if (isMobile && e.target.tagName !== 'BUTTON') {
                                    handleCellClick(`${gate.name} (#${gateId})`, e.currentTarget);
                                  }
                                }}
                              >
                                <span className="gate-item-name">{gate.name}</span>
                                <span className="gate-item-id">#{gateId}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGateRemove(gateId);
                                  }}
                                  className="gate-transfer-btn gate-remove-btn"
                                  aria-label="הסר שער"
                                  title="הסר שער"
                                >
                                  →
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <div className="gates-empty">אין שערים מורשים</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              <small>השתמש בשדה החיפוש כדי לסנן שערים, והעבר שערים בין הטורים</small>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  resetForm();
                }}
                className="btn btn-secondary"
              >
                ביטול
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                עדכן
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      {!showCreateForm && !editingUser && (
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
                        {userItem.authorizedGates.map(gateEntry => {
                          const gateKey = (typeof gateEntry === 'object' && gateEntry.id != null) ? gateEntry.id : gateEntry;
                          const gateFromList = gates.find(g => String(g.id) === String(gateKey) || String(g._id) === String(gateKey));
                          const displayName = (typeof gateEntry === 'object' && gateEntry.name) 
                            ? gateEntry.name 
                            : (gateFromList ? gateFromList.name : `שער ${gateKey}`);
                          const key = String(gateKey);
                          return (
                            <span key={key} className="gate-badge">
                              {displayName}
                            </span>
                          );
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
                          className="btn btn-primary btn-small"
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
      )}

      {/* Mobile Gate Hint Tooltip */}
      {gateHint && gateHint.element && (
        <div 
          className="gate-hint-tooltip"
          style={{
            position: 'fixed',
            top: `${gateHint.element.getBoundingClientRect().top - 45}px`,
            left: `${gateHint.element.getBoundingClientRect().left + gateHint.element.offsetWidth / 2}px`,
            transform: 'translateX(-50%)'
          }}
        >
          {gateHint.content}
        </div>
      )}
    </div>
  );
};

export default UserManagement;
