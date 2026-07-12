import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Layers, Wallet, Shield, ArrowUpDown, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { env } from '@/env';
import { NotificationCenter } from '@/components/NotificationCenter';
import { useTranslation } from 'react-i18next';
import type { WalletMode } from '@/types';

// ── Sidebar ──
const navItems: { label: string; icon: React.ElementType; path: string; mode?: WalletMode }[] = [
  { label: 'Non-Custodial', icon: Wallet, path: '/wallet/hd', mode: 'non-custodial' },
  { label: 'Custodial', icon: Wallet, path: '/wallet/custodial', mode: 'custodial' },
  { label: 'Safe', icon: Shield, path: '/wallet/safe', mode: 'safe' },
  { label: 'History', icon: ArrowUpDown, path: '/transactions' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

const adminNavItems = [
  { label: 'Dashboard', icon: Wallet, path: '/admin/dashboard' },
  { label: 'Batch Transfer', icon: ArrowUpDown, path: '/admin/batch' },
  { label: 'All Txs', icon: ArrowUpDown, path: '/admin/transactions' },
  { label: 'SaaS WaaS', icon: Wallet, path: '/admin/saas' },
];

const linkStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '10px 12px', borderRadius: 12,
  transition: 'all 0.2s', border: '1px solid transparent',
  fontSize: 14, fontWeight: 500,
};

function AppSidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const location = useLocation();
  const { walletMode, isAuthenticated } = useAuthStore();

  const filteredItems = navItems.filter((item) => !item.mode || item.mode === walletMode);

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 40,
      display: 'flex', flexDirection: 'column',
      width: collapsed ? 72 : 240,
      background: 'rgba(10,10,10,0.8)',
      backdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      transition: 'width 0.3s',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px', height: 64,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 12,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-purple))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Layers size={16} color="white" />
        </div>
        {!collapsed && (
          <span style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>
            Pocket<span style={{ color: 'var(--accent)' }}>X</span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
        <p style={{ padding: '0 12px', fontSize: 10, fontWeight: 600, color: 'var(--dark-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2, display: collapsed ? 'none' : 'block' }}>
          Wallet
        </p>
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={{
                ...linkStyle,
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--dark-300)',
                borderColor: isActive ? 'rgba(99,102,241,0.2)' : 'transparent',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={20} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}

        {env.ENABLE_ADMIN && (
          <>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 0', display: collapsed ? 'none' : 'block' }} />
            <p style={{ padding: '0 12px', fontSize: 10, fontWeight: 600, color: 'var(--dark-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2, display: collapsed ? 'none' : 'block' }}>
              Admin
            </p>
            {adminNavItems.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={{
                    ...linkStyle,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--dark-300)',
                    borderColor: isActive ? 'rgba(99,102,241,0.2)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon size={20} style={{ flexShrink: 0 }} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      {/* Collapse Button */}
      <div style={{ padding: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            ...linkStyle, width: '100%', justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--dark-400)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'white'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--dark-400)'; }}
        >
          {collapsed ? <ChevronRight size={20} /> : <><ChevronLeft size={20} /><span style={{ fontSize: 14 }}>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}

// ── TopBar ──
function AppTopBar() {
  const { walletMode, isAuthenticated, session, logout } = useAuthStore();
  const [showModeMenu, setShowModeMenu] = useState(false);
  const modeRef = useRef<HTMLDivElement>(null);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) setShowModeMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const modeIcons: Record<WalletMode, string> = {
    'non-custodial': '🔑',
    'custodial': '☁️',
    'safe': '🏛️',
  };
  const modeLabels: Record<WalletMode, string> = {
    'non-custodial': 'HD Wallet',
    'custodial': 'Custodial',
    'safe': 'Safe Multi-Sig',
  };

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px', borderRadius: 12,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)',
    color: 'var(--dark-200)', fontSize: 14, cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const emailShort = session?.email ? session.email.split('@')[0].slice(0, 8) : '';

  return (
    <header style={{
      height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.05)',
      background: 'rgba(10,10,10,0.5)', backdropFilter: 'blur(24px)',
    }}>
      <div>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark-200)' }}>
          🪙 {env.APP_NAME}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Notification Center */}
        <NotificationCenter />

        {/* Language Switcher */}
        <button
          onClick={() => i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh')}
          style={{
            ...btnStyle, fontSize: 12, background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
        >
          {i18n.language === 'zh' ? '🌐 EN' : '🌐 中文'}
        </button>

        {/* Mode Switcher */}
        <div ref={modeRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowModeMenu(!showModeMenu)}
            style={{
              ...btnStyle,
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
              color: 'var(--accent)', fontWeight: 500,
            }}
          >
            <span>{modeIcons[walletMode]}</span>
            <span>{modeLabels[walletMode]}</span>
            <span style={{ fontSize: 10, marginLeft: 2 }}>▾</span>
          </button>
          {showModeMenu && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 8,
              background: 'var(--dark-800)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(24px)', padding: '8px 0', zIndex: 50, minWidth: 200,
            }}>
              {(['non-custodial', 'custodial', 'safe'] as WalletMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { useAuthStore.getState().setWalletMode(mode); setShowModeMenu(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', width: '100%', fontSize: 14,
                    color: mode === walletMode ? 'var(--accent)' : 'var(--dark-300)',
                    background: mode === walletMode ? 'rgba(99,102,241,0.08)' : 'transparent',
                    transition: 'all 0.2s', cursor: 'pointer',
                  }}
                >
                  <span>{modeIcons[mode]}</span>
                  <span>{modeLabels[mode]}</span>
                  {mode === walletMode && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User info / logout */}
        {isAuthenticated && session && (
          <button
            onClick={logout}
            title={`Logged in as ${session.email}`}
            style={{
              ...btnStyle, fontSize: 12, color: 'var(--dark-400)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--dark-400)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 11,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 600, color: 'white',
            }}>
              {emailShort || '?'}
            </span>
            Logout
          </button>
        )}
      </div>
    </header>
  );
}

// ── Mobile Bottom Nav ──
function BottomNav() {
  const { walletMode } = useAuthStore();
  const location = useLocation();

  const visibleItems = navItems.filter((item) => !item.mode || item.mode === walletMode);

  return (
    <nav style={{
      display: 'none', // FIXME: hidden on mobile for now, md:hidden equivalent
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(24px)',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      zIndex: 30, padding: '8px 0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        {visibleItems.slice(0, 5).map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '4px 12px', fontSize: 10, fontWeight: 500,
                color: isActive ? 'var(--accent)' : 'var(--dark-400)',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

// ── Layout ──
export function Layout() {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--dark-950)' }}>
      <AppSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main style={{
        flex: 1,
        marginLeft: collapsed ? 72 : 240,
        transition: 'margin 0.3s',
      }}>
        <AppTopBar />
        <div style={{ padding: 24 }}>
          <Outlet />
        </div>
      </main>
      <BottomNav />

      {/* Background glow */}
      <div style={{
        position: 'fixed', top: 0, right: 0, width: 600, height: 600,
        background: 'rgba(99,102,241,0.05)', borderRadius: '50%',
        filter: 'blur(150px)', pointerEvents: 'none', zIndex: -1,
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', width: 400, height: 400,
        background: 'rgba(139,92,246,0.05)', borderRadius: '50%',
        filter: 'blur(120px)', pointerEvents: 'none', zIndex: -1,
      }} />
    </div>
  );
}
