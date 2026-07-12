import { useState, useEffect, useCallback } from 'react';
import { Search, Download } from 'lucide-react';
import { api } from '../lib';

interface EventRow {
  chain: string; block_number: number; event_type: string;
  from_address: string; to_address: string; amount: string; token_symbol: string;
  created_at: string;
}
interface EventsResult { data: EventRow[]; next_page_token: string | null; total: number; }

const CHAIN_NAMES: Record<string,string> = { sepolia:'Sepolia', ethereum:'Ethereum', polygon:'Polygon', arbitrum:'Arbitrum', optimism:'Optimism', bsc:'BSC', base:'Base' };

export default function Events() {
  const [result, setResult] = useState<EventsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [chain, setChain] = useState('');
  const [evType, setEvType] = useState('');
  const [addr, setAddr] = useState('');
  const [limit, setLimit] = useState(50);
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<EventsResult[]>([]);

  const search = useCallback(async (nextCursor?: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page_size: String(limit) });
      if (chain) params.set('chain', chain);
      if (evType) params.set('event_type', evType);
      if (addr.trim()) params.set('address', addr.trim());
      if (nextCursor) params.set('page_token', nextCursor);

      const d = await api(`/data/events?${params.toString()}`);
      setResult(d);
      setCursor(d.data.next_page_token);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [chain, evType, addr, limit]);

  useEffect(() => { search(); }, []);

  const next = () => { if (cursor) { setHistory(h => [...h, result!]); search(cursor); } };
  const prev = () => {
    if (history.length > 0) {
      const prevResult = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setResult(prevResult);
    }
  };

  const exportCSV = () => {
    if (!result?.data?.length) return;
    const rows = result.data.map(e => [e.chain, e.block_number, e.event_type, e.from_address, e.to_address, e.amount, e.token_symbol, e.created_at]);
    const csv = [['chain','block','event','from','to','amount','symbol','time'], ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pocketx-events.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex-between mb-2">
        <h1 className="page-title">Events</h1>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="form-row">
          <div style={{flex:'0 0 130px'}}>
            <label className="form-label">Chain</label>
            <select className="form-select" value={chain} onChange={e => setChain(e.target.value)}>
              <option value="">All</option>
              {Object.entries(CHAIN_NAMES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{flex:'0 0 130px'}}>
            <label className="form-label">Type</label>
            <select className="form-select" value={evType} onChange={e => setEvType(e.target.value)}>
              <option value="">All</option><option value="transfer">transfer</option>
            </select>
          </div>
          <div style={{flex:1}}>
            <label className="form-label">Address</label>
            <input className="form-input" value={addr} onChange={e => setAddr(e.target.value)} placeholder="0x..." />
          </div>
          <div style={{flex:'0 0 80px'}}>
            <label className="form-label">Limit</label>
            <select className="form-select" value={limit} onChange={e => setLimit(Number(e.target.value))}>
              <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={() => search()}><Search size={14} /> Search</button>
          <button className="btn btn-secondary" onClick={exportCSV}><Download size={14} /> CSV</button>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <div className="card-title">Results {result ? `(${result.data.length})` : ''}</div>
        {loading ? <div className="loading"><span className="spin" />Searching...</div> :
          !result?.data?.length ? <div className="empty">No events found</div> :
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Chain</th><th>Block</th><th>Type</th><th>From</th><th>To</th><th>Amount</th><th>Time</th></tr>
              </thead>
              <tbody>
                {result.data.map((e,i) => {
                  const f = e.from_address?.length > 14 ? e.from_address.slice(0,6)+'…'+e.from_address.slice(-4) : (e.from_address||'—');
                  const t = e.to_address?.length > 14 ? e.to_address.slice(0,6)+'…'+e.to_address.slice(-4) : (e.to_address||'—');
                  return (
                    <tr key={i}>
                      <td><span className="badge badge-purple">{e.chain}</span></td>
                      <td className="mono">{e.block_number?.toLocaleString()}</td>
                      <td>{e.event_type}</td>
                      <td className="mono" title={e.from_address}>{f}</td>
                      <td className="mono" title={e.to_address}>{t}</td>
                      <td className="mono">{Number(e.amount).toLocaleString(undefined,{maximumFractionDigits:6})} {e.token_symbol||''}</td>
                      <td style={{fontSize:11,color:'var(--dim)'}}>{e.created_at?.slice(11,19)||''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        }
        <div className="pagination">
          <button className="btn btn-secondary btn-sm" disabled={history.length === 0} onClick={prev}>← Prev</button>
          <span className="pagination-info">{cursor ? 'More results' : 'End'}</span>
          <button className="btn btn-secondary btn-sm" disabled={!cursor} onClick={() => next()}>Next →</button>
        </div>
      </div>
    </div>
  );
}
