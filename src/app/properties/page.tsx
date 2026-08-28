"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';

export default function PropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  
  const [formData, setFormData] = useState({
    id: null,
    property_id: '',
    property_name: '',
    gateway_ip: '',
    enabled: true,
    notes: ''
  });

  useEffect(() => {
    fetchProperties();
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

  const openModal = (prop: any = null) => {
    setError('');
    setWarning('');
    if (prop) {
      setFormData({
        id: prop.id,
        property_id: prop.property_id,
        property_name: prop.property_name,
        gateway_ip: prop.gateway_ip,
        enabled: prop.enabled === 1,
        notes: prop.notes || ''
      });
    } else {
      setFormData({
        id: null,
        property_id: '',
        property_name: '',
        gateway_ip: '',
        enabled: true,
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setWarning('');

    // Client side validation
    if (!formData.property_id || !formData.property_name || !formData.gateway_ip) {
      setError('Please fill in all required fields.');
      return;
    }
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(formData.gateway_ip)) {
      setError('Invalid IPv4 address format.');
      return;
    }

    // Check for duplicate IP warning
    const duplicateIP = properties.find(p => p.gateway_ip === formData.gateway_ip && p.id !== formData.id);
    if (duplicateIP && !warning) {
      setWarning(`Warning: Gateway IP ${formData.gateway_ip} is already used by ${duplicateIP.property_name}. Click Save again to proceed anyway.`);
      return;
    }

    try {
      const url = formData.id ? `/api/properties/${formData.id}` : '/api/properties';
      const method = formData.id ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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

  const toggleEnabled = async (prop: any) => {
    try {
      const res = await fetch(`/api/properties/${prop.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: prop.enabled ? 0 : 1 })
      });
      if (res.ok) {
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
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={16} /> Add Property
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Property ID</th>
              <th>Name</th>
              <th>Gateway IP</th>
              <th>Monitoring</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {properties.map(prop => (
              <tr key={prop.id}>
                <td><strong>{prop.property_id}</strong></td>
                <td>{prop.property_name}</td>
                <td>{prop.gateway_ip}</td>
                <td>
                  <button 
                    onClick={() => toggleEnabled(prop)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: prop.enabled ? 'var(--success)' : 'var(--muted)' }}
                  >
                    {prop.enabled ? <CheckCircle size={18} /> : <XCircle size={18} />}
                    {prop.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
                <td>{new Date(prop.created_at).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-outline" style={{ padding: '6px' }} onClick={() => openModal(prop)}>
                      <Edit2 size={14} />
                    </button>
                    <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => handleDelete(prop.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {properties.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                  No properties found. Click "Add Property" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{formData.id ? 'Edit Property' : 'Add Property'}</h2>
              <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.5rem' }} onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                {warning && <div className="alert alert-warning">{warning}</div>}
                
                <div className="form-group">
                  <label className="form-label">Property ID *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formData.property_id}
                    onChange={(e) => setFormData({...formData, property_id: e.target.value.toUpperCase()})}
                    disabled={!!formData.id} // Cannot change ID once created
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
