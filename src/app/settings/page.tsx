"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Mail } from 'lucide-react';

export default function SettingsPage() {
  const [smtp, setSmtp] = useState({
    host: '',
    port: 587,
    username: '',
    password: '',
    security: 'STARTTLS',
    from_email: '',
    from_name: '',
    reply_to: ''
  });
  const [recipients, setRecipients] = useState<any[]>([]);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMessage, setSmtpMessage] = useState({ type: '', text: '' });
  
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState({ type: '', text: '' });

  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false);
  const [recipientForm, setRecipientForm] = useState({ id: null, name: '', email: '', enabled: true });

  useEffect(() => {
    fetchSmtp();
    fetchRecipients();
  }, []);

  const fetchSmtp = async () => {
    try {
      const res = await fetch('/api/settings/smtp');
      const data = await res.json();
      if (data && data.id) {
        setSmtp({
          host: data.host || '',
          port: data.port || 587,
          username: data.username || '',
          password: data.password || '', // API returns '********' if set
          security: data.security || 'STARTTLS',
          from_email: data.from_email || '',
          from_name: data.from_name || '',
          reply_to: data.reply_to || ''
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRecipients = async () => {
    try {
      const res = await fetch('/api/recipients');
      setRecipients(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleSmtpSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpSaving(true);
    setSmtpMessage({ type: '', text: '' });
    
    try {
      const res = await fetch('/api/settings/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtp)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSmtpMessage({ type: 'success', text: 'SMTP Settings saved successfully.' });
      fetchSmtp();
    } catch (err: any) {
      setSmtpMessage({ type: 'error', text: err.message });
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleTestSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;
    setTesting(true);
    setTestMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/settings/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTestMessage({ type: 'success', text: 'SUCCESS: Test email sent.' });
    } catch (err: any) {
      setTestMessage({ type: 'error', text: `FAILED: ${err.message}` });
    } finally {
      setTesting(false);
    }
  };

  const openRecipientModal = (rec: any = null) => {
    if (rec) {
      setRecipientForm({ id: rec.id, name: rec.name, email: rec.email, enabled: rec.enabled === 1 });
    } else {
      setRecipientForm({ id: null, name: '', email: '', enabled: true });
    }
    setIsRecipientModalOpen(true);
  };

  const saveRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = recipientForm.id ? `/api/recipients/${recipientForm.id}` : '/api/recipients';
      const method = recipientForm.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipientForm)
      });
      if (!res.ok) throw new Error('Failed to save');
      setIsRecipientModalOpen(false);
      fetchRecipients();
    } catch (err) {
      alert('Error saving recipient');
    }
  };

  const deleteRecipient = async (id: number) => {
    if (!confirm('Delete recipient?')) return;
    await fetch(`/api/recipients/${id}`, { method: 'DELETE' });
    fetchRecipients();
  };
  
  const toggleRecipient = async (rec: any) => {
    await fetch(`/api/recipients/${rec.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: rec.enabled ? 0 : 1 })
    });
    fetchRecipients();
  };

  return (
    <div>
      <h1>Settings</h1>
      <p className="subtitle">Configure Email Alerting and SMTP</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        
        {/* SMTP Settings */}
        <div className="stat-card" style={{ padding: '32px' }}>
          <h2 style={{ marginBottom: '24px', fontSize: '1.25rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>SMTP Configuration</h2>
          
          {smtpMessage.text && (
            <div className={`alert ${smtpMessage.type === 'error' ? 'alert-error' : 'alert-warning'}`} style={{ backgroundColor: smtpMessage.type === 'success' ? 'var(--success-bg)' : '', color: smtpMessage.type === 'success' ? 'var(--success-text)' : '' }}>
              {smtpMessage.text}
            </div>
          )}

          <form onSubmit={handleSmtpSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">SMTP Host</label>
                <input className="form-input" required value={smtp.host} onChange={e => setSmtp({...smtp, host: e.target.value})} placeholder="smtp.example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">SMTP Port</label>
                <input className="form-input" type="number" required value={smtp.port} onChange={e => setSmtp({...smtp, port: parseInt(e.target.value)})} />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" value={smtp.username} onChange={e => setSmtp({...smtp, username: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" value={smtp.password} onChange={e => setSmtp({...smtp, password: e.target.value})} placeholder="Leave blank to keep unchanged" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Security</label>
              <select className="form-input" value={smtp.security} onChange={e => setSmtp({...smtp, security: e.target.value})}>
                <option value="None">None</option>
                <option value="STARTTLS">STARTTLS</option>
                <option value="SSL/TLS">SSL/TLS</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">From Email</label>
                <input className="form-input" required type="email" value={smtp.from_email} onChange={e => setSmtp({...smtp, from_email: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">From Name</label>
                <input className="form-input" value={smtp.from_name} onChange={e => setSmtp({...smtp, from_name: e.target.value})} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reply-To Email (Optional)</label>
              <input className="form-input" type="email" value={smtp.reply_to} onChange={e => setSmtp({...smtp, reply_to: e.target.value})} />
            </div>

            <button className="btn btn-primary" type="submit" disabled={smtpSaving}>
              {smtpSaving ? 'Saving...' : 'Save SMTP Settings'}
            </button>
          </form>

          {/* Test SMTP */}
          <div style={{ marginTop: '48px', borderTop: '1px solid var(--card-border)', paddingTop: '24px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Test SMTP</h3>
            
            {testMessage.text && (
              <div className={`alert ${testMessage.type === 'error' ? 'alert-error' : 'alert-warning'}`} style={{ backgroundColor: testMessage.type === 'success' ? 'var(--success-bg)' : '', color: testMessage.type === 'success' ? 'var(--success-text)' : '' }}>
                {testMessage.text}
              </div>
            )}

            <form onSubmit={handleTestSmtp} style={{ display: 'flex', gap: '12px' }}>
              <input className="form-input" type="email" required placeholder="Test recipient email" value={testEmail} onChange={e => setTestEmail(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-outline" type="submit" disabled={testing}>
                {testing ? 'Sending...' : 'Send Test Email'}
              </button>
            </form>
          </div>
        </div>

        {/* Recipients */}
        <div className="stat-card" style={{ padding: '32px' }}>
          <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Notification Recipients</h2>
            <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => openRecipientModal()}>
              <Plus size={14} /> Add
            </button>
          </div>

          <div className="table-container" style={{ background: 'transparent', border: 'none' }}>
            <table style={{ border: '1px solid var(--card-border)' }}>
              <thead>
                <tr>
                  <th>Name / Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map(rec => (
                  <tr key={rec.id}>
                    <td>
                      <strong>{rec.name}</strong><br/>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{rec.email}</span>
                    </td>
                    <td>
                      <button 
                        onClick={() => toggleRecipient(rec)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: rec.enabled ? 'var(--success)' : 'var(--muted)', fontSize: '0.8rem' }}
                      >
                        {rec.enabled ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        {rec.enabled ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-outline" style={{ padding: '4px' }} onClick={() => openRecipientModal(rec)}>
                          <Edit2 size={12} />
                        </button>
                        <button className="btn btn-danger" style={{ padding: '4px' }} onClick={() => deleteRecipient(rec.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {recipients.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '24px' }}>No recipients configured.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isRecipientModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{recipientForm.id ? 'Edit Recipient' : 'Add Recipient'}</h2>
              <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.5rem' }} onClick={() => setIsRecipientModalOpen(false)}>&times;</button>
            </div>
            
            <form onSubmit={saveRecipient}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input className="form-input" required value={recipientForm.name} onChange={e => setRecipientForm({...recipientForm, name: e.target.value})} placeholder="e.g. Support Team" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" required value={recipientForm.email} onChange={e => setRecipientForm({...recipientForm, email: e.target.value})} placeholder="support@example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={recipientForm.enabled} onChange={e => setRecipientForm({...recipientForm, enabled: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                    Enable Notifications
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setIsRecipientModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Recipient</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
