import React, { useState, useEffect } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts';
import { authenticatedFetch, isSessionExpired, handleSessionExpiration } from '../utils/auth';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

const GateStatistics = ({ user }) => {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [dateRange, setDateRange] = useState('week'); // 'day', 'week', 'month', 'all'
    const [exchangeRate, setExchangeRate] = useState(3.7); // Default rate
    const isPersonal = stats?.isPersonal || false;

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
        fetchExchangeRate();
    }, []);

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                let query = '';
                const now = new Date();
                let startDate = new Date();

                if (dateRange === 'day') {
                    startDate.setDate(now.getDate() - 1);
                } else if (dateRange === 'week') {
                    startDate.setDate(now.getDate() - 7);
                } else if (dateRange === 'month') {
                    startDate.setMonth(now.getMonth() - 1);
                } else {
                    startDate = null;
                }

                if (startDate) {
                    query = `?startDate=${startDate.toISOString()}`;
                }

                const response = await authenticatedFetch(`/api/gates/stats${query}`);

                if (response.ok) {
                    const data = await response.json();
                    setStats(data);
                } else {
                    const data = await response.json();
                    if (isSessionExpired(data)) {
                        handleSessionExpiration();
                        return;
                    }
                    setError(data.error || 'שגיאה בטעינת נתונים');
                }
            } catch (err) {
                console.error('Error fetching stats:', err);
                setError('שגיאת רשת');
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, [dateRange]);

    if (isLoading) {
        return (
            <div className="loading">
                <div className="loading-spinner"></div>
                <p>טוען נתונים...</p>
            </div>
        );
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    if (!stats) return null;

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>{isPersonal ? 'הסטטיסטיקות שלי' : 'סטטיסטיקות שערים'}</h1>
                <div className="date-filter">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="form-select"
                    >
                        <option value="day">24 שעות אחרונות</option>
                        <option value="week">7 ימים אחרונים</option>
                        <option value="month">30 ימים אחרונים</option>
                        <option value="all">כל הזמן</option>
                    </select>
                </div>
            </div>

            {/* Total Cost - Only for admin */}
            {user?.role === 'admin' && stats.totalCost !== null && (
                <div className="stats-summary-card">
                    <h3>סיכום עלויות</h3>
                    <div className="cost-summary">
                        <div className="cost-item">
                            <span className="cost-label">סה"כ עלויות:</span>
                            <span className="cost-value">
                                ₪{(stats.totalCost * exchangeRate).toFixed(2)} 
                                <span style={{ fontSize: '0.85rem', opacity: 0.8, marginRight: '0.5rem' }}>
                                    (${stats.totalCost.toFixed(4)})
                                </span>
                            </span>
                        </div>
                        {stats.costCount !== undefined && (
                            <div className="cost-item" style={{ marginTop: '0.5rem', fontSize: '0.9rem', opacity: 0.9 }}>
                                <span className="cost-label">מספר שיחות עם עלות:</span>
                                <span className="cost-value">{stats.costCount}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="stats-grid">
                {/* Top Gates Chart */}
                <div className="chart-card">
                    <h3>{isPersonal ? 'השערים שלי' : 'שערים פופולריים'}</h3>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height={400}>
                            <PieChart>
                                <Pie
                                    data={stats.topGates.map(item => ({ name: item._id, value: item.count }))}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={120}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {stats.topGates.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value, name) => [`${value} פתיחות`, name]} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Users Chart - Only show for admin */}
                {!isPersonal && (
                <div className="chart-card">
                    <h3>משתמשים פעילים</h3>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height={400}>
                            <PieChart>
                                <Pie
                                    data={stats.topUsers.map(item => ({ name: item._id, value: item.count }))}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={120}
                                    fill="#82ca9d"
                                    dataKey="value"
                                >
                                    {stats.topUsers.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value, name) => [`${value} פתיחות`, name]} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                )}

                {/* Top Gates List */}
                <div className="stats-list-card">
                    <h3>{isPersonal ? 'השערים שלי' : 'רשימת שערים פופולריים'}</h3>
                    <div className="stats-list">
                        {stats.topGates && stats.topGates.length > 0 ? (
                            <table className="stats-table">
                                <thead>
                                    <tr>
                                        <th>מיקום</th>
                                        <th>שם השער</th>
                                        <th>מספר פתיחות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.topGates.map((gate, index) => (
                                        <tr key={gate._id}>
                                            <td className="rank-cell">
                                                <span className={`rank-badge rank-${index + 1}`}>
                                                    {index + 1}
                                                </span>
                                            </td>
                                            <td className="name-cell">{gate._id}</td>
                                            <td className="count-cell">
                                                <strong>{gate.count}</strong>
                                                <span className="count-label"> פתיחות</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="no-data">אין נתונים להצגה</p>
                        )}
                    </div>
                </div>

                {/* Top Users List - Only show for admin */}
                {!isPersonal && (
                <div className="stats-list-card">
                    <h3>רשימת משתמשים פעילים</h3>
                    <div className="stats-list">
                        {stats.topUsers && stats.topUsers.length > 0 ? (
                            <table className="stats-table">
                                <thead>
                                    <tr>
                                        <th>מיקום</th>
                                        <th>שם משתמש</th>
                                        <th>מספר פתיחות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.topUsers.map((user, index) => (
                                        <tr key={user._id}>
                                            <td className="rank-cell">
                                                <span className={`rank-badge rank-${index + 1}`}>
                                                    {index + 1}
                                                </span>
                                            </td>
                                            <td className="name-cell">{user._id}</td>
                                            <td className="count-cell">
                                                <strong>{user.count}</strong>
                                                <span className="count-label"> פתיחות</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="no-data">אין נתונים להצגה</p>
                        )}
                    </div>
                </div>
                )}

                {/* Hourly Activity Chart */}
                <div className="chart-card full-width">
                    <h3>{isPersonal ? 'הפעילות שלי לפי שעות' : 'פעילות לפי שעות היממה'}</h3>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={stats.hourlyActivity}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                                <YAxis allowDecimals={false} />
                                <Tooltip labelFormatter={(hour) => `שעה: ${hour}:00`} />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    name="מספר פתיחות"
                                    stroke="#8b5cf6"
                                    fill="#8b5cf6"
                                    fillOpacity={0.3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Hourly Activity List */}
                <div className="stats-list-card full-width">
                    <h3>{isPersonal ? 'הפעילות שלי לפי שעות - רשימה' : 'פעילות לפי שעות היממה - רשימה'}</h3>
                    <div className="stats-list">
                        {stats.hourlyActivity && stats.hourlyActivity.length > 0 ? (
                            <div className="hourly-stats-container">
                                {(() => {
                                    // Filter out hours with 0 count
                                    const activeHours = stats.hourlyActivity.filter(h => h.count > 0);
                                    if (activeHours.length === 0) {
                                        return <p className="no-data">אין פעילות להצגה</p>;
                                    }
                                    const maxCount = Math.max(...activeHours.map(h => h.count));
                                    return activeHours.map((hour, index) => {
                                        const percentage = maxCount > 0 ? (hour.count / maxCount) * 100 : 0;
                                        const getBarColor = () => {
                                            if (percentage >= 80) return '#10b981'; // ירוק - פעילות גבוהה
                                            if (percentage >= 50) return '#3b82f6'; // כחול - פעילות בינונית
                                            if (percentage >= 20) return '#f59e0b'; // כתום - פעילות נמוכה
                                            return '#e5e7eb'; // אפור - פעילות נמוכה מאוד
                                        };
                                        return (
                                            <div key={index} className="hourly-stat-row peak-hour">
                                                <div className="hour-time">
                                                    <span className="hour-minutes">00</span>
                                                    <span className="hour-separator">:</span>
                                                    <span className="hour-number">{String(hour.hour).padStart(2, '0')}</span>
                                                </div>
                                                <div className="hour-bar-container">
                                                    <div 
                                                        className="hour-bar" 
                                                        style={{ 
                                                            width: `${percentage}%`,
                                                            backgroundColor: getBarColor()
                                                        }}
                                                    >
                                                        <div className="hour-bar-fill"></div>
                                                    </div>
                                                </div>
                                                <div className="hour-count-display">
                                                    <span className="count-number">{hour.count}</span>
                                                    <span className="count-unit">פתיחות</span>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        ) : (
                            <p className="no-data">אין נתונים להצגה</p>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
        .stats-summary-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }
        .stats-summary-card h3 {
          margin: 0 0 1rem 0;
          color: white;
        }
        .cost-summary {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .cost-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }
        .cost-label {
          font-size: 1rem;
          font-weight: 500;
        }
        .cost-value {
          font-size: 1.5rem;
          font-weight: 700;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 2rem;
          margin-top: 2rem;
        }
        .chart-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .chart-card.full-width {
          grid-column: 1 / -1;
        }
        .chart-container {
          margin-top: 1rem;
        }
        .stats-list-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .stats-list-card.full-width {
          grid-column: 1 / -1;
        }
        .stats-list {
          margin-top: 1rem;
        }
        .stats-table {
          width: 100%;
          border-collapse: collapse;
        }
        .stats-table thead {
          background: rgba(59, 130, 246, 0.1);
        }
        .stats-table th {
          padding: 0.75rem;
          text-align: right;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid rgba(59, 130, 246, 0.2);
        }
        .stats-table td {
          padding: 0.75rem;
          text-align: right;
          border-bottom: 1px solid #e5e7eb;
        }
        .stats-table tbody tr:hover {
          background: rgba(59, 130, 246, 0.05);
        }
        .rank-cell {
          width: 80px;
          text-align: center;
        }
        .rank-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-weight: 600;
          font-size: 0.875rem;
          color: white;
        }
        .rank-badge.rank-1 {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
        }
        .rank-badge.rank-2 {
          background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
        }
        .rank-badge.rank-3 {
          background: linear-gradient(135deg, #cd7f32 0%, #a0522d 100%);
        }
        .rank-badge:not(.rank-1):not(.rank-2):not(.rank-3) {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        }
        .name-cell {
          font-weight: 500;
          color: #1f2937;
        }
        .count-cell {
          font-size: 1.1rem;
        }
        .count-cell strong {
          color: #3b82f6;
          font-size: 1.25rem;
        }
        .count-label {
          color: #6b7280;
          font-size: 0.875rem;
          margin-right: 0.25rem;
        }
        .hourly-stats-container {
          margin-top: 1.5rem;
          background: #f9fafb;
          border-radius: 12px;
          padding: 1.5rem;
          border: 1px solid #e5e7eb;
        }
        .hourly-stat-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          margin-bottom: 0.5rem;
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          transition: all 0.2s ease;
        }
        .hourly-stat-row:hover {
          border-color: #3b82f6;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
          transform: translateX(-4px);
        }
        .hourly-stat-row.peak-hour {
          border-left: 3px solid #10b981;
        }
        .hour-time {
          display: flex;
          align-items: center;
          min-width: 80px;
          font-family: 'Courier New', monospace;
          font-weight: 600;
          color: #1f2937;
        }
        .hour-number {
          font-size: 1.25rem;
          color: #3b82f6;
        }
        .hour-separator {
          margin: 0 2px;
          color: #9ca3af;
        }
        .hour-minutes {
          font-size: 1rem;
          color: #3b82f6;
        }
        .hour-bar-container {
          flex: 1;
          height: 32px;
          background: #f3f4f6;
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          display: flex;
          align-items: center;
        }
        .hour-bar {
          height: 100%;
          border-radius: 16px;
          transition: width 0.5s ease, background-color 0.3s ease;
          position: relative;
          display: flex;
          align-items: center;
          min-width: 4px;
        }
        .hour-bar-fill {
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%);
          border-radius: 16px;
        }
        .hour-count-display {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          min-width: 100px;
          text-align: right;
        }
        .count-number {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1f2937;
          line-height: 1.2;
        }
        .count-unit {
          font-size: 0.75rem;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .no-data {
          text-align: center;
          color: #9ca3af;
          padding: 2rem;
          font-style: italic;
        }
        .date-filter select {
          padding: 0.5rem 1rem;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
          font-size: 1rem;
        }
        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          .hourly-stat-row {
            flex-wrap: wrap;
            gap: 0.75rem;
          }
          .hour-time {
            min-width: 60px;
          }
          .hour-bar-container {
            width: 100%;
            order: 3;
          }
          .hour-count-display {
            min-width: auto;
            flex-direction: row;
            align-items: center;
            gap: 0.25rem;
          }
          .count-number {
            font-size: 1.25rem;
          }
        }
      `}</style>
        </div>
    );
};

export default GateStatistics;
