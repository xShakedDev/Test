import React, { useState, useEffect } from 'react';

const GateHistory = ({ token, onClose }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, gate, user
  const [filterValue, setFilterValue] = useState('');

  useEffect(() => {
    fetchHistory();
  }, [filter, filterValue]);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      let url = '/api/gates/history?limit=100';
      if (filter === 'gate' && filterValue) {
        url += `&gateId=${filterValue}`;
      } else if (filter === 'user' && filterValue) {
        url += `&userId=${filterValue}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'שגיאה בטעינת היסטוריה');
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

  const getStatusIcon = (success) => {
    if (success) {
      return (
        <svg className="icon-small text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    } else {
      return (
        <svg className="icon-small text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      );
    }
  };

  return (
    <div className="history-modal-overlay">
      <div className="history-modal">
        <div className="validation-result">
          {/* Header */}
          <div className="validation-result-header">
            <h3>היסטוריית פתיחת שערים</h3>
            <button
              onClick={onClose}
              className="close-btn"
            >
              ✕
            </button>
          </div>

          {/* Filters */}
          <div className="history-filters">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="form-input"
            >
              <option value="all">כל ההיסטוריה</option>
              <option value="gate">לפי שער</option>
              <option value="user">לפי משתמש</option>
            </select>

            {filter !== 'all' && (
              <input
                type="text"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                placeholder={filter === 'gate' ? 'הכנס שם שער' : 'הכנס שם משתמש'}
                className="form-input"
              />
            )}

            <button
              onClick={fetchHistory}
              disabled={isLoading}
              className="btn btn-primary"
            >
              {isLoading ? 'טוען...' : 'סנן'}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              <span>{error}</span>
              <button onClick={() => setError('')}>✕</button>
            </div>
          )}

          {/* History Table */}
          <div className="history-table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>סטטוס</th>
                  <th>שער</th>
                  <th>משתמש</th>
                  <th>תאריך</th>
                  <th>פרטים</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="loading-cell">
                      <div className="loading-content">
                        <div className="loading-spinner"></div>
                        <p>טוען היסטוריה...</p>
                      </div>
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-cell">
                      אין רשומות היסטוריה
                    </td>
                  </tr>
                ) : (
                  history.map(record => (
                    <tr key={record.id} className="history-row">
                      <td className="status-cell">
                        <div className="status-icon">
                          {getStatusIcon(record.success)}
                        </div>
                      </td>
                      <td className="gate-cell">
                        {record.gate?.name || 'לא ידוע'}
                      </td>
                      <td className="user-cell">
                        {record.user?.name || 'לא ידוע'}
                      </td>
                      <td className="date-cell">
                        {formatDate(record.createdAt)}
                      </td>
                      <td className="details-cell">
                        {record.success ? (
                          <span className="status-badge status-completed">
                            הצלחה
                          </span>
                        ) : (
                          <span className="status-badge status-failed">
                            כישלון
                          </span>
                        )}
                        {record.error && (
                          <div className="error-details">
                            {record.error}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="history-footer">
            <div className="history-stats">
              סה"כ רשומות: {history.length}
            </div>
            <button
              onClick={onClose}
              className="btn btn-secondary"
            >
              סגור
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GateHistory;
