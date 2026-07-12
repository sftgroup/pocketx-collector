/**
 * FE-02: Multi-Chain Wallet Page — PocketX Dark Theme
 * Backend-driven: HD wallet tokens + chain balances + tx history
 * States: loading → empty → active → error
 * No hardcoded data — everything from backend API
 */

import { useEffect, useState, useMemo } from 'react';
import { Wallet, TrendingUp, Send, ArrowDownToLine, Coins, History } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { ChainSelector } from '@/components/ChainSelector';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { showToast } from '@/components/Toast';
import { PendingConfirmations } from '@/components/PendingConfirmations';
import { QRScanner } from '@/components/QRScanner';
import { shortenAddress, formatAmount, formatUsd } from '@/utils/format';
import { getChainInfo } from '@/utils/chain';
import { api } from '@/services/api';
import type { ChainId } from '@/types';
import { env } from '@/env';

/* ──────────────── Styles ──────────────── */

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

const actionBtnOuter: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer',
};

const actionBtnInner: React.CSSProperties = {
  width: 48, height: 48, borderRadius: 12, padding: '1.5px',
};

const actionBtnCore: React.CSSProperties = {
  width: '100%', height: '100%', borderRadius: 10,
  background: 'rgba(10,10,10,0.9)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.2s',
};

/* ──────────────── Types ──────────────── */

interface TokenBalance {
  assetId: string;
  symbol: string;
  name: string;
  chainId: number;
  balance: string;
  balanceFormatted: string;
  usdValue?: number;
}

interface WalletData {
  walletId: string;
  chainId: number;
  address: string;
  tokens: TokenBalance[];
}

interface TxRecord {
  id: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  status: string;
  createdAt: string;
  chainId: number;
}

/* ──────────────── Main Page ──────────────── */

export function WalletPage() {
  const { activeChainId } = useAuthStore();
  const chain = getChainInfo(activeChainId);

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      const rsp = await api.get(`/wallet/${activeChainId}`);
      setWallet(rsp.data as WalletData);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load wallet');
      setWallet(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWallet = async () => {
    setCreating(true);
    setError(null);
    try {
      await api.post('/wallet/create', { chain: activeChainId });
      showToast('success', 'Wallet created!');
      await loadWallet();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create wallet';
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => { loadWallet(); }, [activeChainId]);

  const totalUSD = useMemo(() =>
    (wallet?.tokens || []).reduce((s, t) => s + (t.usdValue || 0), 0),
  [wallet?.tokens]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>Wallet</h1>
          <p style={{ fontSize: 14, color: 'var(--dark-400)', marginTop: 4 }}>HD managed wallet — multi-chain</p>
        </div>
      </div>

      <ChainSelector />
      <ErrorDisplay error={error} onDismiss={() => { setError(null); loadWallet(); }} />

      {wallet && <PendingConfirmations onAction={loadWallet} />}

      {loading ? (
        <Loading message="Loading wallet..." />
      ) : !wallet ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 16 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Wallet size={40} color="white" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>Create Your Wallet</h2>
          <p style={{ color: 'var(--dark-400)', maxWidth: 400, textAlign: 'center' }}>
            No wallet found for {chain.name}. Create one to start receiving assets.
          </p>
          <button
            onClick={handleCreateWallet}
            disabled={creating}
            className="btn-primary-dark"
            style={{ padding: '12px 28px', fontSize: 15, fontWeight: 600 }}
          >
            {creating ? 'Creating...' : `🔑 Create ${chain.symbol} Wallet`}
          </button>
        </div>
      ) : (
        <>
          {/* Balance Hero Card */}
          <div className="gradient-border" style={{ padding: 24 }}>
            <div style={{ position: 'relative', zIndex: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--dark-400)', fontWeight: 500, marginBottom: 8 }}>Total Balance</p>
              <h2 style={{ fontSize: 36, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>{formatUsd(totalUSD)}</h2>
              <p style={{ fontSize: 14, color: 'var(--dark-400)', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                {shortenAddress(wallet.address, 8)}
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                {[
                  { label: 'Send',   icon: Send,            color: 'linear-gradient(135deg, var(--accent), var(--accent-purple))', onClick: () => setShowSend(true) },
                  { label: 'Receive',icon: ArrowDownToLine,  color: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))',  onClick: () => setShowReceive(true) },
                  { label: 'Swap',   icon: Coins,            color: 'linear-gradient(135deg, var(--accent-orange), #fbbf24)',         onClick: () => setShowSwap(true) },
                  { label: 'History',icon: History,           color: 'linear-gradient(135deg, var(--accent-green), #34d399)',          onClick: () => setShowHistory(true) },
                ].map(a => {
                  const Icon = a.icon;
                  return (
                    <button key={a.label} onClick={a.onClick} style={actionBtnOuter}>
                      <div style={{ ...actionBtnInner, background: a.color }}>
                        <div style={actionBtnCore}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(20,20,20,0.9)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(10,10,10,0.9)'; }}
                        ><Icon size={20} color="white" /></div>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--dark-400)' }}>{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { label: 'Network',   value: chain.name,       sub: String(wallet.chainId) },
              { label: 'Tokens',    value: String(wallet.tokens.length), sub: 'Assets held' },
              { label: 'Address',   value: shortenAddress(wallet.address, 6), sub: 'HD (BIP44)' },
              { label: 'Gas',       value: 'Sponsored',      sub: 'No native tokens needed' },
            ].map(s => (
              <div key={s.label} style={{ ...cardStyle, padding: 16 }}>
                <p style={{ fontSize: 11, color: 'var(--dark-400)', marginBottom: 4 }}>{s.label}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{s.value}</p>
                <p style={{ fontSize: 11, color: 'var(--dark-400)', marginTop: 2 }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Token List */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 12 }}>Tokens</h3>
            {wallet.tokens.length === 0 ? (
              <EmptyState icon="💰" title="No tokens yet" description="Deposit tokens to get started" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {wallet.tokens.map(t => (
                  <div key={t.assetId} style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--dark-600), var(--dark-700))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color: 'white',
                    }}>{t.symbol.slice(0, 2)}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{t.symbol}</p>
                      <p style={{ fontSize: 12, color: 'var(--dark-400)' }}>{t.name}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{t.balanceFormatted}</p>
                      {t.usdValue !== undefined && <p style={{ fontSize: 12, color: 'var(--dark-400)' }}>{formatUsd(t.usdValue)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modals ── */}
      <ReceiveModal open={showReceive} onClose={() => setShowReceive(false)} address={wallet?.address || ''} chain={chain || { id: 'sepolia', name: 'Sepolia', symbol: 'ETH' }} />
      <SendModal  open={showSend}    onClose={() => setShowSend(false)}    wallet={wallet} onSent={loadWallet} />      
      <SwapModal  open={showSwap}    onClose={() => setShowSwap(false)}    chainId={activeChainId} tokens={wallet?.tokens || []} />
      <HistoryModal open={showHistory} onClose={() => setShowHistory(false)} chainId={activeChainId} />
    </div>
  );
}

/* ──────────────── Receive Modal ──────────────── */

import { QRCodeSVG } from 'qrcode.react';

function ReceiveModal({ open, onClose, address, chain }: { open: boolean; onClose: () => void; address: string; chain: any }) {
  const [customAmount, setCustomAmount] = useState('');
  const [showQr, setShowQr] = useState(false);

  // EIP-681: ethereum:<address>[?value=<amount>]
  const qrValue = customAmount
    ? `ethereum:${address}?value=${customAmount}`
    : address;

  const inputS: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'white',
    fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif',
  };

  return (
    <Modal open={open} onClose={onClose} title="Receive">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--dark-300)' }}>Send {chain.name} ({chain.symbol}) tokens to</p>

        {/* QR Code */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          padding: 20, background: 'white', borderRadius: 16,
        }}>
          <QRCodeSVG
            value={qrValue}
            size={180}
            level="M"
            includeMargin
            bgColor="#ffffff"
            fgColor="#000000"
          />
          <span style={{ fontSize: 11, color: '#666' }}>Scan with any wallet app</span>
        </div>

        {/* Amount input for QR */}
        <div>
          <span style={{ fontSize: 12, color: 'var(--dark-400)', display: 'block', marginBottom: 6 }}>
            Request Amount (optional)
          </span>
          <input style={inputS} type="number" step="any" placeholder={`0.00 ${chain.symbol}`}
            value={customAmount} onChange={e => setCustomAmount(e.target.value)} />
        </div>

        {/* Address */}
        <div style={{ padding: 14, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', wordBreak: 'break-all' }}>
          <p style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--dark-200)' }}>{address || 'Loading...'}</p>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(address); showToast('success', 'Address copied'); }}
          className="btn-primary-dark" style={{ width: '100%' }}>📋 Copy Address</button>
      </div>
    </Modal>
  );
}

/* ──────────────── Send Modal ──────────────── */

function SendModal({ open, onClose, wallet, onSent }: {
  open: boolean; onClose: () => void; wallet: WalletData | null; onSent: () => void;
}) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [assetId, setAssetId] = useState(wallet?.tokens?.[0]?.assetId || 'native');
  const [payPassword, setPayPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!wallet) return null;

  const tokens = wallet?.tokens || [];
  const selected = tokens.find(t => t.assetId === assetId);
  const maxAmount = selected?.balanceFormatted || '0';
  const chainId = wallet?.chainId;
  const chain = getChainInfo(String(chainId) as ChainId) || { id: 'sepolia', name: 'Sepolia', symbol: 'ETH' };

  const handleSend = async () => {
    setError(null);
    if (!to || !amount) { setError('Fill in all fields'); return; }
    if (!payPassword) { setError('Payment password required'); return; }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) { setError('Invalid amount'); return; }
    if (!wallet?.walletId) { setError('No wallet id'); return; }
    setSending(true);
    try {
      const res = await api.post('/tx/send', {
        walletId: wallet.walletId,
        toAddress: to,
        amount: amountNum.toString(),
        chain: String(chainId),
        paymentPassword: payPassword,
        tokenAddress: assetId === 'native' ? undefined : assetId,
      });
      const d = res.data as any;
      if (d.strategy === 'auto') {
        showToast('success', `Transaction sent! ⚡ Auto-signed`);
      } else if (d.strategy === 'confirm') {
        showToast('success', `Transaction created — awaiting confirmation`);
      } else if (d.strategy === 'approval') {
        showToast('success', `Transaction created — multi-sig approval required`);
      } else {
        showToast('success', 'Transaction sent!');
      }
      onSent();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Send failed');
    } finally { setSending(false); }
  };

  const inputS: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'white', fontSize: 14,
    outline: 'none', fontFamily: 'Inter, sans-serif',
  };
  const labelS: React.CSSProperties = { fontSize: 12, color: 'var(--dark-400)', fontWeight: 500, display: 'block', marginBottom: 6 };

  return (
    <Modal open={open} onClose={onClose} title="Send">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ErrorDisplay error={error} onDismiss={() => setError(null)} />
        {/* QR Scanner */}
        {showScanner && <QRScanner
          onScan={(r) => { setTo(r.address); if (r.amount) setAmount(r.amount); }}
          onClose={() => setShowScanner(false)}
        />}
        <div>
          <span style={labelS}>To Address</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inputS, flex: 1 }} placeholder={`${chain.id} address`} value={to} onChange={e => setTo(e.target.value)} />
            <button onClick={() => setShowScanner(true)}
              style={{
                padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white',
                border: 'none', fontSize: 18, display: 'flex', alignItems: 'center', gap: 6,
              }}>
              📷
            </button>
          </div>
        </div>
        <div>
          <span style={labelS}>Token</span>
          <select style={inputS} value={assetId} onChange={e => setAssetId(e.target.value)}>
            {tokens.map(t => <option key={t.assetId} value={t.assetId}>{t.symbol} — {t.balanceFormatted}</option>)}
          </select>
        </div>
        <div>
          <span style={labelS}>Amount</span>
          <div style={{ position: 'relative' }}>
            <input style={{ ...inputS, paddingRight: 60 }} type="number" step="any" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            <button onClick={() => setAmount(maxAmount)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: '4px 8px', fontSize: 11, fontWeight: 500, background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', borderRadius: 8, cursor: 'pointer' }}>MAX</button>
          </div>
        </div>
        <button onClick={handleSend} disabled={sending || !to || !amount || !payPassword} className="btn-primary-dark" style={{ width: '100%' }}>
          {sending ? 'Sending...' : `💸 Send ${selected?.symbol || 'ETH'}`}
        </button>
        <p style={{ fontSize: 11, color: 'var(--dark-500)', textAlign: 'center' }}>⚡ Gas sponsored by PocketX — no native tokens needed</p>
        <div><span style={labelS}>Payment Password (6 digits)</span><input style={inputS} type="password" maxLength={6} placeholder="888888" value={payPassword} onChange={e => setPayPassword(e.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
      </div>
    </Modal>
  );
}

/* ──────────────── Swap Modal ──────────────── */

function SwapModal({ open, onClose, chainId, tokens }: { open: boolean; onClose: () => void; chainId: ChainId; tokens: TokenBalance[] }) {
  const [fromAsset, setFromAsset] = useState(tokens[0]?.assetId || 'native');
  const [toAsset, setToAsset] = useState(tokens[1]?.assetId || tokens[0]?.assetId || 'native');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<{ outAmount: string; rate: string } | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputS: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'white', fontSize: 14,
    outline: 'none', fontFamily: 'Inter, sans-serif',
  };

  const getQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    try {
      const rsp = await api.post('/swap/quote', { chainId: Number(chainId), fromAsset, toAsset, amount });
      setQuote(rsp.data as any);
    } catch { /* quote may not be available */ }
  };

  const handleSwap = async () => {
    setError(null);
    if (!quote || !amount) { setError('Get a quote first'); return; }
    setSwapping(true);
    try {
      await api.post('/swap/execute', { chainId: Number(chainId), fromAsset, toAsset, amount });
      showToast('success', 'Swap executed');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Swap failed');
    } finally { setSwapping(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Swap">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ErrorDisplay error={error} onDismiss={() => setError(null)} />
        <div><span style={{ fontSize: 12, color: 'var(--dark-400)', display: 'block', marginBottom: 6 }}>From</span>
          <select style={inputS} value={fromAsset} onChange={e => setFromAsset(e.target.value)}>
            {tokens.map(t => <option key={t.assetId} value={t.assetId}>{t.symbol}</option>)}
          </select>
        </div>
        <div><span style={{ fontSize: 12, color: 'var(--dark-400)', display: 'block', marginBottom: 6 }}>Amount</span>
          <input style={inputS} type="number" step="any" placeholder="0.00" value={amount} onChange={e => { setAmount(e.target.value); setQuote(null); }} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 20 }}>⬇️</div>
        <div><span style={{ fontSize: 12, color: 'var(--dark-400)', display: 'block', marginBottom: 6 }}>To</span>
          <select style={inputS} value={toAsset} onChange={e => setToAsset(e.target.value)}>
            {tokens.map(t => <option key={t.assetId} value={t.assetId}>{t.symbol}</option>)}
          </select>
        </div>
        <button onClick={getQuote} disabled={!amount} style={{ padding: 10, background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 600 }}>
          Get Quote
        </button>
        {quote && (
          <div style={{ padding: 12, background: 'rgba(34,197,94,0.1)', borderRadius: 12, border: '1px solid rgba(34,197,94,0.2)' }}>
            <p style={{ fontSize: 14, color: '#34d399', fontWeight: 600 }}>{quote.outAmount} {tokens.find(t=>t.assetId===toAsset)?.symbol}</p>
            <p style={{ fontSize: 12, color: 'var(--dark-400)' }}>Rate: 1 ≈ {quote.rate}</p>
          </div>
        )}
        <button onClick={handleSwap} disabled={swapping || !quote} className="btn-primary-dark" style={{ width: '100%' }}>
          {swapping ? 'Swapping...' : '🔄 Swap'}
        </button>
      </div>
    </Modal>
  );
}

/* ──────────────── History Modal ──────────────── */

function HistoryModal({ open, onClose, chainId }: { open: boolean; onClose: () => void; chainId: ChainId }) {
  const [txs, setTxs] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get(`/wallet/transactions?page=1&limit=50`)
      .then(rsp => setTxs((rsp.data as any)?.items || rsp.data || []))
      .catch(() => setTxs([]))
      .finally(() => setLoading(false));
  }, [open, chainId]);

  const statusColor = (s: string) => s === 'confirmed' ? 'var(--accent-green)' : s === 'pending' ? 'var(--accent-orange)' : 'var(--accent-red)';

  return (
    <Modal open={open} onClose={onClose} title="Transaction History">
      {loading ? <Loading message="Loading history..." /> : txs.length === 0 ? (
        <p style={{ color: 'var(--dark-400)', textAlign: 'center', padding: 24 }}>No transactions yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {txs.map(tx => (
            <div key={tx.id} style={{ ...cardStyle, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--dark-400)' }}>
                    From: {shortenAddress(tx.from, 6)} → To: {shortenAddress(tx.to, 6)}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--dark-400)', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
                    {shortenAddress(tx.hash, 8)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{formatAmount(tx.value)}</p>
                  <p style={{ fontSize: 11, color: statusColor(tx.status), fontWeight: 500 }}>{tx.status}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
