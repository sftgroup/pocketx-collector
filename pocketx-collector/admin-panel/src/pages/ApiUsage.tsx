import { useState, useEffect } from 'react';
import { Activity, BarChart, Key } from 'lucide-react';
import { api } from '../lib';

export default function ApiUsage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/admin/api-usage').then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><span className="spin"/> Loading...</div>;
  if (!data) return <div className="empty">No data</div>;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>📡 API Usage</h2>

      <div className="card">
        <h3>Per Tenant (30d)</h3>
        <div style={{ overflow: 'auto', maxHeight: 400 }}>
          <table>
            <thead><tr><th>Tenant</th><th>Total Calls</th></tr></thead>
            <tbody>
              {data.byTenant?.map((t: any) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td style={{ fontWeight: 600 }}>{parseInt(t.total_calls).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Daily Calls (30d)</h3>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: 10, alignItems: 'flex-end' }}>
          {data.daily?.map((d: any) => (
            <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28 }}>
              <div style={{ width: 20, height: Math.max(2, Math.min(100, d.calls / 200)), background: 'var(--accent)', borderRadius: 2, opacity: 0.6 }}/>
              <div style={{ fontSize: 8, color: 'var(--dim)', marginTop: 2 }}>{d.date?.slice(8)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>API Keys</h3>
        <table>
          <thead><tr><th>Key Hash</th><th>Status</th><th>Last Used</th><th>Expires</th></tr></thead>
          <tbody>
            {data.apiKeys?.map((k: any, i: number) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: 12 }}>{k.key_hash?.slice(0, 16)}...</td>
                <td><span className={`badge ${k.enabled ? 'green' : 'red'}`}>{k.enabled ? 'active' : 'disabled'}</span></td>
                <td style={{ fontSize: 12, color: 'var(--dim)' }}>{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'never'}</td>
                <td style={{ fontSize: 12 }}>{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
