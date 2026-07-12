/**
 * Receive page — PocketX Dark Theme
 * Shows QR code (EIP-681) and wallet address for receiving tokens
 */

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { ChainSelector } from '@/components/ChainSelector';
import { EmptyState } from '@/components/EmptyState';
import { showToast } from '@/components/Toast';
import { getChainInfo } from '@/utils/chain';

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

export function ReceivePage() {
  const { activeChainId, walletMode } = useAuthStore();
  const { safeWallets } = useWalletStore();
  const [amount, setAmount] = useState('');

  const chain = getChainInfo(activeChainId);

  let address = '';
  if (walletMode === 'non-custodial') {


  } else if (walletMode === 'safe') {
    address = safeWallets.find((w) => w.chainId === activeChainId)?.safeAddress || '';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 440, margin: '0 auto' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>Receive</h1>
        <p style={{ fontSize: 14, color: 'var(--dark-400)', marginTop: 4 }}>
          Send tokens to your {walletMode} wallet address
        </p>
      </div>

      <ChainSelector />

      {!address ? (
        <EmptyState icon="📥" title="No wallet connected" description={`Connect or create a ${walletMode} wallet first to receive tokens.`} />
      ) : (
        <div style={{ ...cardStyle, padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* QR Code — EIP-681 */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            padding: 20, background: 'white', borderRadius: 16,
          }}>
            <QRCodeSVG
              value={amount ? `ethereum:${address}?value=${amount}` : address}
              size={180}
              level="M"
              includeMargin
              bgColor="#ffffff"
              fgColor="#000000"
            />
            <span style={{ fontSize: 11, color: '#666' }}>Scan with any wallet app</span>
          </div>

          {/* Request amount */}
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: 12, color: 'var(--dark-400)', display: 'block', marginBottom: 6 }}>
              Request Amount (optional)
            </span>
            <input
              type="number" step="any"
              placeholder={`0.00 ${chain.symbol}`}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'white',
                fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <p style={{ fontSize: 11, color: 'var(--dark-400)', marginBottom: 8 }}>
              Your {chain.name} Address ({walletMode})
            </p>
            <div style={{ padding: 14, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: 'var(--dark-200)', wordBreak: 'break-all', userSelect: 'all' }}>
                {address}
              </p>
            </div>
          </div>

          <button
            onClick={() => { navigator.clipboard.writeText(address); showToast('success', 'Address copied'); }}
            className="btn-primary-dark"
            style={{ width: '100%' }}
          >
            📋 Copy Address
          </button>

          <div style={{ fontSize: 11, color: 'var(--dark-500)', lineHeight: 1.5 }}>
            <p>⚠️ Only send {chain.symbol} and SPL/BEP-20 tokens to this address.</p>
            <p>Sending other tokens may result in permanent loss.</p>
          </div>
        </div>
      )}
    </div>
  );
}
