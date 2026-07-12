/**
 * FE-06: Admin Asset Dashboard — PocketX Dark Theme
 * Charts: Chart.js (line chart for volume, pie chart for chains)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/services/api';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { Badge } from '@/components/Badge';
import { showToast } from '@/components/Toast';
import { formatUsd, formatAmount } from '@/utils/format';
import type { DashboardStats } from '@/types';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, flowRes, activeRes] = await Promise.all([
        api.getDashboardStats(),
        api.get('/dashboard/daily-flow?days=14'),
        api.get('/dashboard/active-users'),
      ]);

      const s = summaryRes.data as any;
      const flow = (flowRes.data as any)?.flow || [];
      const active = (activeRes.data as any)?.last24h || 0;

      // Adapt backend response to frontend expected shape
      const stats: DashboardStats = {
        totalAssets: {},
        dailyVolume: s.todayDeposits || 0,
        dailyTransactions: (s.transactionStats || []).reduce((sum: number, tx: any) => sum + tx.cnt, 0),
        activeUsers: active,
        totalUsers: s.totalUsers || 0,
        assetsOverTime: flow.map((f: any) => ({
          date: f.date,
          volume: f.volume || 0,
        })),
      };

      setStats(stats);
    } catch (err: any) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleExport = async () => {
    setExporting(true);
    try { await api.exportCsv({}); showToast('success', 'Export ready'); }
    catch (err: any) { showToast('error', 'Export failed', err.message); }
    finally { setExporting(false); }
  };

  if (loading) return <Loading message="Loading dashboard..." fullScreen />;
  if (error) return <ErrorDisplay error={error} onRetry={fetchStats} />;
  if (!stats) return <EmptyState icon="📊" title="No data" action={{ label: 'Refresh', onClick: fetchStats }} />;

  // Chart.js dark theme options
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { ticks: { color: '#71717a', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#71717a', font: { size: 10 }, callback: (v: any) => `$${v.toLocaleString()}` }, grid: { color: 'rgba(255,255,255,0.04)' } },
    },
    plugins: {
      legend: { labels: { color: '#a1a1aa', font: { size: 11 } } },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.9)',
        titleColor: '#fff', bodyColor: '#a1a1aa',
        callbacks: { label: (ctx: any) => ` $${ctx.parsed.y?.toLocaleString() || ctx.parsed?.toLocaleString()}` },
      },
    },
  }), []);

  const pieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#a1a1aa', font: { size: 11 } } } },
  }), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>Admin Dashboard</h1>
          <p style={{ fontSize: 14, color: 'var(--dark-400)', marginTop: 4 }}>Overview of platform assets and activity</p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="btn-secondary-dark">
          {exporting ? 'Exporting...' : '📥 Export CSV'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatCard icon="💰" label="Total Assets" value={formatUsd(
          Object.values(stats.totalAssets || {}).reduce((s: number, a: any) => s + (a.usdValue || 0), 0)
        )} sub={`${Object.keys(stats.totalAssets || {}).length} chains`} />
        <StatCard icon="💸" label="Daily Volume" value={formatUsd(stats.dailyVolume || 0)} sub={`${stats.dailyTransactions || 0} txns`} />
        <StatCard icon="👥" label="Active Users" value={String(stats.activeUsers || 0)} sub={`${stats.totalUsers || 0} total`} />
        <StatCard icon="📈" label="Avg per User" value={formatUsd(
          stats.totalUsers ? Object.values(stats.totalAssets || {}).reduce((s: number, a: any) => s + (a.usdValue || 0), 0) / stats.totalUsers : 0
        )} sub="Lifetime" />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
        {/* Line Chart — Daily Volume */}
        <div style={{ ...cardStyle, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 16 }}>Daily Volume (14 days)</h3>
          {!stats.assetsOverTime?.length ? (
            <EmptyState icon="📈" title="No data" />
          ) : (
            <Line data={{
              labels: (stats.assetsOverTime || []).slice(-14).map(d => d.date),
              datasets: [{
                label: 'Volume (USD)',
                data: (stats.assetsOverTime || []).slice(-14).map(d => d.volume || d.totalUsd || 0),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99,102,241,0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#6366f1',
              }],
            }} options={chartOptions} />
          )}
        </div>

        {/* Pie Chart — Chains */}
        <div style={{ ...cardStyle, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 16 }}>Assets by Chain</h3>
          {Object.keys(stats.totalAssets || {}).length === 0 ? (
            <EmptyState icon="🔗" title="No chain data" />
          ) : (
            <Pie data={{
              labels: (Object.entries(stats.totalAssets || {})).map(([name]) => name.toUpperCase()),
              datasets: [{
                data: Object.values(stats.totalAssets || {}).reduce((acc: number[], v: any) => {
                  const total = Array.isArray(v) ? v.reduce((s: number, a: any) => s + (a.usdValue || 0), 0) : (v.usdValue || 0);
                  acc.push(total); return acc;
                }, [] as number[]),
                backgroundColor: ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'],
                borderColor: 'rgba(0,0,0,0.8)',
                borderWidth: 2,
              }],
            }} options={{ ...pieOptions, plugins: { legend: { labels: { color: '#a1a1aa', font: { size: 11 } } } } }} />
          )}
        </div>
      </div>

      {/* Chain breakdown detail */}
      <div style={{ ...cardStyle, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 16 }}>Chain Detail</h3>
        {Object.keys(stats.totalAssets || {}).length === 0 ? (
          <EmptyState icon="🔗" title="No chain data" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(stats.totalAssets || {}).map(([chainId, assets]: [string, any]) => (
              <div key={chainId}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Badge variant="info">{chainId.toUpperCase()}</Badge>
                  <span style={{ fontSize: 11, color: 'var(--dark-400)' }}>{Array.isArray(assets) ? assets.length : 1} assets</span>
                </div>
                {Array.isArray(assets) && assets.map((asset: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--dark-200)' }}>{asset.token}</span>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{formatAmount(asset.amount)}</p>
                      <p style={{ fontSize: 11, color: 'var(--dark-400)' }}>{formatUsd(asset.usdValue || 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assets Over Time (detail list) */}
      <div style={{ ...cardStyle, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 16 }}>Assets Over Time (details)</h3>
        {!stats.assetsOverTime?.length ? (
          <EmptyState icon="📈" title="No historical data" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {stats.assetsOverTime.slice(-14).map((snap, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: 11, color: 'var(--dark-400)', width: 72 }}>{snap.date}</span>
                <div style={{ flex: 1, margin: '0 12px' }}>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: 'linear-gradient(to right, var(--accent), var(--accent-purple))',
                      width: `${Math.min(100, (snap.totalUsd / Math.max(...stats.assetsOverTime.map((s) => s.totalUsd))) * 100)}%`,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--dark-200)', width: 80, textAlign: 'right' }}>{formatUsd(snap.totalUsd)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div style={{ ...cardStyle, padding: 16, transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--dark-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>{value}</p>
      <p style={{ fontSize: 11, color: 'var(--dark-500)', marginTop: 4 }}>{sub}</p>
    </div>
  );
}
