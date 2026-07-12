/**
 * FE-08: Safe Multi-Sig UI — PocketX Dark Theme
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { ChainSelector } from '@/components/ChainSelector';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { showToast } from '@/components/Toast';
import { api } from '@/services/api';
import { shortenAddress, formatAmount, formatDate } from '@/utils/format';
import { isValidAddress } from '@/utils/validation';
import { getChainInfo } from '@/utils/chain';
import { env } from '@/env';
import type { ChainId, SafeWallet, SafeTransactionEntry } from '@/types';

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12, color: 'white', fontSize: 14, outline: 'none',
};

export function SafeWalletPage() {
  const { activeChainId } = useAuthStore();
  const { safeWallets, setSafeWallet, removeSafeWallet } = useWalletStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const [transactions, setTransactions] = useState<SafeTransactionEntry[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(false);
  const [loadedSafes, setLoadedSafes] = useState<SafeWallet[]>([]);

  // Load existing safes from backend
  useEffect(() => {
    api.getSafeList()
      .then((res) => {
        const items = (res.data as any)?.items || [];
        setLoadedSafes(items);
      })
      .catch(() => {});
  }, [activeChainId]);

  const allSafes = (safeWallets.length > 0 ? safeWallets : loadedSafes).map((s: any) => ({
    ...s,
    chainId: s.chainId || (String(s.chain_id) === '11155111' ? 'sepolia' : (s.chainId || s.chain_id)),
    safeAddress: s.safeAddress || s.safe_address,
    threshold: s.threshold ?? s.threshold,
    owners: s.owners || [],
  }));
  const currentSafe = allSafes.find((w: any) => w.chainId === activeChainId);
  const hasSafe = !!currentSafe;

  const handleSafeCreated = (safe: SafeWallet) => {
    setSafeWallet(safe);
    setShowCreateModal(false);
  };

  // Load transactions for current safe
  useEffect(() => {
    if (!currentSafe?.safeAddress) return;
    setTxnsLoading(true);
    api.getSafeTransactions(currentSafe.safeAddress)
      .then((res) => {
        const data = res.data as any;
        const items = data?.transactions || data?.items || [];
        setTransactions(items as SafeTransactionEntry[]);
      })
      .catch(() => setTransactions([]))
      .finally(() => setTxnsLoading(false));
  }, [currentSafe?.safeAddress || currentSafe?.safe_address]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>Safe Multi-Sig</h1>
          <p style={{ fontSize: 14, color: 'var(--dark-400)', marginTop: 4 }}>Multi-signature wallet for team governance</p>
        </div>
      </div>

      <ChainSelector />

      {!hasSafe ? (
        <div style={{ ...cardStyle, padding: 40, textAlign: 'center' }}>
          <span style={{ fontSize: 56, display: 'block', marginBottom: 16 }}>🏛️</span>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 8 }}>No Safe Created Yet</h2>
          <p style={{ fontSize: 14, color: 'var(--dark-400)', marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
            Create a Safe multi-signature wallet to enable team-based transaction approval.
          </p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary-dark" style={{ margin: '0 auto' }}>
            Create Safe
          </button>
          {allSafes.length > 0 && (
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 12, textAlign: 'left' }}>Your Safes</h3>
              {allSafes.map((safe) => (
                <div key={safe.safeAddress} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 8,
                }}>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--dark-200)' }}>{shortenAddress(safe.safeAddress)}</p>
                    <p style={{ fontSize: 11, color: 'var(--dark-400)' }}>{getChainInfo(String(safe.chainId) as ChainId)?.name || safe.chainId}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge variant="info">{safe.threshold}/{safe.owners.length}</Badge>
                    <button onClick={() => useAuthStore.getState().setActiveChainId(safe.chainId)} style={{ fontSize: 12, color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none' }}>Switch</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Safe Info Card */}
          <div style={{ ...cardStyle, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>Safe Wallet</h2>
                <p style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--dark-400)', marginTop: 4 }}>
                  {shortenAddress(currentSafe.safeAddress, 8)}
                </p>
              </div>
              <Badge variant="success">{currentSafe.threshold}/{currentSafe.owners.length} Threshold</Badge>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: 'var(--dark-400)' }}>Owners:</span>
              {currentSafe.owners.map((owner: string) => (
                <Badge key={owner} variant="neutral">{shortenAddress(owner)}</Badge>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => setShowProposeModal(true)} className="btn-primary-dark" style={{ flex: 1 }}>
                💸 Propose Transaction
              </button>
              <button onClick={() => setShowOwnerModal(true)} className="btn-secondary-dark" style={{ padding: '10px 16px' }}>
                ⚙️ Owners
              </button>
              <button onClick={() => removeSafeWallet(currentSafe.safeAddress)} className="btn-danger-dark" style={{ padding: '10px 16px' }}>
                Remove
              </button>
            </div>
          </div>

          {/* Transactions */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 12 }}>Transactions</h3>
            {txnsLoading ? (
              <Loading message="Loading transactions..." />
            ) : transactions.length === 0 ? (
              <EmptyState icon="📭" title="No transactions" description="Propose a new transaction to get started." action={{ label: '💸 Propose Transaction', onClick: () => setShowProposeModal(true) }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {transactions.map((tx) => (
                  <SafeTxCard key={tx.safeTxHash} tx={tx} owners={currentSafe.owners} safeAddress={currentSafe.safeAddress} threshold={currentSafe.threshold}
                    onConfirm={() => handleConfirm(tx, currentSafe.safeAddress)} onExecute={() => handleExecute(tx)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Safe" size="lg">
        <CreateSafeForm chainId={activeChainId} onCreated={handleSafeCreated} onCancel={() => setShowCreateModal(false)} />
      </Modal>

      {/* Propose Modal */}
      {currentSafe && (
        <Modal open={showProposeModal} onClose={() => setShowProposeModal(false)} title="Propose Transaction" size="lg">
          <ProposeTxForm safeAddress={currentSafe.safeAddress} chainId={activeChainId} onSuccess={() => setShowProposeModal(false)} />
        </Modal>
      )}

      {/* Owner Management Modal */}
      {currentSafe && (
        <OwnerManagementModal
          open={showOwnerModal}
          onClose={() => setShowOwnerModal(false)}
          safeAddress={currentSafe.safeAddress}
          currentOwners={currentSafe.owners}
          currentThreshold={currentSafe.threshold}
          onUpdated={() => api.getSafeList().then((res) => {
            const items = (res.data as any)?.items || [];
            setLoadedSafes(items);
          })}
        />
      )}
    </div>
  );
}

function SafeTxCard({ tx, owners, threshold, safeAddress, onConfirm, onExecute }: {
  tx: SafeTransactionEntry; owners: string[]; threshold: number; safeAddress: string; onConfirm: () => void; onExecute: () => void;
}) {
  const confirmCount = tx.confirmations?.length || 0;
  const isReady = confirmCount >= threshold && tx.status !== 'executed';

  return (
    <div style={{ ...cardStyle, padding: 16, transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'white' }}>
            {tx.proposal?.to ? `Send to ${shortenAddress(tx.proposal.to)}` : 'Contract Interaction'}
          </p>
          {tx.proposal?.value && <p style={{ fontSize: 12, color: 'var(--dark-400)', marginTop: 2 }}>Value: {formatAmount(tx.proposal.value)}</p>}
        </div>
        <Badge variant={tx.status === 'executed' ? 'success' : isReady ? 'warning' : 'info'}>
          {tx.status === 'executed' ? 'Executed' : isReady ? 'Ready' : tx.status}
        </Badge>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--dark-400)' }}>Confirmations: {confirmCount}/{threshold}</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: threshold }).map((_, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i < confirmCount ? 'var(--accent-green)' : 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>
      </div>
      <p style={{ fontSize: 11, color: 'var(--dark-500)', marginBottom: 8 }}>
        Proposed {tx.proposer && `by ${shortenAddress(tx.proposer)}`}
        {tx.executedAt && ` • Executed ${formatDate(tx.executedAt)}`}
      </p>
      {tx.status !== 'executed' && (
        <div style={{ display: 'flex', gap: 8 }}>
          {!tx.confirmations?.find((c) => c.owner === '0xYourAddress') && (
            <button onClick={onConfirm} className="btn-primary-dark" style={{ padding: '6px 14px', fontSize: 12 }}>✍️ Confirm</button>
          )}
          {isReady && (
            <button onClick={onExecute} style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 12,
              background: 'rgba(16,185,129,0.1)', color: 'var(--accent-green)',
              border: '1px solid rgba(16,185,129,0.2)', cursor: 'pointer',
            }}>▶️ Execute</button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateSafeForm({ chainId, onCreated, onCancel }: { chainId: ChainId; onCreated: (safe: SafeWallet) => void; onCancel: () => void }) {
  const [owners, setOwners] = useState<string[]>(['', '']);
  const [threshold, setThreshold] = useState(2);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addOwner = () => setOwners([...owners, '']);
  const removeOwner = (i: number) => { if (owners.length <= 2) return; setOwners(owners.filter((_, idx) => idx !== i)); };
  const updateOwner = (i: number, val: string) => { const n = [...owners]; n[i] = val; setOwners(n); };

  const handleCreate = async () => {
    setError(null);
    const valid = owners.filter((o) => isValidAddress(o, chainId));
    if (valid.length < 2) { setError('At least 2 valid addresses'); return; }
    if (threshold < 1 || threshold > valid.length) { setError(`Threshold must be 1-${valid.length}`); return; }
    setCreating(true);
    try {
      const numericChainId = String(getChainInfo(chainId)?.id || 11155111);
      const res = await api.createSafe({ owners: valid, threshold, chainId: numericChainId });
      const safe: SafeWallet = { type: 'safe', safeAddress: res.data.safeAddress, chainId, owners: valid, threshold, nonce: 0, version: '1.4.1', deployed: true };
      onCreated(safe);
      showToast('success', 'Safe created');
    } catch (err: any) { setError(err.message || 'Failed'); }
    finally { setCreating(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ErrorDisplay error={error} onDismiss={() => setError(null)} />
      <div>
        <span style={{ fontSize: 12, color: 'var(--dark-400)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Owners ({owners.length})</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {owners.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} placeholder={`Owner ${i + 1}`} value={o} onChange={e => updateOwner(i, e.target.value)} />
              {owners.length > 2 && <button onClick={() => removeOwner(i)} style={{ color: 'var(--accent-red)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 500 }}>✕</button>}
            </div>
          ))}
        </div>
        <button onClick={addOwner} style={{ fontSize: 12, color: 'var(--accent)', marginTop: 8, cursor: 'pointer', background: 'none', border: 'none' }}>+ Add Owner</button>
      </div>
      <div>
        <span style={{ fontSize: 12, color: 'var(--dark-400)', fontWeight: 500, display: 'block', marginBottom: 8 }}>Threshold</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: owners.length }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setThreshold(n)}
              style={{
                width: 40, height: 40, borderRadius: 10, fontSize: 14, fontWeight: 500,
                background: threshold === n ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                color: threshold === n ? 'white' : 'var(--dark-400)',
                cursor: 'pointer', border: 'none', transition: 'all 0.2s',
              }}
            >{n}</button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--dark-500)', marginTop: 4 }}>{threshold} of {owners.length} signatures required</p>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onCancel} className="btn-secondary-dark" style={{ flex: 1 }}>Cancel</button>
        <button onClick={handleCreate} disabled={creating} className="btn-primary-dark" style={{ flex: 1 }}>{creating ? 'Creating...' : '🏛️ Create Safe'}</button>
      </div>
    </div>
  );
}

function ProposeTxForm({ safeAddress, chainId, onSuccess }: { safeAddress: string; chainId: ChainId; onSuccess: () => void }) {
  const [to, setTo] = useState('');
  const [value, setValue] = useState('');
  const [data, setData] = useState('');
  const [proposing, setProposing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePropose = async () => {
    setError(null);
    if (!isValidAddress(to, chainId)) { setError('Invalid recipient address'); return; }
    setProposing(true);
    try {
      await api.proposeSafeTx({ safeAddress, to, value, data, chainId });
      showToast('success', 'Transaction proposed');
      onSuccess();
    } catch (err: any) { setError(err.message || 'Failed'); }
    finally { setProposing(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ErrorDisplay error={error} onDismiss={() => setError(null)} />
      <div>
        <span style={{ fontSize: 12, color: 'var(--dark-400)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Recipient</span>
        <input style={inputStyle} placeholder="Address" value={to} onChange={e => setTo(e.target.value)} />
      </div>
      <div>
        <span style={{ fontSize: 12, color: 'var(--dark-400)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Value (native token)</span>
        <input style={inputStyle} type="number" placeholder="0.00" value={value} onChange={e => setValue(e.target.value)} />
      </div>
      <div>
        <span style={{ fontSize: 12, color: 'var(--dark-400)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Data (hex, optional)</span>
        <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} placeholder="0x..." value={data} onChange={e => setData(e.target.value)} />
      </div>
      <button onClick={handlePropose} disabled={proposing || !to} className="btn-primary-dark" style={{ width: '100%' }}>
        {proposing ? 'Proposing...' : '💸 Propose Transaction'}
      </button>
    </div>
  );
}

function mockTxns(safeAddress: string, owners: string[]): SafeTransactionEntry[] {
  return [{
    safeTxHash: '0xabc123...', proposer: owners[0],
    confirmations: [{ owner: owners[0], signature: '0x...', submittedAt: Date.now() - 3600000 }],
    executed: false,
    proposal: { safeAddress, to: owners[1] || safeAddress, value: '1000000000', data: '0x', operation: 0, safeTxGas: 0, baseGas: 0, gasPrice: '0', gasToken: '', refundReceiver: '0x', nonce: 0 },
    status: 'pending',
  }] as unknown as SafeTransactionEntry[];
}

async function handleConfirm(tx: SafeTransactionEntry, safeAddress: string) {
  try { await api.confirmSafeTx(safeAddress, tx.safeTxHash, '0xsignature'); showToast('success', 'Confirmed'); }
  catch { showToast('error', 'Confirmation failed'); }
}
async function handleExecute(tx: SafeTransactionEntry) {
  try { await api.executeSafeTx(tx.safeTxHash); showToast('success', 'Executed'); }
  catch { showToast('error', 'Execution failed'); }
}

function OwnerManagementModal({
  open, onClose, safeAddress, currentOwners, currentThreshold, onUpdated,
}: {
  open: boolean; onClose: () => void; safeAddress: string; currentOwners: string[]; currentThreshold: number; onUpdated: () => void;
}) {
  const [owners, setOwners] = useState<string[]>(currentOwners);
  const [threshold, setThreshold] = useState(currentThreshold);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setOwners(currentOwners); setThreshold(currentThreshold); }, [currentOwners, currentThreshold]);

  const addOwner = () => setOwners([...owners, '']);
  const removeOwner = (i: number) => { if (owners.length <= 1) return; setOwners(owners.filter((_, idx) => idx !== i)); };
  const updateOwner = (i: number, val: string) => { const n = [...owners]; n[i] = val; setOwners(n); };

  const handleUpdate = async () => {
    setError(null);
    if (threshold < 1 || threshold > owners.length) { setError(`Threshold must be 1-${owners.length}`); return; }
    const valid = owners.filter(o => /^0x[0-9a-fA-F]{40}$/.test(o));
    if (valid.length !== owners.length) { setError('All owners must be valid addresses'); return; }
    setUpdating(true);
    try {
      await api.updateSafeOwners(safeAddress, owners, threshold);
      showToast('success', 'Owners updated');
      onUpdated();
      onClose();
    } catch (e: any) { setError(e.message || 'Update failed'); } finally { setUpdating(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="⚙️ Manage Owners" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h4 style={{ fontSize: 13, color: 'var(--dark-200)', marginBottom: 8 }}>Owners ({owners.length})</h4>
          {owners.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input style={inputStyle} value={o} placeholder="0x..." onChange={e => updateOwner(i, e.target.value)} />
              <button onClick={() => removeOwner(i)} disabled={owners.length <= 1} className="btn-secondary-dark" style={{ padding: '6px 12px' }}>✕</button>
            </div>
          ))}
          <button onClick={addOwner} className="btn-secondary-dark" style={{ marginTop: 4 }}>+ Add Owner</button>
        </div>
        <div>
          <h4 style={{ fontSize: 13, color: 'var(--dark-200)', marginBottom: 8 }}>Threshold</h4>
          <input style={inputStyle} type="number" min={1} max={owners.length} value={threshold} onChange={e => setThreshold(parseInt(e.target.value) || 1)} />
          <p style={{ fontSize: 11, color: 'var(--dark-400)', marginTop: 4 }}>{threshold} of {owners.length} signatures required</p>
        </div>
        {error && <ErrorDisplay error={error} />}
        <button onClick={handleUpdate} disabled={updating} className="btn-primary-dark" style={{ width: '100%' }}>
          {updating ? 'Updating...' : '💾 Save Changes'}
        </button>
      </div>
    </Modal>
  );
}
