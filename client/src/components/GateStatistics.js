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

const GateStatistics = () => {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [dateRange, setDateRange] = useState('week'); // 'day', 'week', 'month', 'all'

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
                <h1>סטטיסטיקות שערים</h1>
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

            <div className="stats-grid">
                {/* Top Gates Chart */}
                <div className="chart-card">
                    <h3>שערים פופולריים</h3>
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

                {/* Top Users Chart */}
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

                {/* Hourly Activity Chart */}
                <div className="chart-card full-width">
                    <h3>פעילות לפי שעות היממה</h3>
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
            </div>

            <style jsx>{`
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
        }
      `}</style>
        </div>
    );
};

export default GateStatistics;
