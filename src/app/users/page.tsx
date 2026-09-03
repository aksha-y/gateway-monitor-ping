"use client";

import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Edit } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    role: 'ADMIN',
    enabled: true
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSave = async () => {
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/users/${editingId}` : '/api/users';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          userRole: formData.role
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save user');
      }

      setShowModal(false);
      setEditingId(null);
      setFormData({ username: '', password: '', name: '', email: '', role: 'ADMIN', enabled: true });
      fetchUsers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete user');
      }
      fetchUsers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={24} style={{ color: 'var(--primary)' }} />
          User Management
        </h2>
        <button className="btn btn-primary" onClick={() => {
          setEditingId(null);
          setFormData({ username: '', password: '', name: '', email: '', role: 'ADMIN', enabled: true });
          setShowModal(true);
        }}>
          <Plus size={16} /> Add User
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.name || '-'}</td>
                <td><span className="badge">{u.role}</span></td>
                <td>
                  <span className={`badge ${u.enabled ? 'badge-success' : 'badge-error'}`}>
                    {u.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td>{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                <td>
                  <button className="btn btn-outline" style={{ marginRight: '8px' }} onClick={() => {
                    setEditingId(u.id);
                    setFormData({
                      username: u.username,
                      password: '',
                      name: u.name || '',
                      email: u.email || '',
                      role: u.role,
                      enabled: u.enabled === 1
                    });
                    setShowModal(true);
                  }}>
                    <Edit size={16} />
                  </button>
                  <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete(u.id)}>
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
          <div className="modal">
            <h3>{editingId ? 'Edit User' : 'Add User'}</h3>
            
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

            <div className="form-group">
              <label>Name (Optional)</label>
              <input 
                type="text" 
                className="input" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>Email (Optional)</label>
              <input 
                type="email" 
                className="input" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <select 
                className="input" 
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
              >
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MONITOR">MONITOR</option>
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={formData.enabled}
                onChange={e => setFormData({...formData, enabled: e.target.checked})}
              />
              <label style={{ margin: 0 }}>Account Enabled</label>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
