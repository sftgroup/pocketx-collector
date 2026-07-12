/**
 * Mode Switcher — Dark theme inline style version (Non-Custodial + Safe)
 */

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { env } from '@/env';
import type { WalletMode, WalletModeOption } from '@/types';

const modeOptions: WalletModeOption[] = [
  {
    id: 'non-custodial',
    label: 'Non-Custodial',
    description: 'BIP44 multi-chain wallet — you hold the keys',
    icon: '🔑',
  },
  {
    id: 'custodial',
    label: 'Custodial',
    description: 'Platform-managed wallet — no key management',
    icon: '☁️',
  },
  {
    id: 'safe',
    label: 'Safe Multi-Sig',
    description: 'Multi-signature wallet for teams',
    icon: '🏛️',
    disabled: !env.ENABLE_SAFE,
  },
];

const modeIcons: Record<WalletMode, string> = {
  'non-custodial': '🔑',
  'custodial': '☁️',
  'safe': '🏛️',
};

const modeLabels: Record<WalletMode, string> = {
  'non-custodial': 'Non-Custodial',
  'custodial': 'Custodial',
  'safe': 'Safe',
};

const modeAccentColors: Record<WalletMode, string> = {
  'non-custodial': 'var(--accent-blue)',
  'custodial': 'var(--accent-purple)',
  'safe': 'var(--accent-green)',
};

const modeBgs: Record<WalletMode, string> = {
  'non-custodial': 'rgba(59,130,246,0.15)',
  'custodial': 'rgba(168,85,247,0.15)',
  'safe': 'rgba(16,185,129,0.15)',
};

const modeBorders: Record<WalletMode, string> = {
  'non-custodial': 'rgba(59,130,246,0.35)',
  'custodial': 'rgba(168,85,247,0.35)',
  'safe': 'rgba(16,185,129,0.35)',
};

export function ModeSwitcher({ compact = false }: { className?: string; compact?: boolean }) {
  const { walletMode, setWalletMode } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentMode = modeOptions.find((m) => m.id === walletMode)!;
  const accentColor = modeAccentColors[walletMode];

  if (compact) {
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 12,
            background: modeBgs[walletMode],
            border: `1px solid ${modeBorders[walletMode]}`,
            color: accentColor, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <span>{modeIcons[walletMode]}</span>
          <span>{modeLabels[walletMode]}</span>
        </button>
        {open && (
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 8,
            background: 'var(--dark-800)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(24px)', padding: '8px 0', zIndex: 50, width: 240,
          }}>
            {modeOptions.map((mode) => (
              <button
                key={mode.id}
                disabled={mode.disabled}
                onClick={() => { setWalletMode(mode.id); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', width: '100%', fontSize: 14,
                  color: mode.id === walletMode ? modeAccentColors[mode.id] : 'var(--dark-300)',
                  background: mode.id === walletMode ? modeBgs[mode.id] : 'transparent',
                  transition: 'all 0.2s', cursor: mode.disabled ? 'not-allowed' : 'pointer',
                  opacity: mode.disabled ? 0.4 : 1,
                }}
              >
                <span>{mode.icon}</span>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ display: 'block' }}>{mode.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--dark-500)', display: 'block' }}>{mode.description}</span>
                </div>
                {mode.id === walletMode && <span style={{ color: modeAccentColors[mode.id] }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 16,
          background: modeBgs[walletMode],
          border: `2px solid ${modeBorders[walletMode]}`,
          color: accentColor, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <span style={{ fontSize: 20 }}>{modeIcons[walletMode]}</span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div>{modeLabels[walletMode]}</div>
          <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>{currentMode.description}</div>
        </div>
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'flex' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, left: 0, top: '100%', marginTop: 8,
          background: 'var(--dark-800)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(24px)', padding: '8px 0', zIndex: 50,
        }}>
          {modeOptions.map((mode) => (
            <button
              key={mode.id}
              disabled={mode.disabled}
              onClick={() => { setWalletMode(mode.id); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px', width: '100%', fontSize: 14,
                color: mode.id === walletMode ? modeAccentColors[mode.id] : 'var(--dark-300)',
                background: mode.id === walletMode ? modeBgs[mode.id] : 'transparent',
                transition: 'all 0.2s', cursor: mode.disabled ? 'not-allowed' : 'pointer',
                opacity: mode.disabled ? 0.4 : 1,
              }}
            >
              <span style={{ fontSize: 18 }}>{mode.icon}</span>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div>{mode.label}</div>
                <div style={{ fontSize: 11, color: 'var(--dark-500)' }}>{mode.description}</div>
              </div>
              {mode.id === walletMode && (
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: modeAccentColors[mode.id],
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11,
                }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ModeBanner() {
  const { walletMode } = useAuthStore();
  const accentColor = modeAccentColors[walletMode];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px', borderRadius: 12,
      background: modeBgs[walletMode],
      border: `1px solid ${modeBorders[walletMode]}`,
      color: accentColor, fontSize: 12, fontWeight: 500,
      margin: '0 12px 8px',
    }}>
      <span>{modeIcons[walletMode]}</span>
      <span>{modeLabels[walletMode]} mode</span>
    </div>
  );
}
