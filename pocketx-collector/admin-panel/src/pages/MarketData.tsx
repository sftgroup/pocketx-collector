import { useEffect, useState } from 'react';
import { apiGet } from '../lib';

interface TokenData {
  chain: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  price_usd: number;
  volume_24h: number;
  market_cap: number;
  liquidity_usd: number;
  holder_count: number;
  price_change_24h: number;
  dex_name: string;
  collected_at: string;
}

const CHAINS = ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'base'];

export default function MarketData() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chain, setChain] = useState('');
  const [symbol, setSymbol] = useState('');
  const [okxHealth, setOkxHealth] = useState<any>(null);
  const [binanceHealth, setBinanceHealth] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (chain) params.set('chain', chain);
      if (symbol) params.set('symbol', symbol);
      params.set('limit', '100');
      const data = await apiGet(`/data/market/tokens?${params}`);
      setTokens((data as TokenData[]) || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadHealth = async () => {
    try {
      const [bh, okh] = await Promise.all([apiGet('/admin/binance-health'), apiGet('/admin/okx-health')]);
      setBinanceHealth(bh);
      setOkxHealth(okh);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadData(); loadHealth(); const t = setInterval(loadHealth, 30000); return () => clearInterval(t); }, []);

  const formatUsd = (n: number) => {
    if (!n && n !== 0) return <span className="dimmed">—</span>;
    const abs = Math.abs(n);
    let s: string;
    if (abs >= 1e9) s = `$${(n / 1e9).toFixed(2)}B`;
    else if (abs >= 1e6) s = `$${(n / 1e6).toFixed(2)}M`;
    else if (abs >= 1e3) s = `$${(n / 1e3).toFixed(2)}K`;
    else if (abs < 0.000001) s = `$${n.toExponential(2)}`;
    else if (abs < 0.01) s = `$${n.toFixed(6)}`;
    else s = `$${n.toFixed(4)}`;
    return <span className="mono">{s}</span>;
  };

  const formatChange = (n: number) => {
    if (!n && n !== 0) return <span className="dimmed">—</span>;
    const cls = n >= 0 ? 'green' : 'red';
    const sign = n >= 0 ? '+' : '';
    return <span className={cls} style={{ fontWeight: 600 }}>{sign}{n.toFixed(2)}%</span>;
  };

  const formatNum = (n: number) => {
    if (!n) return <span className="dimmed">—</span>;
    return <span className="mono">{n.toLocaleString()}</span>;
  };

  return (
    <div>
      <div className="page-title">Market Data</div>

      {/* Status Cards */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Collectors Status</span>
          <span className="tooltip">Auto-refresh 30s</span>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Binance</div>
            <div className="stat-value" style={{ fontSize: 18, color: binanceHealth?.running ? 'var(--green)' : 'var(--red)' }}>
              <span className={`pulse ${binanceHealth?.running ? 'green' : 'red'}`} />
              {binanceHealth?.running ? 'Healthy' : 'Stopped'}
            </div>
            <div className="stat-sub">{binanceHealth?.symbols || 0} symbols · {binanceHealth?.wsConnected ? 'WS' : 'REST'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">OKX ChainOS</div>
            <div className="stat-value" style={{ fontSize: 18, color: okxHealth?.active ? 'var(--green)' : 'var(--yellow)' }}>
              <span className={`pulse ${okxHealth?.active ? 'green' : 'yellow'}`} />
              {okxHealth?.active ? 'Healthy' : okxHealth?.running ? 'No API Key' : 'Stopped'}
            </div>
            <div className="stat-sub">{okxHealth?.accounts ?? 0} accounts · add key in OKX Accounts</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Block Scanner</div>
            <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>
              <span className="pulse green" />
              7 Chains
            </div>
            <div className="stat-sub">2.37M events collected</div>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Token Explorer</span>
        </div>
        <div className="form-row">
          <div className="form-group" style={{ minWidth: 140 }}>
            <label className="form-label">Chain</label>
            <select className="form-select" value={chain} onChange={e => setChain(e.target.value)}>
              <option value="">All Chains</option>
              {CHAINS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 140 }}>
            <label className="form-label">Symbol</label>
            <input className="form-input" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="e.g. USDT, ETH" />
          </div>
          <div className="form-group" style={{ flex: 'none', alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={loadData}>Search</button>
            <button className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={() => { setChain(''); setSymbol(''); }}>Reset</button>
          </div>
        </div>
      </div>

      {/* Token Table Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Tokens</span>
          <span className="tooltip">{tokens.length} results</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Chain</th>
                <th>Token</th>
                <th>Price</th>
                <th>24h</th>
                <th>Volume</th>
                <th>MCap</th>
                <th>Liquidity</th>
                <th>Holders</th>
                <th>DEX</th>
                <th>Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10}><div className="loading" style={{ padding: 40 }}><span className="spin" />Loading...</div></td></tr>
              ) : tokens.length === 0 ? (
                <tr><td colSpan={10}><div className="empty">No data yet. Add an OKX API key to start collecting.</div></td></tr>
              ) : (
                tokens.map((t, i) => (
                  <tr key={`${t.token_address}-${i}`}>
                    <td><span className="badge badge-blue">{t.chain}</span></td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#e5e7eb' }}>{t.token_symbol || 'Unknown'}</div>
                      <div className="tooltip">{t.token_name}</div>
                    </td>
                    <td>{formatUsd(t.price_usd)}</td>
                    <td>{formatChange(t.price_change_24h)}</td>
                    <td>{formatUsd(t.volume_24h)}</td>
                    <td>{formatUsd(t.market_cap)}</td>
                    <td>{formatUsd(t.liquidity_usd)}</td>
                    <td>{formatNum(t.holder_count)}</td>
                    <td style={{ fontSize: 12, color: 'var(--dim)' }}>{t.dex_name || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--dim)' }}>{new Date(t.collected_at).toLocaleString()}</td>
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
