import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib';

interface OkxAccount {
  id: number;
  label: string;
  enabled: boolean;
  is_default: boolean;
  has_api_key: boolean;
  last_used_at: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function OkxAccounts() {
  const [accounts, setAccounts] = useState<OkxAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ label: '', api_key: '', api_secret: '', api_passphrase: '', is_default: false });
  const [health, setHealth] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accts, h] = await Promise.all([
        apiGet('/admin/okx-accounts'),
        apiGet('/admin/okx-health'),
      ]);
      setAccounts((accts as OkxAccount[]) || []);
      setHealth(h);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.label) { setMsg('Label is required'); return; }
    if (!editId && (!form.api_key || !form.api_secret || !form.api_passphrase)) {
      setMsg('API Key, Secret, and Passphrase are required');
      return;
    }
    try {
      const body: any = { label: form.label, is_default: form.is_default };
      if (form.api_key) body.api_key = form.api_key;
      if (form.api_secret) body.api_secret = form.api_secret;
      if (form.api_passphrase) body.api_passphrase = form.api_passphrase;

      if (editId) {
        await apiPut(`/admin/okx-accounts/${editId}`, body);
      } else {
        await apiPost('/admin/okx-accounts', body);
      }
      setShowForm(false); setEditId(null);
      setForm({ label: '', api_key: '', api_secret: '', api_passphrase: '', is_default: false });
      load();
      setMsg('');
    } catch (e: any) { setMsg(e?.message || 'Failed'); }
  };

  const handleDelete = async (id: number) => {
    await apiDelete(`/admin/okx-accounts/${id}`);
    load();
  };

  const handleEdit = (a: OkxAccount) => {
    setEditId(a.id);
    setForm({ label: a.label, api_key: '', api_secret: '', api_passphrase: '', is_default: a.is_default });
    setShowForm(true);
  };

  return (
    <div>
      <div className="page-title">OKX Accounts</div>

      {/* Health Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Collector Status</span>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Accounts</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{health?.accounts ?? '—'}</div>
            <div className="stat-sub">Configured</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Collector</div>
            <div className="stat-value" style={{ fontSize: 20, color: health?.running ? 'var(--green)' : 'var(--red)' }}>
              <span className={`pulse ${health?.running ? 'green' : 'red'}`} />
              {health?.running ? 'Running' : 'Stopped'}
            </div>
            <div className="stat-sub">Interval: {health ? Math.round(health.snapshotIntervalMs / 1000) + 's' : '—'}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex-between mb-2">
        <div>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm({ label: '', api_key: '', api_secret: '', api_passphrase: '', is_default: false }); }}>
            + Add Account
          </button>
          <button className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={load}>Refresh</button>
        </div>
        <span className="tooltip">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
      </div>

      {msg && (
        <div className="card" style={{ borderColor: 'var(--red)', padding: '10px 16px', marginBottom: 12, color: 'var(--red)', fontSize: 13 }}>
          {msg}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">{editId ? 'Edit Account' : 'New OKX Account'}</span>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ minWidth: 160 }}>
              <label className="form-label">Label *</label>
              <input className="form-input" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="My Account" />
            </div>
            <div className="form-group" style={{ minWidth: 200 }}>
              <label className="form-label">API Key {!editId && '*'}</label>
              <input className="form-input" value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} placeholder={editId ? 'Leave blank to keep' : 'okx-api-key'} />
            </div>
            <div className="form-group" style={{ minWidth: 200 }}>
              <label className="form-label">API Secret {!editId && '*'}</label>
              <input className="form-input" type="password" value={form.api_secret} onChange={e => setForm({ ...form, api_secret: e.target.value })} placeholder={editId ? 'Leave blank to keep' : '···'} />
            </div>
            <div className="form-group" style={{ minWidth: 160 }}>
              <label className="form-label">Passphrase {!editId && '*'}</label>
              <input className="form-input" type="password" value={form.api_passphrase} onChange={e => setForm({ ...form, api_passphrase: e.target.value })} placeholder={editId ? 'Leave blank to keep' : '···'} />
            </div>
          </div>
          <div className="form-group mt-2">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} />
              Set as default account
            </label>
          </div>
          <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-primary" onClick={handleSubmit}>{editId ? 'Update' : 'Add Account'}</button>
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setMsg(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Accounts Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>API Key</th>
                <th>Default</th>
                <th>Status</th>
                <th>Last Used</th>
                <th>Created</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="loading" style={{ padding: 40 }}><span className="spin" />Loading...</div></td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={7}><div className="empty">No accounts. Add an OKX API key to start collecting token data.</div></td></tr>
              ) : (
                accounts.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600, color: '#e5e7eb' }}>{a.label}</td>
                    <td className="tooltip">{a.has_api_key ? '●●●●●●●●' : '—'}</td>
                    <td>{a.is_default ? <span className="badge badge-green">Default</span> : '—'}</td>
                    <td>
                      <span className={`badge ${a.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                        {a.status}
                      </span>
                      {a.error_message && <div className="tooltip" style={{ color: 'var(--red)' }}>{a.error_message}</div>}
                    </td>
                    <td className="tooltip">{a.last_used_at ? new Date(a.last_used_at).toLocaleString() : '—'}</td>
                    <td className="tooltip">{new Date(a.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(a)}>Edit</button>
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
