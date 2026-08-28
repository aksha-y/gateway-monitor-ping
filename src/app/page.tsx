"use client";

import { useEffect, useState } from 'react';
import { Play, Loader2, Search, Filter } from 'lucide-react';

export default function Dashboard() {
  const [properties, setProperties] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<number | null>(null);
  
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  useEffect(() => {
    fetchProperties();
    fetchHealth();
    const interval = setInterval(() => {
      fetchProperties();
      fetchHealth();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      setHealth(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties');
      const data = await res.json();
      setProperties(data);
    } catch (error) {
      console.error('Failed to fetch properties', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNow = async (prop: any) => {
    setTestingId(prop.id);
    try {
      await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: prop.gateway_ip })
      });
      await fetchProperties();
    } catch (error) {
      console.error('Ping failed', error);
    } finally {
      setTestingId(null);
    }
  };

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  const total = properties.length;
  const online = properties.filter(p => p.current_status === 'ONLINE').length;
  const possibleDown = properties.filter(p => p.current_status === 'POSSIBLE_DOWN').length;
  const down = properties.filter(p => p.current_status === 'DOWN').length;
  const disabled = properties.filter(p => p.current_status === 'DISABLED' || !p.enabled).length;
  const monitoringError = properties.filter(p => p.current_status === 'MONITORING_ERROR').length;

  const filteredProperties = properties.filter(prop => {
    let statusText = prop.current_status || 'NOT_CHECKED';
    if (!prop.enabled) statusText = 'DISABLED';
    if (filterStatus !== 'All' && statusText !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!prop.property_id.toLowerCase().includes(s) &&
          !prop.property_name.toLowerCase().includes(s) &&
          !prop.gateway_ip.toLowerCase().includes(s)) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    // Sort DOWN to the top
    if (a.current_status === 'DOWN' && b.current_status !== 'DOWN') return -1;
    if (b.current_status === 'DOWN' && a.current_status !== 'DOWN') return 1;
    if (a.current_status === 'POSSIBLE_DOWN' && b.current_status !== 'POSSIBLE_DOWN') return -1;
    if (b.current_status === 'POSSIBLE_DOWN' && a.current_status !== 'POSSIBLE_DOWN') return 1;
    return 0; // maintain original sorting (by created_at desc from API) for rest
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Overview of UniFi gateway connectivity (Auto-refreshes every 15s)</p>
        </div>
        
        {health && (
          <div className="stat-card" style={{ display: 'flex', gap: '24px', padding: '16px 24px', fontSize: '0.85rem' }}>
            <div>
              <div style={{ color: 'var(--muted)', marginBottom: '4px' }}>Monitoring Worker</div>
              <div style={{ color: health.worker === 'RUNNING' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                {health.worker}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--muted)', marginBottom: '4px' }}>Database</div>
              <div style={{ color: 'var(--success)', fontWeight: 600 }}>{health.database}</div>
            </div>
            <div>
              <div style={{ color: 'var(--muted)', marginBottom: '4px' }}>SMTP</div>
              <div style={{ color: health.smtp === 'CONFIGURED' ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                {health.smtp}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-title">Total</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card" style={{ borderTop: '4px solid var(--success)' }}>
          <div className="stat-title">Online</div>
          <div className="stat-value">{online}</div>
        </div>
        <div className="stat-card" style={{ borderTop: '4px solid var(--warning)' }}>
          <div className="stat-title">Possible Down</div>
          <div className="stat-value">{possibleDown}</div>
        </div>
        <div className="stat-card" style={{ borderTop: '4px solid var(--danger)' }}>
          <div className="stat-title">Down</div>
          <div className="stat-value">{down}</div>
        </div>
        <div className="stat-card" style={{ borderTop: '4px solid var(--muted)' }}>
          <div className="stat-title">Disabled</div>
          <div className="stat-value">{disabled}</div>
        </div>
        {monitoringError > 0 && (
          <div className="stat-card" style={{ borderTop: '4px solid #991b1b' }}>
            <div className="stat-title">Mon Error</div>
            <div className="stat-value">{monitoringError}</div>
          </div>
        )}
      </div>

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
            <option value="All">All Status</option>
            <option value="ONLINE">Online</option>
            <option value="POSSIBLE_DOWN">Possible Down</option>
            <option value="DOWN">Down</option>
            <option value="DISABLED">Disabled</option>
            <option value="MONITORING_ERROR">Monitoring Error</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Property</th>
              <th>Gateway IP</th>
              <th>Status</th>
              <th>Last Success</th>
              <th>Last Check</th>
              <th>Response</th>
              <th>Downtime</th>
              <th>Last Alert</th>
              <th>Fails</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProperties.map((prop) => {
              let badgeClass = 'not-checked';
              let statusText = prop.current_status || 'NOT_CHECKED';
              
              if (!prop.enabled) {
                statusText = 'DISABLED';
                badgeClass = 'disabled';
              } else {
                switch(statusText) {
                  case 'ONLINE': badgeClass = 'online'; break;
                  case 'DOWN': badgeClass = 'offline'; break;
                  case 'POSSIBLE_DOWN': badgeClass = 'possible-down'; break;
                  case 'MONITORING_ERROR': badgeClass = 'mon-error'; break;
                  case 'DISABLED': badgeClass = 'disabled'; break;
                  case 'MAINTENANCE': badgeClass = 'disabled'; break;
                }
              }

              // Calculate current downtime if DOWN
              let currentDowntime = '-';
              if (statusText === 'DOWN' && prop.downtime_start) {
                const diffSecs = Math.floor((new Date().getTime() - new Date(prop.downtime_start).getTime()) / 1000);
                const mins = Math.floor(diffSecs / 60);
                currentDowntime = `${mins}m ${diffSecs % 60}s`;
              } else if (prop.total_downtime_seconds) {
                 const mins = Math.floor(prop.total_downtime_seconds / 60);
                 currentDowntime = `(Hist: ${mins}m)`;
              }

              const alertStr = prop.last_alert_status ? `${prop.last_alert_type} (${prop.last_alert_status})` : '-';

              return (
                <tr key={prop.id}>
                  <td>
                    <strong>{prop.property_id}</strong><br/>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)'}}>{prop.property_name}</span>
                  </td>
                  <td>{prop.gateway_ip}</td>
                  <td>
                    <span className={`badge ${badgeClass}`}>{statusText.replace('_', ' ')}</span>
                  </td>
                  <td>
                    {prop.last_success ? new Date(prop.last_success).toLocaleTimeString() : '-'}
                  </td>
                  <td>
                    {prop.last_check ? new Date(prop.last_check).toLocaleTimeString() : '-'}
                  </td>
                  <td>
                    {prop.response_time ? `${Math.round(prop.response_time)} ms` : '-'}
                  </td>
                  <td>{currentDowntime}</td>
                  <td>{alertStr}</td>
                  <td>{prop.failure_count > 0 ? prop.failure_count : '-'}</td>
                  <td>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => handleTestNow(prop)}
                      disabled={testingId === prop.id || !prop.enabled}
                    >
                      {testingId === prop.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Play size={16} />
                      )}
                      Test
                    </button>
                  </td>
                </tr>
              );
            })}
            
            {filteredProperties.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '32px' }}>
                  No properties matched your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
