import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib';

interface ApiKey {
  id: number;
  label: string;
  api_key: string;
  rate_limit: number;
  enabled: boolean;
  created_by: string;
  last_used_at: string | null;
  request_count: number;
  created_at: string;
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);

  const load = async () => {
    setLoading(true);
    try { setKeys((await apiGet('/admin/api-keys')) as ApiKey[] || []); } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const create = async () => {
    if (!label.trim()) { showToast('Label required', 'error'); return; }
    try {
      const result: any = await apiPost('/admin/api-keys', { label });
      setNewKey(result.api_key);
      setLabel('');
      load();
    } catch { showToast('Failed to create', 'error'); }
  };

  const toggle = async (id: number, enabled: boolean) => {
    try { await apiPut(`/admin/api-keys/${id}`, { enabled: !enabled }); load(); } catch {}
  };

  const del = async (id: number) => {
    if (!confirm('Delete this API key? All clients using it will lose access.')) return;
    try { await apiDelete(`/admin/api-keys/${id}`); load(); } catch {}
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('API Key copied!');
  };

  if (loading) return <div className="loading"><span className="spin" />Loading...</div>;

  return (
    <div>
      {toast && <div className={`toast ${toast.type}`} style={{position:'fixed',top:16,right:16,zIndex:200}}>{toast.msg}</div>}

      <div className="flex-between mb-2">
        <h1 className="page-title">API Keys</h1>
        <span className="tooltip">{keys.length} keys</span>
      </div>

      {/* Create new key */}
      <div className="card">
        <div className="card-title">Create API Key</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Label</label>
            <input className="form-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. mobile-app, backend-service" />
          </div>
          <div className="form-group" style={{ flex: 'none' }}>
            <button className="btn btn-primary" onClick={create}>Generate Key</button>
          </div>
        </div>
        {newKey && (
          <div style={{ marginTop: 12, padding: 12, background: '#1a2744', borderRadius: 8, border: '1px solid var(--accent)' }}>
            <div style={{ fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>✓ Key Generated</div>
            <div className="mono" style={{ fontSize: 12, wordBreak: 'break-all', background: '#0a0a18', padding: '6px 10px', borderRadius: 4, marginBottom: 8 }}>
              {newKey}
            </div>
            <div className="tooltip" style={{ marginBottom: 8 }}>⚠️ Copy this key now. It will not be shown again.</div>
            <button className="btn btn-sm btn-secondary" onClick={() => copyToClipboard(newKey)}>📋 Copy</button>
            <button className="btn btn-sm btn-secondary" style={{ marginLeft: 8 }} onClick={() => setNewKey(null)}>Dismiss</button>
          </div>
        )}
      </div>

      {/* Key list */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">All Keys</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Key</th>
                <th>Rate Limit</th>
                <th>Status</th>
                <th>Requests</th>
                <th>Last Used</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr><td colSpan={8}><div className="empty">No API keys yet</div></td></tr>
              ) : (
                keys.map(k => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: 600 }}>{k.label}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{k.api_key.slice(0, 8)}...{k.api_key.slice(-4)}</td>
                    <td className="mono">{k.rate_limit}/min</td>
                    <td>
                      <span className={`badge ${k.enabled ? 'badge-green' : 'badge-red'}`}>
                        {k.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="mono">{(k.request_count || 0).toLocaleString()}</td>
                    <td className="dimmed" style={{ fontSize: 12 }}>{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : '—'}</td>
                    <td className="dimmed" style={{ fontSize: 12 }}>{new Date(k.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => toggle(k.id, k.enabled)}>
                        {k.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn btn-sm btn-danger" style={{ marginLeft: 6 }} onClick={() => del(k.id)}>Del</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
