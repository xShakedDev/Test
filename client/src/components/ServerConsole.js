import React, { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '../utils/auth';
import AuditLogs from './AuditLogs';

const ServerConsole = ({ token }) => {
  const [activeTab, setActiveTab] = useState('console'); // 'console' or 'audit'
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterLevel, setFilterLevel] = useState('all');
  const [limit, setLimit] = useState(500);
  const [isMobile, setIsMobile] = useState(false);
  const logsEndRef = useRef(null);
  const logsContainerRef = useRef(null);
  const intervalRef = useRef(null);
  const shouldAutoScrollRef = useRef(true); // Track if we should auto-scroll

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

  // Check if user is near bottom of scroll container
  const checkIfNearBottom = () => {
    if (!logsContainerRef.current) return true;
    const container = logsContainerRef.current;
    const threshold = 100; // pixels from bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    shouldAutoScrollRef.current = isNearBottom;
    return isNearBottom;
  };

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (filterLevel !== 'all') {
        params.append('level', filterLevel);
      }
      
      const response = await authenticatedFetch(`/api/gates/admin/logs?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'שגיאה בקבלת לוגים');
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError('שגיאת רשת בקבלת לוגים');
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את כל הלוגים?')) {
      return;
    }

    try {
      const response = await authenticatedFetch('/api/gates/admin/logs', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setLogs([]);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'שגיאה במחיקת לוגים');
      }
    } catch (err) {
      console.error('Error clearing logs:', err);
      setError('שגיאת רשת במחיקת לוגים');
    }
  };

  useEffect(() => {
    fetchLogs();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchLogs();
      }, 2000); // Refresh every 2 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, filterLevel, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only auto-scroll if user is near bottom
  useEffect(() => {
    if (autoRefresh && shouldAutoScrollRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [logs, autoRefresh]);

  const getLevelColor = (level) => {
    switch (level) {
      case 'error':
        return '#ef4444';
      case 'warn':
        return '#f59e0b';
      case 'info':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
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
      {/* Tabs Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.5rem',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <button
          onClick={() => setActiveTab('console')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: activeTab === 'console' ? '#2563eb' : 'transparent',
            color: activeTab === 'console' ? 'white' : '#6b7280',
            border: 'none',
            borderBottom: activeTab === 'console' ? '2px solid #2563eb' : '2px solid transparent',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: activeTab === 'console' ? '600' : '400',
            transition: 'all 0.2s',
            marginBottom: '-2px'
          }}
        >
          לוגי שרת
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: activeTab === 'audit' ? '#2563eb' : 'transparent',
            color: activeTab === 'audit' ? 'white' : '#6b7280',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '2px solid #2563eb' : '2px solid transparent',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: activeTab === 'audit' ? '600' : '400',
            transition: 'all 0.2s',
            marginBottom: '-2px'
          }}
        >
          Audit Logs
        </button>
      </div>

      {activeTab === 'audit' ? (
        <AuditLogs token={token} />
      ) : (
        <>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
              קונסול שרת
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
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              cursor: 'pointer'
            }}
          >
            <option value="all">כל הלוגים</option>
            <option value="log">Log</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
          
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value) || 500)}
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

      <div 
        ref={logsContainerRef}
        onScroll={checkIfNearBottom}
        style={{
          backgroundColor: '#1e293b',
          borderRadius: '8px',
          padding: '1rem',
          height: 'calc(100vh - 300px)',
          minHeight: '400px',
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          lineHeight: '1.5'
        }}
      >
        {isLoading ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
            טוען לוגים...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
            אין לוגים להצגה
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              style={{
                marginBottom: '0.5rem',
                padding: '0.5rem',
                borderLeft: `3px solid ${getLevelColor(log.level)}`,
                backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent'
              }}
            >
              {isMobile ? (
                // Mobile layout - vertical stack
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
                      color: getLevelColor(log.level),
                      fontWeight: '600',
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}>
                      [{log.level.toUpperCase()}]
                    </span>
                  </div>
                  <div style={{ 
                    color: '#e2e8f0', 
                    fontSize: '0.8rem',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.4'
                  }}>
                    {log.message}
                  </div>
                </div>
              ) : (
                // Desktop layout - horizontal
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
                    color: getLevelColor(log.level),
                    fontWeight: '600',
                    minWidth: '60px',
                    flexShrink: 0,
                    whiteSpace: 'nowrap'
                  }}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span style={{ 
                    color: '#e2e8f0', 
                    flex: 1, 
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    minWidth: 0,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {log.message}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
        </>
      )}
    </div>
  );
};

export default ServerConsole;

