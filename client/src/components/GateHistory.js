import React, { useState, useEffect, useRef } from 'react';

const GateHistory = ({ user, token }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, gate, user
  const [filterValue, setFilterValue] = useState('');
  
  // Ref for scrolling to error message
  const errorRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, [filter, filterValue, token]);

  // Function to scroll to error message
  const scrollToError = () => {
    if (errorRef.current) {
      errorRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
    }
  };

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
        scrollToError();
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



  return (
    <div className="history-page">
      <div className="history-container">
        {/* Header */}
        <div className="history-header">
          <h2>היסטוריית פתיחת שערים</h2>
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
          <div className="error-message" ref={errorRef}>
            <span>{error}</span>
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* History Table */}
        <div className="history-table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>שער</th>
                <th>משתמש</th>
                <th>תאריך</th>
                <th>פרטים</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="loading-cell">
                    <div className="loading-content">
                      <div className="loading-spinner"></div>
                      <p>טוען היסטוריה...</p>
                    </div>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-cell">
                    אין רשומות היסטוריה
                  </td>
                </tr>
              ) : (
                history.map(record => (
                  <tr key={record._id || record.id} className="history-row">
                    <td className="gate-cell">
                      {record.gateName || record.gate?.name || 'לא ידוע'}
                    </td>
                    <td className="user-cell">
                      {record.username || record.user?.name || 'לא ידוע'}
                    </td>
                    <td className="date-cell">
                      {formatDate(record.timestamp || record.createdAt)}
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
                      {record.errorMessage && (
                        <div className="error-details">
                          {record.errorMessage}
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
        </div>
      </div>
    </div>
  );
};

export default GateHistory;
