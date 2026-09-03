"use client";

import React, { useState, useEffect } from 'react';
import { Server, Plus, Trash2, Edit, CheckCircle, XCircle } from 'lucide-react';

export default function ControllersPage() {
  const [controllers, setControllers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    username: '',
    password: '',
    enabled: true
  });

  const [testResult, setTestResult] = useState<{success: boolean, msg: string} | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchControllers = async () => {
    try {
      const res = await fetch('/api/controllers');
      if (!res.ok) throw new Error('Failed to load controllers');
      const data = await res.json();
      setControllers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchControllers();
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/controllers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (!res.ok) {
        setTestResult({ success: false, msg: data.error || 'Connection failed' });
      } else {
        setTestResult({ success: true, msg: `Connected successfully! Found ${data.sitesCount} sites.` });
      }
    } catch (e: any) {
      setTestResult({ success: false, msg: e.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/controllers/${editingId}` : '/api/controllers';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save controller');
      }

      setShowModal(false);
      setEditingId(null);
      setTestResult(null);
      setFormData({ name: '', url: '', username: '', password: '', enabled: true });
      fetchControllers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this controller? This will break properties using it.')) return;
    try {
      const res = await fetch(`/api/controllers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete controller');
      fetchControllers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={24} style={{ color: 'var(--primary)' }} />
          UniFi Controllers
        </h2>
        <button className="btn btn-primary" onClick={() => {
          setEditingId(null);
          setTestResult(null);
          setFormData({ name: '', url: '', username: '', password: '', enabled: true });
          setShowModal(true);
        }}>
          <Plus size={16} /> Add Controller
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>URL</th>
              <th>Username</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {controllers.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.url}</td>
                <td>{c.username}</td>
                <td>
                  <span className={`badge ${c.enabled ? 'badge-success' : 'badge-error'}`}>
                    {c.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-outline" style={{ marginRight: '8px' }} onClick={() => {
                    setEditingId(c.id);
                    setTestResult(null);
                    setFormData({
                      name: c.name,
                      url: c.url,
                      username: c.username,
                      password: '',
                      enabled: c.enabled === 1
                    });
                    setShowModal(true);
                  }}>
                    <Edit size={16} />
                  </button>
                  <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete(c.id)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h3>{editingId ? 'Edit Controller' : 'Add Controller'}</h3>
            
            <div className="form-group">
              <label>Controller Name (e.g. Headquarters)</label>
              <input 
                type="text" 
                className="input" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>URL (e.g. https://192.168.1.1 or https://unifi.example.com)</label>
              <input 
                type="url" 
                className="input" 
                value={formData.url}
                onChange={e => setFormData({...formData, url: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>Username</label>
              <input 
                type="text" 
                className="input" 
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>Password {editingId && '(Leave blank to keep unchanged)'}</label>
              <input 
                type="password" 
                className="input" 
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={formData.enabled}
                onChange={e => setFormData({...formData, enabled: e.target.checked})}
              />
              <label style={{ margin: 0 }}>Enabled for monitoring</label>
            </div>

            {testResult && (
              <div className={`alert ${testResult.success ? 'alert-success' : 'alert-error'}`} style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  {testResult.msg}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-outline" onClick={handleTest} disabled={testing}>
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <div style={{ flex: 1 }}></div>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
