import React, { useState, useEffect, useRef, useCallback } from 'react';
import { isSessionExpired, handleSessionExpiration, authenticatedFetch } from '../utils/auth';

const GateHistory = ({ user, token }) => {
  const [history, setHistory] = useState([]);
  const [gates, setGates] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [gateFilter, setGateFilter] = useState(''); // Gate name filter
  const [userFilter, setUserFilter] = useState(''); // User filter (username or name)
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [statusFilters, setStatusFilters] = useState([]); // Array of selected statuses: 'opened', 'failed', 'autoOpened'
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(3.7); // Default rate
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
  
  // Ref to track pagination without causing re-renders
  const paginationRef = useRef(pagination);

  // Function to scroll to messages - use useCallback to prevent recreation
  const scrollToMessage = useCallback((type) => {
    const ref = type === 'error' ? errorRef : successRef;
    if (ref.current) {
      ref.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
    }
  }, []);
  
  // Sync ref with state
  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  const fetchGates = async () => {
    try {
      const response = await authenticatedFetch('/api/gates');
      
      if (response.ok) {
        const data = await response.json();
        setGates(data.gates || []);
      } else {
        // Try to parse error response as JSON, but handle non-JSON responses
        try {
          const text = await response.text();
          const errorData = text ? JSON.parse(text) : { error: 'שגיאה לא ידועה' };
          console.error('Error fetching gates:', errorData);
        } catch (parseError) {
          console.error('Error fetching gates - non-JSON response:', response.status, response.statusText);
        }
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

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Use ref to get current pagination values without causing re-render
      const currentLimit = paginationRef.current.limit;
      const currentPage = paginationRef.current.page;
      
      let url = `/api/gates/history?limit=${currentLimit}&page=${currentPage}`;
      
      // Combine filters - allow multiple filters at once
      if (gateFilter) {
        // Send gateName to server, which will look up the gate and filter by gateId
        url += `&gateName=${encodeURIComponent(gateFilter)}`;
      }
      if (userFilter) {
        url += `&username=${encodeURIComponent(userFilter)}`;
      }
      if (dateFilter.start || dateFilter.end) {
        if (dateFilter.start) {
          url += `&startDate=${dateFilter.start}`;
        }
        if (dateFilter.end) {
          url += `&endDate=${dateFilter.end}`;
        }
      }
      // Add status filters
      if (statusFilters.length > 0) {
        statusFilters.forEach(status => {
          url += `&status=${encodeURIComponent(status)}`;
        });
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
        // Try to parse error response as JSON, but handle non-JSON responses
        let errorData;
        try {
          const text = await response.text();
          errorData = text ? JSON.parse(text) : { error: 'שגיאה לא ידועה' };
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          errorData = { error: `שגיאת שרת (${response.status}): ${response.statusText}` };
        }
        
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
      const msg = error.message?.includes('JSON') 
        ? 'שגיאה בשרת - תגובה לא תקינה'
        : 'שגיאת רשת';
      setError(msg);
      if (window.showSystemNotification) window.showSystemNotification(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [gateFilter, userFilter, dateFilter, statusFilters, scrollToMessage]);

  // Fetch exchange rate
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const response = await authenticatedFetch('/api/exchange-rate');
        if (response.ok) {
          const data = await response.json();
          setExchangeRate(data.rate || 3.7);
        }
      } catch (err) {
        console.error('Error fetching exchange rate:', err);
        // Keep default rate
      }
    };
    if (user?.role === 'admin') {
      fetchExchangeRate();
    }
  }, [user?.role]);

  useEffect(() => {
    fetchHistory();
    fetchGates(); // Always fetch gates to get current names
    fetchUsers(); // Always fetch users for the filter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateFilter, userFilter, dateFilter, statusFilters, token, pagination.page, pagination.limit]);

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
    setGateFilter(searchTerm);
    // Reset to page 1 when filter changes
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleUserSearch = (searchTerm) => {
    setUserFilter(searchTerm);
    // Reset to page 1 when filter changes
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit) => {
    setPagination(prev => ({ ...prev, limit: parseInt(newLimit), page: 1 }));
  };

  const handleStatusFilterToggle = (status) => {
    setStatusFilters(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
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
          {/* Active Filters Display */}
          {(gateFilter || userFilter || dateFilter.start || dateFilter.end || statusFilters.length > 0) && (
            <div className="active-filter-info">
              <span className="filter-label">
                סננים פעילים: 
                {gateFilter && ` שער: ${gateFilter}`}
                {userFilter && ` משתמש: ${userFilter}`}
                {(dateFilter.start || dateFilter.end) && ` תאריך: ${dateFilter.start ? `מתאריך ${dateFilter.start}` : ''}${dateFilter.start && dateFilter.end ? ' ' : ''}${dateFilter.end ? `עד תאריך ${dateFilter.end}` : ''}`}
                {statusFilters.length > 0 && ` סטטוס: ${statusFilters.map(s => {
                  if (s === 'opened') return 'נפתח';
                  if (s === 'failed') return 'לא נפתח';
                  if (s === 'autoOpened') return 'נפתח אוטומטי';
                  return s;
                }).join(', ')}`}
              </span>
              <button 
                onClick={() => {
                  setGateFilter('');
                  setUserFilter('');
                  setDateFilter({ start: '', end: '' });
                  setStatusFilters([]);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="btn btn-primary btn-sm"
              >
                נקה כל הסננים
              </button>
            </div>
          )}

          {/* All Filters - Always Available */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Status Filters */}
            <div className="status-filters">
              <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>סטטוס:</label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={statusFilters.includes('opened')}
                    onChange={() => handleStatusFilterToggle('opened')}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>נפתח</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={statusFilters.includes('failed')}
                    onChange={() => handleStatusFilterToggle('failed')}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>לא נפתח</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={statusFilters.includes('autoOpened')}
                    onChange={() => handleStatusFilterToggle('autoOpened')}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>נפתח אוטומטי</span>
                </label>
              </div>
            </div>

            {/* Gate and User Filters */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="gate-search-container" style={{ flex: 1, minWidth: '200px' }}>
                <label htmlFor="gate-filter" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>שער:</label>
                <input
                  id="gate-filter"
                  type="text"
                  value={gateFilter}
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

              <div className="user-search-container" style={{ flex: 1, minWidth: '200px' }}>
                <label htmlFor="user-filter" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>משתמש:</label>
                <input
                  id="user-filter"
                  type="text"
                  value={userFilter}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  placeholder="התחל להקליד שם משתמש או שם מלא..."
                  className="form-input"
                  list="users-list"
                />
                <datalist id="users-list">
                  {users.map(user => (
                    <option key={user.id} value={user.username} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Date Filters */}
            <div className="date-filters" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="date-input-group">
                <label htmlFor="start-date" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>מתאריך:</label>
                <input
                  id="start-date"
                  type="date"
                  value={dateFilter.start}
                  onChange={(e) => {
                    setDateFilter(prev => ({ ...prev, start: e.target.value }));
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="form-input"
                />
              </div>
              <div className="date-input-group">
                <label htmlFor="end-date" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>עד תאריך:</label>
                <input
                  id="end-date"
                  type="date"
                  value={dateFilter.end}
                  onChange={(e) => {
                    setDateFilter(prev => ({ ...prev, end: e.target.value }));
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="form-input"
                />
              </div>
            </div>

            {/* Filter Button - Optional, filters apply automatically */}
            <div>
              <button
                onClick={() => {
                  setPagination(prev => ({ ...prev, page: 1 }));
                  fetchHistory();
                }}
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'טוען...' : 'רענן'}
              </button>
            </div>
          </div>
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
                    {user?.role === 'admin' && <th>עלות</th>}
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
                        <td className="history-gate">
                          {(() => {
                            // Try to find current gate name by gateId
                            const currentGate = gates.find(g => g.id === log.gateId);
                            // Use current name if found, otherwise fallback to saved name
                            return currentGate ? currentGate.name : (log.gateName || 'לא ידוע');
                          })()}
                        </td>
                        <td className="history-status">
                          <span 
                            className={`status-badge status-${isSuccess ? 'success' : 'error'}`}
                          >
                            {isSuccess ? (log.autoOpened ? 'נפתח אוטומטית' : 'פתיחה הצליחה') : (log.errorMessage || 'שגיאה')}
                          </span>
                        </td>
                        <td className="history-date">{formatDate(log.timestamp)}</td>
                        {user?.role === 'admin' && (
                          <td className="history-cost" style={{ 
                            textAlign: 'center',
                            fontWeight: '600',
                            color: log.cost !== null && log.cost !== undefined ? '#10b981' : '#9ca3af'
                          }}>
                            {log.cost !== null && log.cost !== undefined 
                              ? (
                                <span>
                                  ₪{(parseFloat(log.cost) * exchangeRate).toFixed(2)}
                                  <span style={{ fontSize: '0.75rem', opacity: 0.7, marginRight: '0.25rem', display: 'block', marginTop: '0.1rem' }}>
                                    (${parseFloat(log.cost).toFixed(4)})
                                  </span>
                                </span>
                              )
                              : '-'}
                          </td>
                        )}
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
