/**
 * Custodial Wallet Page — PocketX Dark Theme
 * Centralized custody: wallet created/managed by platform
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { ChainSelector } from '@/components/ChainSelector';
import { Loading } from '@/components/Loading';
import { showToast } from '@/components/Toast';
import { shortenAddress } from '@/utils/format';
import { api } from '@/services/api';

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

export function CustodialWalletPage() {
  const { session, activeChainId } = useAuthStore();
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadWallet();
  }, [activeChainId]);

  const loadWallet = async () => {
    setLoading(true);
    try {
      const rsp = await api.get(`/wallet/${activeChainId}`);
      if ((rsp.data as any)?.code === 0) {
        setWallet((rsp.data as any).data);
      }
    } catch {
      setWallet(null);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const rsp = await api.post('/wallet/create', { chain: activeChainId });
      if ((rsp.data as any)?.code === 0) {
        showToast('success', 'Custodial wallet created');
        await loadWallet();
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create wallet');
    }
    setCreating(false);
  };

  if (loading) return <Loading message="Loading custodial wallet..." />;

  if (!wallet) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 40 }}>
        <span style={{ fontSize: 56 }}>☁️</span>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>Custodial Wallet</h1>
        <p style={{ fontSize: 14, color: 'var(--dark-400)', textAlign: 'center', maxWidth: 400 }}>
          No custodial wallet found for {activeChainId}. Create one — your private key is encrypted and stored securely.
        </p>
        <ChainSelector />
        <button onClick={handleCreate} disabled={creating} className="btn-primary-dark" style={{ padding: '12px 28px' }}>
          {creating ? 'Creating...' : '☁️ Create Custodial Wallet'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>Custodial Wallet</h1>
        <p style={{ fontSize: 14, color: 'var(--dark-400)', marginTop: 4 }}>Platform-managed custody — secure &amp; gas-sponsored</p>
      </div>

      <ChainSelector />

      <div style={{ ...cardStyle, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 13, color: 'var(--dark-400)' }}>Balance</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: 'white' }}>0.00 {activeChainId === 'solana' ? 'SOL' : 'ETH'}</p>
          </div>
          <span style={{ fontSize: 40 }}>☁️</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary-dark" style={{ flex: 1, padding: '12px' }}>📤 Send</button>
          <button className="btn-secondary-dark" style={{ flex: 1, padding: '12px' }}>📥 Receive</button>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 20 }}>
        <p style={{ fontSize: 13, color: 'var(--dark-400)', marginBottom: 8 }}>Address</p>
        <p style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: 'white', wordBreak: 'break-all' }}>
          {wallet.address ? shortenAddress(wallet.address, 16) : 'N/A'}
        </p>
      </div>
    </div>
  );
}
