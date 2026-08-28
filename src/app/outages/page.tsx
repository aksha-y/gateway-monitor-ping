"use client";

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export default function OutagesPage() {
  const [outages, setOutages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchOutages();
  }, [search]);

  const fetchOutages = async () => {
    try {
      const url = new URL(window.location.origin + '/api/history/outages');
      url.searchParams.append('limit', '100');
      if (search) url.searchParams.append('search', search);

      const res = await fetch(url.toString());
      const data = await res.json();
      setOutages(data);
    } catch (e) {
      console.error('Failed to fetch outages', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Outage History</h1>
      <p className="subtitle">Detailed lifecycle of gateway outages and recovery</p>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--muted)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search by Property ID, Name, or Outage ID..." 
            style={{ paddingLeft: '36px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Outage ID</th>
              <th>Property</th>
              <th>Status</th>
              <th>Started</th>
              <th>Alert Sent</th>
              <th>Recovered</th>
              <th>Downtime</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>Loading...</td></tr>
            ) : outages.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>No outages found.</td></tr>
            ) : (
              outages.map((o) => {
                const isResolved = o.status === 'RESOLVED';
                
                let downtimeStr = '-';
                if (o.total_downtime_seconds) {
                  const mins = Math.floor(o.total_downtime_seconds / 60);
                  downtimeStr = `${mins}m ${o.total_downtime_seconds % 60}s`;
                } else if (!isResolved && o.start_time) {
                  const diffSecs = Math.floor((new Date().getTime() - new Date(o.start_time).getTime()) / 1000);
                  const mins = Math.floor(diffSecs / 60);
                  downtimeStr = `${mins}m ${diffSecs % 60}s (Ongoing)`;
                }

                return (
                  <tr key={o.outage_id}>
                    <td><span style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{o.outage_id}</span></td>
                    <td>
                      <strong>{o.property_id}</strong><br/>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{o.property_name}</span>
                    </td>
                    <td>
                      <span className={`badge ${isResolved ? 'online' : 'offline'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td>{new Date(o.start_time).toLocaleString()}</td>
                    <td>
                      {o.alert_time ? new Date(o.alert_time).toLocaleTimeString() : '-'}
                      {o.alert_status === 'FAILED' && <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>(Failed)</span>}
                    </td>
                    <td>
                      {o.recovery_time ? new Date(o.recovery_time).toLocaleTimeString() : '-'}
                      {o.recovery_status === 'FAILED' && <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>(Failed)</span>}
                    </td>
                    <td>{downtimeStr}</td>
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
