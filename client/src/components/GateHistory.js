import React, { useState, useEffect, useRef } from 'react';
import { isSessionExpired, handleSessionExpiration } from '../utils/auth';

const GateHistory = ({ user, token }) => {
  const [history, setHistory] = useState([]);
  const [gates, setGates] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filter, setFilter] = useState('all'); // all, gate, user, date
  const [filterValue, setFilterValue] = useState('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Refs for scrolling to messages
  const errorRef = useRef(null);
  const successRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    if (filter === 'gate') {
      fetchGates();
    } else if (filter === 'user') {
      fetchUsers();
    }
  }, [filter, filterValue, dateFilter, token]);

  // Function to scroll to messages
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

  const fetchGates = async () => {
    try {
      const response = await fetch('/api/gates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGates(data.gates || []);
      }
    } catch (error) {
      console.error('Error fetching gates:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/auth/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const usersList = await response.json();
        setUsers(usersList || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      let url = '/api/gates/history?limit=100';
      if (filter === 'gate' && filterValue) {
        url += `&gateName=${encodeURIComponent(filterValue)}`;
              } else if (filter === 'user' && filterValue) {
          url += `&username=${encodeURIComponent(filterValue)}`;
        } else if (filter === 'date' && dateFilter.start && dateFilter.end) {
        url += `&startDate=${dateFilter.start}&endDate=${dateFilter.end}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
        setSelectedLogs([]);
        setSelectAll(false);
      } else {
        const errorData = await response.json();
        if (isSessionExpired(errorData)) {
          handleSessionExpiration();
          return;
        }
        setError(errorData.error || 'שגיאה בטעינת היסטוריה');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      setError('שגיאת רשת');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'לא ידוע';
    const date = new Date(dateString);
    return date.toLocaleString('he-IL');
  };

  const handleSelectLog = (logId) => {
    setSelectedLogs(prev => 
      prev.includes(logId) 
        ? prev.filter(id => id !== logId)
        : [...prev, logId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedLogs([]);
      setSelectAll(false);
    } else {
      setSelectedLogs(history.map(log => log.id));
      setSelectAll(true);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLogs.length === 0) return;
    
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק ${selectedLogs.length} רשומות?`)) {
      return;
    }

    console.log('Deleting selected logs:', selectedLogs);
    console.log('Selected logs type:', typeof selectedLogs[0]);
    console.log('Selected logs sample:', selectedLogs.slice(0, 3));

    try {
      const response = await fetch('/api/gates/history/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ logIds: selectedLogs })
      });

      if (response.ok) {
        setSuccessMessage(`${selectedLogs.length} רשומות נמחקו בהצלחה!`);
        scrollToMessage('success');
        
        // Show system notification if enabled
        if (window.showSystemNotification) {
          window.showSystemNotification(`${selectedLogs.length} רשומות היסטוריה נמחקו בהצלחה`, 'info');
        }
        
        setSelectedLogs([]);
        setSelectAll(false);
        await fetchHistory();
      } else {
        const data = await response.json();
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }
        setError(data.error || 'שגיאה במחיקת הרשומות');
        
        // Show system notification if enabled
        if (window.showSystemNotification) {
          window.showSystemNotification(`שגיאה במחיקת הרשומות: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        }
        
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Network error during bulk delete:', error);
      setError('שגיאת רשת');
      
      // Show system notification if enabled
      if (window.showSystemNotification) {
        window.showSystemNotification('שגיאת רשת במחיקת הרשומות', 'error');
      }
      
      scrollToMessage('error');
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את כל ההיסטוריה? פעולה זו אינה הפיכה!')) {
      return;
    }

    try {
      const response = await fetch('/api/gates/history/delete-all', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSuccessMessage('כל ההיסטוריה נמחקה בהצלחה!');
        scrollToMessage('success');
        
        // Show system notification if enabled
        if (window.showSystemNotification) {
          window.showSystemNotification('כל היסטוריית המערכת נמחקה בהצלחה', 'warning');
        }
        
        setHistory([]);
        setSelectedLogs([]);
        setSelectAll(false);
      } else {
        const data = await response.json();
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }
        setError(data.error || 'שגיאה במחיקת כל ההיסטוריה');
        
        // Show system notification if enabled
        if (window.showSystemNotification) {
          window.showSystemNotification(`שגיאה במחיקת כל ההיסטוריה: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        }
        
        scrollToMessage('error');
      }
    } catch (error) {
      setError('שגיאת רשת');
      
      // Show system notification if enabled
      if (window.showSystemNotification) {
        window.showSystemNotification('שגיאת רשת במחיקת כל ההיסטוריה', 'error');
      }
      
      scrollToMessage('error');
    }
  };

  const handleGateSearch = (searchTerm) => {
    setFilterValue(searchTerm);
    if (searchTerm.length >= 2) {
      const filteredGates = gates.filter(gate => 
        gate.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      // You could implement autocomplete dropdown here
    }
  };

  const handleUserSearch = (searchTerm) => {
    setFilterValue(searchTerm);
    if (searchTerm.length >= 2) {
      const filteredUsers = users.filter(user => 
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      // You could implement autocomplete dropdown here
    }
  };

  return (
    <div className="history-page">
      <div className="history-container">
        {/* Header */}
        <div className="history-header">
          <h2>היסטוריית פתיחת שערים</h2>
          <p>צפייה וניהול היסטוריית פתיחת השערים במערכת</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message" ref={errorRef}>
            <span>{error}</span>
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="success-message" ref={successRef}>
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage('')}>✕</button>
          </div>
        )}

        {/* Filters */}
        <div className="history-filters">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setFilterValue('');
              setDateFilter({ start: '', end: '' });
            }}
            className="form-input"
          >
            <option value="all">כל ההיסטוריה</option>
            <option value="gate">לפי שער</option>
            <option value="user">לפי משתמש</option>
            <option value="date">לפי תאריך</option>
          </select>

          {filter === 'gate' && (
            <div className="gate-search-container">
              <input
                type="text"
                value={filterValue}
                onChange={(e) => handleGateSearch(e.target.value)}
                placeholder="התחל להקליד שם שער..."
                className="form-input"
                list="gates-list"
              />
              <datalist id="gates-list">
                {gates.map(gate => (
                  <option key={gate.id} value={gate.name} />
                ))}
              </datalist>
            </div>
          )}

          {filter === 'user' && (
            <div className="user-search-container">
              <input
                type="text"
                value={filterValue}
                onChange={(e) => handleUserSearch(e.target.value)}
                placeholder="התחל להקליד שם משתמש..."
                className="form-input"
                list="users-list"
              />
              <datalist id="users-list">
                {users.map(user => (
                  <option key={user.id} value={user.username} />
                ))}
              </datalist>
            </div>
          )}

          {filter === 'date' && (
            <div className="date-filters">
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                className="form-input"
                placeholder="מתאריך"
              />
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                className="form-input"
                placeholder="עד תאריך"
              />
            </div>
          )}

          <button
            onClick={fetchHistory}
            className="btn btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'טוען...' : 'סנן'}
          </button>
        </div>

        {/* Bulk Actions */}
        {history.length > 0 && (
          <div className="bulk-actions">
            <div className="bulk-selection">

              <span className="selected-count">
                {selectedLogs.length} רשומות נבחרו
              </span>
            </div>
            
            <div className="bulk-buttons">
              {selectedLogs.length > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="btn btn-danger"
                >
                  מחק נבחרים ({selectedLogs.length})
                </button>
              )}
              <button
                onClick={handleDeleteAll}
                className="btn btn-danger"
              >
                מחק הכל
              </button>
            </div>
          </div>
        )}

        {/* History Table */}
        <div className="history-table-container">
          {isLoading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>טוען היסטוריה...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="no-history">
              <p>אין היסטוריה להצגה</p>
            </div>
          ) : (
            <div className="history-table">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>תאריך</th>
                    <th>שער</th>
                    <th>משתמש</th>
                    <th>סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(log => (
                    <tr key={log.id} className="history-row">
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedLogs.includes(log.id)}
                          onChange={() => handleSelectLog(log.id)}
                        />
                      </td>
                      <td className="history-date">{formatDate(log.timestamp)}</td>
                      <td className="history-gate">{log.gateName || 'לא ידוע'}</td>
                      <td className="history-user">{log.userName || log.username || (log.userId && (log.userId.name || log.userId.username)) || 'לא ידוע'}</td>
                      <td className="history-status">
                        {(() => {
                          const isSuccess = (log.success === true) || (log.status === 'success');
                          return (
                            <span className={`status-badge status-${isSuccess ? 'success' : 'error'}`}>
                              {isSuccess ? 'הצלחה' : 'שגיאה'}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GateHistory;
