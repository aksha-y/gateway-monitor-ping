"use client";

import { useState } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, XCircle, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults([]);
      setSummary(null);
    }
  };

  const handleValidate = async () => {
    if (!file) return;
    setIsUploading(true);
    
    try {
      const text = await file.text();
      const res = await fetch('/api/import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to validate');
      
      setResults(data.results);
      setSummary(data.summary);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!summary || summary.valid + summary.warning === 0) return;
    setIsCommitting(true);
    
    try {
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: results })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      alert(`Successfully imported ${data.inserted} properties.`);
      router.push('/');
    } catch (err: any) {
      alert(`Failed to commit: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,property_id,property_name,gateway_ip\nHOTEL001,Holiday Inn Example,192.168.10.1\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "unifi_import_template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div>
      <div className="flex-between">
        <div>
          <h1>Bulk Import</h1>
          <p className="subtitle">Upload a CSV file to add multiple gateways</p>
        </div>
        <button className="btn btn-outline" onClick={downloadTemplate}>
          <Download size={16} /> Download CSV Template
        </button>
      </div>

      <div className="stat-card" style={{ padding: '32px', marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <input type="file" accept=".csv" onChange={handleFileChange} />
        
        <button 
          className="btn btn-primary" 
          disabled={!file || isUploading} 
          onClick={handleValidate}
          style={{ width: 'fit-content' }}
        >
          <UploadCloud size={16} /> {isUploading ? 'Validating...' : 'Validate CSV'}
        </button>
      </div>

      {summary && (
        <div style={{ marginBottom: '32px' }}>
          <h2>Preview Report</h2>
          <div className="stats-grid" style={{ marginTop: '16px' }}>
            <div className="stat-card">
              <div className="stat-title">Total Rows</div>
              <div className="stat-value">{summary.total}</div>
            </div>
            <div className="stat-card" style={{ borderTop: '4px solid var(--success)' }}>
              <div className="stat-title">Valid</div>
              <div className="stat-value">{summary.valid}</div>
            </div>
            <div className="stat-card" style={{ borderTop: '4px solid var(--warning)' }}>
              <div className="stat-title">Warnings</div>
              <div className="stat-value">{summary.warning}</div>
            </div>
            <div className="stat-card" style={{ borderTop: '4px solid var(--danger)' }}>
              <div className="stat-title">Invalid</div>
              <div className="stat-value">{summary.invalid}</div>
            </div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Row</th>
                <th>Property ID</th>
                <th>Property Name</th>
                <th>Gateway IP</th>
                <th>Status</th>
                <th>Messages</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={{ opacity: r.status === 'INVALID' ? 0.6 : 1 }}>
                  <td>{r.rowNumber}</td>
                  <td>{r.property_id}</td>
                  <td>{r.property_name}</td>
                  <td>{r.gateway_ip}</td>
                  <td>
                    {r.status === 'VALID' && <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14}/> VALID</span>}
                    {r.status === 'WARNING' && <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={14}/> WARNING</span>}
                    {r.status === 'INVALID' && <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={14}/> INVALID</span>}
                  </td>
                  <td>
                    {r.messages.map((m: string, idx: number) => <div key={idx} style={{ fontSize: '0.85rem' }}>• {m}</div>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary && (
        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="btn btn-primary" 
            disabled={summary.valid + summary.warning === 0 || isCommitting}
            onClick={handleCommit}
          >
            {isCommitting ? 'Importing...' : `Import ${summary.valid + summary.warning} Valid Properties`}
          </button>
        </div>
      )}
    </div>
  );
}
