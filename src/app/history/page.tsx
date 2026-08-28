"use client";

import { useEffect, useState } from 'react';
import { Search, Filter } from 'lucide-react';

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filterStatus, setFilterStatus] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchHistory();
  }, [filterStatus, search]);

  const fetchHistory = async () => {
    try {
      const url = new URL(window.location.origin + '/api/history/monitoring');
      url.searchParams.append('limit', '200');
      if (filterStatus !== 'All') url.searchParams.append('status', filterStatus);
      if (search) url.searchParams.append('search', search);

      const res = await fetch(url.toString());
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error('Failed to fetch history', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Monitoring History</h1>
      <p className="subtitle">Track state transitions and events across all gateways</p>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--muted)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search by Property ID, Name, or IP..." 
            style={{ paddingLeft: '36px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} color="var(--muted)" />
          <select 
            className="form-input" 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="All">All Events</option>
            <option value="ONLINE">Online</option>
            <option value="POSSIBLE_DOWN">Possible Down</option>
            <option value="DOWN">Down</option>
            <option value="RECOVERED">Recovered</option>
            <option value="MONITORING_ERROR">Monitoring Error</option>
            <option value="DISABLED">Disabled</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Property</th>
              <th>Gateway IP</th>
              <th>Event</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px' }}>Loading...</td></tr>
            ) : history.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px' }}>No history found.</td></tr>
            ) : (
              history.map((item) => {
                let badgeClass = 'not-checked';
                switch(item.event_type) {
                  case 'ONLINE': badgeClass = 'online'; break;
                  case 'DOWN': badgeClass = 'offline'; break;
                  case 'POSSIBLE_DOWN': badgeClass = 'possible-down'; break;
                  case 'MONITORING_ERROR': badgeClass = 'mon-error'; break;
                  case 'DISABLED': badgeClass = 'disabled'; break;
                  case 'MAINTENANCE': badgeClass = 'disabled'; break;
                  case 'RECOVERED': badgeClass = 'online'; break;
                }

                return (
                  <tr key={item.id}>
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                    <td>
                      <strong>{item.property_id}</strong><br/>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{item.property_name}</span>
                    </td>
                    <td>{item.gateway_ip}</td>
                    <td>
                      <span className={`badge ${badgeClass}`}>{item.event_type.replace('_', ' ')}</span>
                    </td>
                    <td>{item.details || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
