import { useState, useEffect } from 'react';
import { Database, Key, Server } from 'lucide-react';
import { api } from '../lib';

export default function DataCenter() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { const d = await api('/admin/dc-subscriptions'); setSubs(d || []); } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="loading"><span className="spin"/> Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>📡 Data Center</h2>
        <span style={{ color: 'var(--dim)', fontSize: 13 }}>{subs.length} subscriptions</span>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        {subs.length === 0 ? <div className="empty">No Data Center subscriptions yet</div> : (
          <table>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Status</th>
                <th>Plan</th>
                <th>DC API Key</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.tenant_id}>
                  <td><strong>{s.name}</strong></td>
                  <td><span className={`badge ${s.status === 'active' ? 'green' : s.status === 'suspended' ? 'red' : 'yellow'}`}>{s.status}</span></td>
                  <td><span className="badge blue">{s.data_plan_id}</span></td>
                  <td className="mono" style={{ fontSize: 11 }}>{s.dc_api_key || 'N/A'}</td>
                  <td style={{ fontSize: 12, color: 'var(--dim)' }}>{s.dc_api_key_created_at ? new Date(s.dc_api_key_created_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
