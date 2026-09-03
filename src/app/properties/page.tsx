"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';

export default function PropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [controllers, setControllers] = useState<any[]>([]);
  const [userRole, setUserRole] = useState('MONITOR');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [sites, setSites] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  
  const [formData, setFormData] = useState({
    id: null,
    property_id: '',
    property_name: '',
    monitoring_method: 'ICMP',
    gateway_ip: '',
    controller_id: '',
    site_id: '',
    site_name: '',
    device_mac: '',
    device_id: '',
    gateway_name: '',
    enabled: true,
    notes: ''
  });

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setUserRole(d.role || 'MONITOR'))
      .catch(() => {});
      
    fetchProperties();
    fetchControllers();
  }, []);

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties');
      const data = await res.json();
      setProperties(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchControllers = async () => {
    try {
      const res = await fetch('/api/controllers');
      if (res.ok) {
        setControllers(await res.json());
      }
    } catch (err) {}
  };

  const fetchSites = async (controllerId: string) => {
    if (!controllerId) {
      setSites([]);
      return;
    }
    setLoadingSites(true);
    try {
      const res = await fetch(`/api/controllers/${controllerId}/sites`);
      if (res.ok) {
        const data = await res.json();
        setSites(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("fetchSites Error:", res.status, errData);
      }
    } catch (err) {
      console.error("fetchSites Network Error:", err);
    }
    setLoadingSites(false);
  };

  const fetchDevices = async (controllerId: string, siteId: string) => {
    if (!controllerId || !siteId) {
      setDevices([]);
      return;
    }
    setLoadingDevices(true);
    try {
      const res = await fetch(`/api/controllers/${controllerId}/sites/${siteId}/devices`);
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("fetchDevices Error:", res.status, errData);
      }
    } catch (err) {
      console.error("fetchDevices Network Error:", err);
    }
    setLoadingDevices(false);
  };

  const openModal = async (prop: any = null) => {
    setError('');
    if (prop) {
      setFormData({
        id: prop.id,
        property_id: prop.property_id,
        property_name: prop.property_name,
        monitoring_method: prop.monitoring_method || 'ICMP',
        gateway_ip: prop.gateway_ip || '',
        controller_id: prop.controller_id || '',
        site_id: prop.site_id || '',
        site_name: prop.site_name || '',
        device_mac: prop.device_mac || '',
        device_id: prop.device_id || '',
        gateway_name: prop.gateway_name || '',
        enabled: prop.enabled === 1,
        notes: prop.notes || ''
      });
      
      if (prop.monitoring_method === 'UNIFI_CONTROLLER' && prop.controller_id) {
        await fetchSites(prop.controller_id);
        if (prop.site_name) {
          await fetchDevices(prop.controller_id, prop.site_name);
        }
      }
    } else {
      setFormData({
        id: null,
        property_id: '',
        property_name: '',
        monitoring_method: 'ICMP',
        gateway_ip: '',
        controller_id: '',
        site_id: '',
        site_name: '',
        device_mac: '',
        device_id: '',
        gateway_name: '',
        enabled: true,
        notes: ''
      });
      setSites([]);
      setDevices([]);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.property_id || !formData.property_name) {
      setError('Please fill in Property ID and Name.');
      return;
    }

    if (formData.monitoring_method === 'ICMP') {
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipv4Regex.test(formData.gateway_ip)) {
        setError('Invalid IPv4 address format.');
        return;
      }
    } else if (formData.monitoring_method === 'UNIFI_CONTROLLER') {
      if (!formData.controller_id || !formData.site_name || (!formData.device_mac && !formData.device_id)) {
        setError('Please select a Controller, Site, and Device.');
        return;
      }
    }

    try {
      const url = formData.id ? `/api/properties/${formData.id}` : '/api/properties';
      const method = formData.id ? 'PUT' : 'POST';
      
      const payload = { ...formData };
      if (payload.monitoring_method === 'UNIFI_CONTROLLER') {
        // Find device name for reference
        const selectedDevice = devices.find(d => d.mac === payload.device_mac || d.device_id === payload.device_id);
        if (selectedDevice) {
          payload.gateway_name = selectedDevice.name || selectedDevice.model || 'Unknown Gateway';
        }
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || 'Failed to save property');
      }

      setIsModalOpen(false);
      fetchProperties();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this property?')) return;
    try {
      const res = await fetch(`/api/properties/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to delete');
      } else {
        fetchProperties();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8">Loading properties...</div>;

  return (
    <div>
      <div className="flex-between mb-6">
        <div>
          <h1>Properties</h1>
          <p className="subtitle">Manage monitored UniFi gateways</p>
        </div>
        {userRole !== 'MONITOR' && (
          <button className="btn btn-primary" onClick={() => openModal()}>
            <Plus size={16} /> Add Property
          </button>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Property ID</th>
              <th>Name</th>
              <th>Method</th>
              <th>Target</th>
              <th>Status</th>
              <th>Created</th>
              {userRole !== 'MONITOR' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {properties.map(prop => (
              <tr key={prop.id}>
                <td><strong>{prop.property_id}</strong></td>
                <td>{prop.property_name}</td>
                <td><span className="badge">{prop.monitoring_method || 'ICMP'}</span></td>
                <td>
                  {(!prop.monitoring_method || prop.monitoring_method === 'ICMP') ? (
                    prop.gateway_ip
                  ) : (
                    <span>{prop.site_name} &rarr; {prop.gateway_name}</span>
                  )}
                </td>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: prop.enabled ? 'var(--success)' : 'var(--muted)' }}>
                    {prop.enabled ? <CheckCircle size={18} /> : <XCircle size={18} />}
                    {prop.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td>{new Date(prop.created_at).toLocaleDateString()}</td>
                {userRole !== 'MONITOR' && (
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-outline" style={{ padding: '6px' }} onClick={() => openModal(prop)}>
                        <Edit2 size={14} />
                      </button>
                      {userRole === 'SUPER_ADMIN' && (
                        <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => handleDelete(prop.id)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {properties.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>
                  No properties found. Click "Add Property" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{formData.id ? 'Edit Property' : 'Add Property'}</h2>
              <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.5rem' }} onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Property ID *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formData.property_id}
                      onChange={(e) => setFormData({...formData, property_id: e.target.value.toUpperCase()})}
                      disabled={!!formData.id}
                      placeholder="e.g. HOTEL001"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Property Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formData.property_name}
                      onChange={(e) => setFormData({...formData, property_name: e.target.value})}
                      placeholder="e.g. Grand Hotel Downtown"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Monitoring Method</label>
                  <select 
                    className="form-input" 
                    value={formData.monitoring_method}
                    onChange={(e) => setFormData({...formData, monitoring_method: e.target.value})}
                  >
                    <option value="ICMP">ICMP Ping (Direct IP)</option>
                    <option value="UNIFI_CONTROLLER">UniFi Controller API</option>
                  </select>
                </div>
                
                {formData.monitoring_method === 'ICMP' && (
                  <div className="form-group">
                    <label className="form-label">Gateway IP (IPv4) *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formData.gateway_ip}
                      onChange={(e) => setFormData({...formData, gateway_ip: e.target.value})}
                      placeholder="192.168.1.1"
                    />
                  </div>
                )}

                {formData.monitoring_method === 'UNIFI_CONTROLLER' && (
                  <div style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">UniFi Controller *</label>
                      <select 
                        className="form-input" 
                        value={formData.controller_id}
                        onChange={async (e) => {
                          setFormData({...formData, controller_id: e.target.value, site_name: '', site_id: '', device_mac: '', device_id: ''});
                          await fetchSites(e.target.value);
                        }}
                      >
                        <option value="">-- Select Controller --</option>
                        {controllers.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.url})</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Site * {loadingSites && '(Loading...)'}</label>
                      <select 
                        className="form-input" 
                        value={formData.site_name}
                        disabled={!formData.controller_id || loadingSites}
                        onChange={async (e) => {
                          const s = sites.find(x => x.name === e.target.value);
                          setFormData({...formData, site_name: e.target.value, site_id: s ? s._id : '', device_mac: '', device_id: ''});
                          await fetchDevices(formData.controller_id, e.target.value);
                        }}
                      >
                        <option value="">-- Select Site --</option>
                        {sites.map(s => (
                          <option key={s.name} value={s.name}>{s.desc === 'default' ? 'Default' : s.desc}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Gateway Device * {loadingDevices && '(Loading...)'}</label>
                      <select 
                        className="form-input" 
                        value={formData.device_mac || formData.device_id}
                        disabled={!formData.site_name || loadingDevices}
                        onChange={(e) => {
                          const mac = e.target.value;
                          const d = devices.find(x => x.mac === mac || x.device_id === mac);
                          setFormData({...formData, device_mac: d?.mac || '', device_id: d?.device_id || ''});
                        }}
                      >
                        <option value="">-- Select Gateway --</option>
                        {devices.map(d => (
                          <option key={d.mac || d.device_id} value={d.mac || d.device_id}>{d.name || d.model} ({d.mac || d.ip})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={formData.enabled}
                      onChange={(e) => setFormData({...formData, enabled: e.target.checked})}
                      style={{ width: '16px', height: '16px' }}
                    />
                    Enable Monitoring
                  </label>
                </div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Notes (Optional)</label>
                  <textarea 
                    className="form-input" 
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Property</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
