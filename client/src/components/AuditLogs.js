import React, { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '../utils/auth';

const AuditLogs = ({ token }) => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterResourceType, setFilterResourceType] = useState('all');
  const [filterUsername, setFilterUsername] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState(500);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const logsEndRef = useRef(null);
  const logsContainerRef = useRef(null);
  const intervalRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const scrollToBottom = () => {
    if (logsContainerRef.current && shouldAutoScrollRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  };

  const checkIfNearBottom = () => {
    if (!logsContainerRef.current) return true;
    const container = logsContainerRef.current;
    const threshold = 100;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    shouldAutoScrollRef.current = isNearBottom;
    return isNearBottom;
  };

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ 
        limit: limit.toString(),
        page: page.toString()
      });
      
      if (filterAction !== 'all') {
        params.append('action', filterAction);
      }
      if (filterResourceType !== 'all') {
        params.append('resourceType', filterResourceType);
      }
      if (filterUsername) {
        params.append('username', filterUsername);
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }
      
      const response = await authenticatedFetch(`/api/gates/admin/audit-logs?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || 0);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'שגיאה בקבלת audit logs');
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('שגיאת רשת בקבלת audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את כל ה-audit logs?')) {
      return;
    }

    try {
      const response = await authenticatedFetch('/api/gates/admin/audit-logs', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setLogs([]);
        setError('');
        setPage(1);
        fetchLogs();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'שגיאה במחיקת audit logs');
      }
    } catch (err) {
      console.error('Error clearing audit logs:', err);
      setError('שגיאת רשת במחיקת audit logs');
    }
  };

  useEffect(() => {
    fetchLogs();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchLogs();
      }, 5000); // Refresh every 5 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, filterAction, filterResourceType, filterUsername, startDate, endDate, limit, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autoRefresh && shouldAutoScrollRef.current) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [logs, autoRefresh]);

  const getActionColor = (action) => {
    if (action.includes('deleted') || action.includes('deactivated')) {
      return '#ef4444';
    }
    if (action.includes('created') || action.includes('activated')) {
      return '#22c55e';
    }
    if (action.includes('updated') || action.includes('changed')) {
      return '#3b82f6';
    }
    return '#6b7280';
  };

  const getActionLabel = (action) => {
    const labels = {
      'user_created': 'יצירת משתמש',
      'user_updated': 'עדכון משתמש',
      'user_deleted': 'מחיקת משתמש',
      'user_activated': 'הפעלת משתמש',
      'user_deactivated': 'השבתת משתמש',
      'gate_created': 'יצירת שער',
      'gate_updated': 'עדכון שער',
      'gate_deleted': 'מחיקת שער',
      'settings_updated': 'עדכון הגדרות',
      'login': 'התחברות',
      'logout': 'התנתקות',
      'password_changed': 'שינוי סיסמה',
      'permissions_changed': 'שינוי הרשאות',
      'bulk_delete_history': 'מחיקה מרובה של היסטוריה',
      'delete_all_history': 'מחיקת כל ההיסטוריה',
      'clear_logs': 'ניקוי לוגים',
      'other': 'אחר'
    };
    return labels[action] || action;
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '100%' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
          Audit Logs
        </h2>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>רענון אוטומטי</span>
          </label>
          
          <select
            value={filterAction}
            onChange={(e) => {
              setFilterAction(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              cursor: 'pointer'
            }}
          >
            <option value="all">כל הפעולות</option>
            <option value="user_created">יצירת משתמש</option>
            <option value="user_updated">עדכון משתמש</option>
            <option value="user_deleted">מחיקת משתמש</option>
            <option value="user_activated">הפעלת משתמש</option>
            <option value="user_deactivated">השבתת משתמש</option>
            <option value="gate_created">יצירת שער</option>
            <option value="gate_updated">עדכון שער</option>
            <option value="gate_deleted">מחיקת שער</option>
            <option value="settings_updated">עדכון הגדרות</option>
            <option value="login">התחברות</option>
            <option value="logout">התנתקות</option>
            <option value="password_changed">שינוי סיסמה</option>
            <option value="permissions_changed">שינוי הרשאות</option>
            <option value="bulk_delete_history">מחיקה מרובה</option>
            <option value="delete_all_history">מחיקת כל ההיסטוריה</option>
            <option value="clear_logs">ניקוי לוגים</option>
          </select>

          <select
            value={filterResourceType}
            onChange={(e) => {
              setFilterResourceType(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              cursor: 'pointer'
            }}
          >
            <option value="all">כל הסוגים</option>
            <option value="user">משתמש</option>
            <option value="gate">שער</option>
            <option value="settings">הגדרות</option>
            <option value="history">היסטוריה</option>
            <option value="logs">לוגים</option>
            <option value="auth">אימות</option>
          </select>

          <input
            type="text"
            value={filterUsername}
            onChange={(e) => {
              setFilterUsername(e.target.value);
              setPage(1);
            }}
            placeholder="שם משתמש..."
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              width: '150px'
            }}
          />

          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            placeholder="מתאריך"
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #d1d5db'
            }}
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            placeholder="עד תאריך"
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #d1d5db'
            }}
          />
          
          <input
            type="number"
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value) || 500);
              setPage(1);
            }}
            min="50"
            max="1000"
            step="50"
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              width: '100px'
            }}
            placeholder="מספר לוגים"
          />
          
          <button
            onClick={fetchLogs}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            רענן
          </button>
          
          <button
            onClick={clearLogs}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            נקה לוגים
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {/* Pagination Info */}
      {totalCount > 0 && (
        <div style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
          מציג {((page - 1) * limit) + 1} - {Math.min(page * limit, totalCount)} מתוך {totalCount} רשומות
          {' | '}
          <button
            onClick={() => setPage(prev => Math.max(1, prev - 1))}
            disabled={page === 1 || isLoading}
            style={{
              padding: '0.25rem 0.5rem',
              margin: '0 0.25rem',
              backgroundColor: page === 1 ? '#e5e7eb' : '#2563eb',
              color: page === 1 ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: page === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            קודם
          </button>
          עמוד {page} מתוך {totalPages}
          <button
            onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages || isLoading}
            style={{
              padding: '0.25rem 0.5rem',
              margin: '0 0.25rem',
              backgroundColor: page === totalPages ? '#e5e7eb' : '#2563eb',
              color: page === totalPages ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: page === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            הבא
          </button>
        </div>
      )}

      <div 
        ref={logsContainerRef}
        onScroll={checkIfNearBottom}
        style={{
          backgroundColor: '#1e293b',
          borderRadius: '8px',
          padding: '1rem',
          height: 'calc(100vh - 400px)',
          minHeight: '400px',
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          lineHeight: '1.5'
        }}
      >
        {isLoading ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
            טוען audit logs...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
            אין audit logs להצגה
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={log.id || index}
              style={{
                marginBottom: '0.5rem',
                padding: '0.5rem',
                borderLeft: `3px solid ${getActionColor(log.action)}`,
                backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent'
              }}
            >
              {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.5rem', 
                    alignItems: 'center',
                    flexWrap: 'nowrap'
                  }}>
                    <span style={{ 
                      color: '#94a3b8', 
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}>
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span style={{ 
                      color: getActionColor(log.action),
                      fontWeight: '600',
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}>
                      [{getActionLabel(log.action)}]
                    </span>
                    {log.success === false && (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>❌</span>
                    )}
                  </div>
                  <div style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>
                    <strong>{log.username}</strong> | {log.resourceType}
                    {log.resourceName && `: ${log.resourceName}`}
                  </div>
                  {log.details && (
                    <div style={{ 
                      color: '#cbd5e1', 
                      fontSize: '0.75rem',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {log.details}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  gap: '1rem', 
                  flexWrap: 'wrap',
                  alignItems: 'flex-start'
                }}>
                  <span style={{ 
                    color: '#94a3b8', 
                    minWidth: '180px',
                    flexShrink: 0,
                    whiteSpace: 'nowrap'
                  }}>
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span style={{ 
                    color: getActionColor(log.action),
                    fontWeight: '600',
                    minWidth: '120px',
                    flexShrink: 0,
                    whiteSpace: 'nowrap'
                  }}>
                    {getActionLabel(log.action)}
                  </span>
                  <span style={{ 
                    color: '#e2e8f0',
                    minWidth: '100px',
                    flexShrink: 0
                  }}>
                    {log.username}
                  </span>
                  <span style={{ 
                    color: '#94a3b8',
                    minWidth: '80px',
                    flexShrink: 0
                  }}>
                    {log.resourceType}
                  </span>
                  {log.resourceName && (
                    <span style={{ 
                      color: '#cbd5e1',
                      minWidth: '100px',
                      flexShrink: 0
                    }}>
                      {log.resourceName}
                    </span>
                  )}
                  {log.details && (
                    <span style={{ 
                      color: '#cbd5e1', 
                      flex: 1, 
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      minWidth: 0,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {log.details}
                    </span>
                  )}
                  {log.success === false && (
                    <span style={{ color: '#ef4444', fontSize: '1.2rem' }}>❌</span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

export default AuditLogs;
