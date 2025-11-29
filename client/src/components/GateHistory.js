import React, { useState, useEffect, useRef } from 'react';
import { isSessionExpired, handleSessionExpiration, authenticatedFetch } from '../utils/auth';

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
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  });
  
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
  }, [filter, filterValue, dateFilter, token, pagination.page, pagination.limit]);

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
      const response = await authenticatedFetch('/api/gates');
      
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
      const response = await authenticatedFetch('/api/auth/users');
      
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
      
      let url = `/api/gates/history?limit=${pagination.limit}&page=${pagination.page}`;
      if (filter === 'gate' && filterValue) {
        url += `&gateName=${encodeURIComponent(filterValue)}`;
      } else if (filter === 'user' && filterValue) {
        url += `&username=${encodeURIComponent(filterValue)}`;
      } else if (filter === 'date' && (dateFilter.start || dateFilter.end)) {
        if (dateFilter.start) {
          url += `&startDate=${dateFilter.start}`;
        }
        if (dateFilter.end) {
          url += `&endDate=${dateFilter.end}`;
        }
      }

      const response = await authenticatedFetch(url);

      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
        setPagination({
          page: data.page || 1,
          limit: data.limit || 50,
          totalCount: data.totalCount || 0,
          totalPages: data.totalPages || 1,
          hasNextPage: data.hasNextPage || false,
          hasPrevPage: data.hasPrevPage || false
        });
        setSelectedLogs([]);
        setSelectAll(false);
      } else {
        const errorData = await response.json();
        if (isSessionExpired(errorData)) {
          handleSessionExpiration();
          return;
        }
        const msg = errorData.error || 'שגיאה בטעינת היסטוריה';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      const msg = 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'לא ידוע';
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('he-IL');
    const timeStr = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    return (
      <span className="date-time-wrapper">
        <span className="date-part">{dateStr}</span>
        <span className="time-part">{timeStr}</span>
      </span>
    );
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

    try {
      const response = await authenticatedFetch('/api/gates/history/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ logIds: selectedLogs })
      });

      if (response.ok) {
        const msg = `${selectedLogs.length} רשומות נמחקו בהצלחה!`;
        setSuccessMessage(msg);
        if (window.showSystemNotification) window.showSystemNotification(`${selectedLogs.length} רשומות היסטוריה נמחקו בהצלחה`, 'info');
        scrollToMessage('success');
        
        setSelectedLogs([]);
        setSelectAll(false);
        await fetchHistory();
      } else {
        const data = await response.json();
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }
        const msg = data.error || 'שגיאה במחיקת הרשומות';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(`שגיאה במחיקת הרשומות: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        scrollToMessage('error');
      }
    } catch (error) {
      console.error('Network error during bulk delete:', error);
      const msg = 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification('שגיאת רשת במחיקת הרשומות', 'error');
      scrollToMessage('error');
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את כל ההיסטוריה? פעולה זו אינה הפיכה!')) {
      return;
    }

    try {
      const response = await authenticatedFetch('/api/gates/history/delete-all', {
        method: 'DELETE'
      });

      if (response.ok) {
        const msg = 'כל ההיסטוריה נמחקה בהצלחה!';
        setSuccessMessage(msg);
        if (window.showSystemNotification) window.showSystemNotification('כל היסטוריית המערכת נמחקה בהצלחה', 'warning');
        scrollToMessage('success');
        
        setHistory([]);
        setSelectedLogs([]);
        setSelectAll(false);
      } else {
        const data = await response.json();
        if (isSessionExpired(data)) {
          handleSessionExpiration();
          return;
        }
        const msg = data.error || 'שגיאה במחיקת כל ההיסטוריה';
        setError(msg);
        if (window.showSystemNotification) window.showSystemNotification(`שגיאה במחיקת כל ההיסטוריה: ${data.error || 'שגיאה לא ידועה'}`, 'error');
        scrollToMessage('error');
      }
    } catch (error) {
      const msg = 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification('שגיאת רשת במחיקת כל ההיסטוריה', 'error');
      scrollToMessage('error');
    }
  };

  const handleGateSearch = (searchTerm) => {
    setFilterValue(searchTerm);
    if (searchTerm.length >= 2) {
      const filteredGates = gates.filter(gate => 
        gate.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      // Could add autocomplete dropdown here
    }
  };

  const handleUserSearch = (searchTerm) => {
    setFilterValue(searchTerm);
    if (searchTerm.length >= 2) {
      const filteredUsers = users.filter(user => 
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      // Could add autocomplete dropdown here
    }
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit) => {
    setPagination(prev => ({ ...prev, limit: parseInt(newLimit), page: 1 }));
  };

  const handleFilterChange = () => {
    // Reset to page 1 when filter changes
    setPagination(prev => ({ ...prev, page: 1 }));
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
          {/* Active Filter Display */}
          {filter !== 'all' && (
            <div className="active-filter-info">
              <span className="filter-label">
                סינון פעיל: 
                {filter === 'gate' && ` שער: ${filterValue}`}
                {filter === 'user' && ` משתמש: ${filterValue}`}
                {filter === 'date' && ` תאריך: ${dateFilter.start ? `מתאריך ${dateFilter.start}` : ''}${dateFilter.start && dateFilter.end ? ' ' : ''}${dateFilter.end ? `עד תאריך ${dateFilter.end}` : ''}`}
              </span>
              <button 
                onClick={() => {
                  setFilter('all');
                  setFilterValue('');
                  setDateFilter({ start: '', end: '' });
                  handleFilterChange();
                }}
                className="btn btn-primary btn-sm"
              >
                נקה סינון
              </button>
            </div>
          )}
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setFilterValue('');
              setDateFilter({ start: '', end: '' });
              handleFilterChange();
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
              <div className="date-input-group">
                <label htmlFor="start-date">מתאריך:</label>
                <input
                  id="start-date"
                  type="date"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div className="date-input-group">
                <label htmlFor="end-date">עד תאריך:</label>
                <input
                  id="end-date"
                  type="date"
                  value={dateFilter.end}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                  className="form-input"
                />
              </div>
            </div>
          )}

          <button
            onClick={() => {
              handleFilterChange();
              fetchHistory();
            }}
            className="btn btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'טוען...' : 'סנן'}
          </button>
        </div>

        {/* Pagination Controls */}
        {history.length > 0 && (
          <div className="pagination-controls">
            <div className="pagination-info">
              <span>
                מציג {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.totalCount)} מתוך {pagination.totalCount} רשומות
              </span>
              <select
                value={pagination.limit}
                onChange={(e) => handleLimitChange(e.target.value)}
                className="form-input pagination-limit"
                disabled={isLoading}
              >
                <option value={25}>25 שורות</option>
                <option value={50}>50 שורות</option>
                <option value={100}>100 שורות</option>
                <option value={200}>200 שורות</option>
              </select>
            </div>
            <div className="pagination-buttons">
              <button
                onClick={() => handlePageChange(1)}
                className="btn btn-primary btn-sm"
                disabled={!pagination.hasPrevPage || isLoading}
              >
                ראשון
              </button>
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                className="btn btn-primary btn-sm"
                disabled={!pagination.hasPrevPage || isLoading}
              >
                קודם
              </button>
              <span className="pagination-page-info">
                עמוד {pagination.page} מתוך {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                className="btn btn-primary btn-sm"
                disabled={!pagination.hasNextPage || isLoading}
              >
                הבא
              </button>
              <button
                onClick={() => handlePageChange(pagination.totalPages)}
                className="btn btn-primary btn-sm"
                disabled={!pagination.hasNextPage || isLoading}
              >
                אחרון
              </button>
            </div>
          </div>
        )}

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
                    <th>משתמש</th>
                    <th>שער</th>
                    <th>סטטוס</th>
                    <th>תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(log => {
                    const isSuccess = (log.success === true) || (log.status === 'success');
                    return (
                      <tr key={log.id} className="history-row">
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedLogs.includes(log.id)}
                            onChange={() => handleSelectLog(log.id)}
                          />
                        </td>
                        <td className="history-user">{log.userName || log.username || (log.userId && (log.userId.name || log.userId.username)) || 'לא ידוע'}</td>
                        <td className="history-gate">{log.gateName || 'לא ידוע'}</td>
                        <td className="history-status">
                          <span 
                            className={`status-badge status-${isSuccess ? 'success' : 'error'}`}
                          >
                            {isSuccess ? 'פתיחה הצליחה' : (log.errorMessage || 'שגיאה')}
                          </span>
                        </td>
                        <td className="history-date">{formatDate(log.timestamp)}</td>
                      </tr>
                    );
                  })}
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
