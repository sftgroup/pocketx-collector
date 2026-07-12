/**
 * FE-09: Settings — PocketX Dark Theme (HD + Safe)
 */

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { showToast } from '@/components/Toast';
import { shortenAddress } from '@/utils/format';
import { getChainInfo } from '@/utils/chain';
import { env } from '@/env';
import { api } from '@/services/api';
import type { WalletMode } from '@/types';

type SettingsTab = 'general' | 'wallets' | 'security' | 'about';

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

export function SettingsPage() {
  const { walletMode, isAuthenticated, logout: authLogout } = useAuthStore();
  const { nonCustodialWallets, safeWallets, removeNonCustodialWallet, removeSafeWallet } = useWalletStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'wallets', label: 'Wallets', icon: '💳' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'about', label: 'About', icon: 'ℹ️' },
  ];

  const allWallets = [
    ...nonCustodialWallets.map((w) => ({ type: 'hd' as const, modeLabel: 'Non-Custodial', address: w.address })),
    ...safeWallets.map((w) => ({ type: 'safe' as const, modeLabel: 'Safe', address: w.safeAddress })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>Settings</h1>
        <p style={{ fontSize: 14, color: 'var(--dark-400)', marginTop: 4 }}>Manage your wallet preferences and security</p>
      </div>

      <div style={{ ...cardStyle, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Wallet Mode</h3>
          <Badge variant="info">{walletMode}</Badge>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 0 }}>
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 16px', fontSize: 13, fontWeight: 500,
            borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent)' : 'transparent'}`,
            color: activeTab === tab.id ? 'var(--accent)' : 'var(--dark-400)',
            cursor: 'pointer', transition: 'all 0.2s', background: 'none', marginBottom: -1,
          }}>
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'general' && <GeneralSettings />}
      {activeTab === 'wallets' && <WalletSettings wallets={allWallets} removeNonCustodialWallet={removeNonCustodialWallet} removeSafeWallet={removeSafeWallet} />}
      {activeTab === 'security' && <SecuritySettings isAuthenticated={isAuthenticated} onLogout={() => setShowLogoutConfirm(true)} />}
      {activeTab === 'about' && <AboutSettings />}

      <Modal open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} title="Logout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--dark-300)' }}>Are you sure you want to logout?</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setShowLogoutConfirm(false)} className="btn-secondary-dark" style={{ flex: 1 }}>Cancel</button>
            <button onClick={() => { authLogout(); setShowLogoutConfirm(false); showToast('info', 'Logged out'); }} className="btn-danger-dark" style={{ flex: 1 }}>Logout</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function GeneralSettings() {
  return (
    <div style={{ ...cardStyle, overflow: 'hidden' }}>
      <SettingsRow icon="🌐" title="Default Chain" description="Select preferred blockchain network" control={
        <select style={{ padding: '8px 12px', borderRadius: 10, fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} defaultValue={env.DEFAULT_CHAIN}>
          {env.SUPPORTED_CHAINS.map((c: string) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
        </select>
      } />
      <SettingsRow icon="⚡" title="Gas Sponsorship" description="Gas-free transfers" control={
        <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" defaultChecked={env.ENABLE_GAS_SPONSOR} style={{ opacity: 0, position: 'absolute' }} />
          <div style={{ width: 40, height: 22, borderRadius: 11, background: env.ENABLE_GAS_SPONSOR ? 'var(--accent)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', padding: 2 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', marginLeft: env.ENABLE_GAS_SPONSOR ? 'auto' : 0, transition: 'all 0.2s' }} />
          </div>
        </label>
      } />
    </div>
  );
}

function WalletSettings({ wallets, removeNonCustodialWallet, removeSafeWallet }: {
  wallets: any[];
  removeNonCustodialWallet: (chainId: any) => void;
  removeSafeWallet: (safeAddress: string) => void;
}) {
  if (wallets.length === 0) {
    return <div style={{ ...cardStyle, padding: 40, textAlign: 'center' }}><span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>💳</span><p style={{ fontSize: 14, color: 'var(--dark-400)' }}>No wallets configured yet</p></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {wallets.map((wallet: any, i: number) => (
        <div key={i} style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {wallet.type === 'non-custodial' ? '🔑' : '🏛️'}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'white' }}>{wallet.modeLabel}</p>
              <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--dark-400)' }}>{shortenAddress(wallet.address || '')}</p>
              <p style={{ fontSize: 11, color: 'var(--dark-500)' }}>{getChainInfo(wallet.chainId || 'solana').name}</p>
            </div>
          </div>
          <button onClick={() => {
            if (wallet.type === 'non-custodial') { removeNonCustodialWallet(wallet.chainId); showToast('info', 'HD Wallet removed'); }
            else if (wallet.type === 'safe') { removeSafeWallet(wallet.safeAddress); showToast('info', 'Safe removed'); }
          }} style={{ fontSize: 12, color: 'var(--accent-red)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 500 }}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

function SecuritySettings({ isAuthenticated, onLogout }: { isAuthenticated: boolean; onLogout: () => void }) {
  const { session } = useAuthStore();
  const [showPinModal, setShowPinModal] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  const checkPinStatus = async () => {
    try {
      const rsp = await api.get('/auth/payment-password-status');
      setHasPin((rsp.data as any)?.hasPaymentPassword ?? false);
    } catch { setHasPin(false); }
  };

  const handlePinSubmit = async () => {
    setPinError('');
    if (!/^\d{6}$/.test(newPin)) { setPinError('PIN must be exactly 6 digits'); return; }
    if (newPin !== confirmPin) { setPinError('PINs do not match'); return; }
    setPinSaving(true);
    try {
      await api.setPaymentPassword(newPin, hasPin ? (oldPin || undefined) : undefined);
      showToast('success', hasPin ? 'Payment PIN changed' : 'Payment PIN set');
      setHasPin(true);
      setShowPinModal(false);
    } catch (err: any) {
      setPinError(err.response?.data?.message || err.message || 'Failed');
    } finally { setPinSaving(false); }
  };

  const openPinModal = () => {
    setOldPin(''); setNewPin(''); setConfirmPin(''); setPinError('');
    checkPinStatus();
    setShowPinModal(true);
  };

  const inputS: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'white', fontSize: 14,
    outline: 'none', fontFamily: 'Inter, sans-serif',
  };

  return (
    <div style={{ ...cardStyle, overflow: 'hidden' }}>
      <SettingsRow icon="🔐" title="Payment PIN" description={hasPin ? 'Change your 6-digit payment PIN' : 'Set your 6-digit payment PIN'} control={<button className="btn-secondary-dark" onClick={openPinModal} style={{ padding: '6px 14px', fontSize: 12 }}>{hasPin ? 'Change' : 'Set'}</button>} />
      <SettingsRow icon="🔑" title="Export Private Key" description="Export wallet private key" control={<button className="btn-secondary-dark" style={{ padding: '6px 14px', fontSize: 12 }}>Export</button>} />
      <SettingsRow icon="👁️" title="Secret Recovery Phrase" description="Reveal your phrase" control={<button className="btn-danger-dark" style={{ padding: '6px 14px', fontSize: 12 }}>Reveal</button>} />
      {isAuthenticated && <SettingsRow icon="🚪" title="Logout" description="Sign out of your wallet" control={<button className="btn-danger-dark" onClick={onLogout} style={{ padding: '6px 14px', fontSize: 12 }}>Logout</button>} />}

      <Modal open={showPinModal} onClose={() => setShowPinModal(false)} title={hasPin ? 'Change Payment PIN' : 'Set Payment PIN'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pinError && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 12 }}>
              {pinError}
            </div>
          )}
          {hasPin && (
            <div>
              <span style={{ fontSize: 12, color: 'var(--dark-400)', display: 'block', marginBottom: 4 }}>Current PIN</span>
              <input style={inputS} type="password" maxLength={6} placeholder="Enter current PIN" value={oldPin} onChange={e => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
          )}
          <div>
            <span style={{ fontSize: 12, color: 'var(--dark-400)', display: 'block', marginBottom: 4 }}>New PIN (6 digits)</span>
            <input style={inputS} type="password" maxLength={6} placeholder="Enter new PIN" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: 'var(--dark-400)', display: 'block', marginBottom: 4 }}>Confirm New PIN</span>
            <input style={inputS} type="password" maxLength={6} placeholder="Re-enter new PIN" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          </div>
          <button onClick={handlePinSubmit} disabled={pinSaving || !newPin || !confirmPin} className="btn-primary-dark" style={{ width: '100%' }}>
            {pinSaving ? 'Saving...' : hasPin ? 'Change PIN' : 'Set PIN'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function AboutSettings() {
  return (
    <div style={{ ...cardStyle, overflow: 'hidden' }}>
      <SettingsRow icon="🪙" title="App Name" description={env.APP_NAME} control={<span style={{ fontSize: 13, color: 'white' }}>{env.APP_NAME}</span>} />
      <SettingsRow icon="🔖" title="Version" description="PocketX" control={<span style={{ fontSize: 13, color: 'white' }}>v{env.APP_VERSION}</span>} />
      <SettingsRow icon="🔗" title="Supported Chains" description="Blockchain networks" control={<div style={{ display: 'flex', gap: 4 }}>{env.SUPPORTED_CHAINS.map((c: string) => <Badge key={c} variant="info">{c.toUpperCase()}</Badge>)}</div>} />
      <SettingsRow icon="⚡" title="Network" description="Connection" control={<Badge variant="success">Connected</Badge>} />
    </div>
  );
}

function SettingsRow({ icon, title, description, control }: { icon: string; title: string; description: string; control: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s', cursor: 'default' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'white' }}>{title}</p>
          <p style={{ fontSize: 11, color: 'var(--dark-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{description}</p>
        </div>
      </div>
      <div style={{ flexShrink: 0, marginLeft: 12 }}>{control}</div>
    </div>
  );
}
