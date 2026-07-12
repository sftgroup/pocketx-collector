/**
 * Transaction history page — PocketX Dark Theme
 */

import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, ExternalLink } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { ChainSelector } from '@/components/ChainSelector';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { showToast } from '@/components/Toast';
import { shortenAddress, formatAmount } from '@/utils/format';
import { api } from '@/services/api';

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

export function TransactionsPage() {
  const { walletMode, session } = useAuthStore();
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/wallet/transactions?page=1&limit=50')
      .then(rsp => setTxs((rsp.data as any)?.items || []))
      .catch(() => setTxs([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCopyTx = (hash: string) => {
    navigator.clipboard.writeText(hash);
    showToast('success', 'Tx hash copied');
  };

  const explorerUrl = (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>Transactions</h1>
        <p style={{ fontSize: 14, color: 'var(--dark-400)', marginTop: 4 }}>History of all your transactions</p>
      </div>

      <ChainSelector />

      {loading ? <Loading message="Loading transactions..." /> :
       txs.length === 0 ? <EmptyState icon="📋" title="No transactions yet" description="Your transaction history will appear here" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {txs.map((tx: any, i: number) => (
            <div key={tx.hash || i} style={{ ...cardStyle, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {tx.type === 'receive' ? <ArrowDownLeft size={20} color="#34d399" /> : <ArrowUpRight size={20} color="#f87171" />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'white' }}>{tx.type || 'Transfer'}</p>
                  <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--dark-400)' }}>
                    {tx.from_address ? `${shortenAddress(tx.from_address, 6)} → ${shortenAddress(tx.to_address, 6)}` : shortenAddress(tx.hash, 10)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: tx.type === 'receive' ? '#34d399' : 'white' }}>{formatAmount(tx.amount || tx.value || '0')}</p>
                  <p style={{ fontSize: 11, color: 'var(--dark-400)' }}>{tx.status || 'confirmed'}</p>
                </div>
                <button onClick={() => handleCopyTx(tx.hash)} style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none' }}>Copy</button>
                <a href={explorerUrl(tx.hash)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--dark-400)' }}><ExternalLink size={14} /></a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
