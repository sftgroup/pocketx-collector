import { useState, useEffect } from 'react';
import { Plus, UserCog, X } from 'lucide-react';
import { api } from '../lib';

interface AdminUser { id: string; username: string; email: string; role: string; enabled: boolean; last_login_at: string | null; created_at: string; }

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'operator' });
  const [msg, setMsg] = useState('');

  const load = async () => {
    try { const d = await api('/admin/users'); setUsers(d || []); } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.username || !form.password) return setMsg('Username and password required');
    try {
      await api('/admin/users', { method: 'POST', body: JSON.stringify(form) });
      setShowAdd(false); setForm({ username: '', email: '', password: '', role: 'operator' });
      setMsg('User created'); setTimeout(() => setMsg(''), 2500);
      load();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  };

  const toggleUser = async (id: string, enabled: boolean) => {
    await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !enabled }) });
    load();
  };

  const deleteUser = async (id: string, username: string) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    await api(`/admin/users/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) return <div className="loading"><span className="spin" />Loading...</div>;

  return (
    <div>
      <div className="flex-between mb-2">
        <h1 className="page-title">Users</h1>
        <div style={{display:'flex',gap:8}}>
          {msg && <span className="tooltip">{msg}</span>}
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={14} /> Add User
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="card">
          <div className="card-title">New User</div>
          <div className="form-row">
            <div style={{flex:2}}><label className="form-label">Username</label><input className="form-input" value={form.username} onChange={e => setForm({...form,username:e.target.value})} /></div>
            <div style={{flex:2}}><label className="form-label">Email</label><input className="form-input" value={form.email} onChange={e => setForm({...form,email:e.target.value})} /></div>
            <div style={{flex:1}}><label className="form-label">Password</label><input className="form-input" type="password" value={form.password} onChange={e => setForm({...form,password:e.target.value})} /></div>
            <div style={{flex:1}}><label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm({...form,role:e.target.value})}>
                <option value="operator">operator</option><option value="admin">admin</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={create}><Plus size={14} /> Create</button>
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}><X size={14} /></button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">All Users ({users.length})</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{fontWeight:600,display:'flex',alignItems:'center',gap:6}}><UserCog size={14} color="var(--dim)" />{u.username}</td>
                  <td>{u.email || '—'}</td>
                  <td><span className={`badge ${u.role==='admin'?'badge-purple':'badge-blue'}`}>{u.role}</span></td>
                  <td><span className={`badge ${u.enabled?'badge-green':'badge-red'}`}>{u.enabled?'Active':'Disabled'}</span></td>
                  <td className="mono">{u.last_login_at ? new Date(u.last_login_at).toISOString().slice(0,16) : '—'}</td>
                  <td className="mono">{new Date(u.created_at).toISOString().slice(0,16)}</td>
                  <td>
                    <button className="btn btn-secondary btn-xs" onClick={() => toggleUser(u.id, u.enabled)} style={{marginRight:4}}>{u.enabled?'Disable':'Enable'}</button>
                    <button className="btn btn-danger btn-xs" onClick={() => deleteUser(u.id, u.username)}><X size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
