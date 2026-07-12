import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastContainer } from '@/components/Toast';
import { useAuthStore } from '@/store/authStore';
import { useSSE } from '@/hooks/useSSE';
import { env } from '@/env';

// Pages
import { LoginPage } from '@/pages/Login';
import { CustodialWalletPage } from '@/pages/CustodialWallet';
import { WalletPage } from '@/pages/WalletPage';
import { SafeWalletPage } from '@/pages/SafeWallet';
import { TransactionsPage } from '@/pages/Transactions';
import { ReceivePage } from '@/pages/Receive';
import { SettingsPage } from '@/pages/Settings';
import { AdminDashboardPage } from '@/pages/AdminDashboard';
import { AdminBatchTransferPage } from '@/pages/AdminBatchTransfer';
import SaaSDashboard from '@/pages/SaaSDashboard';

// Auth guard: redirect to login if not authenticated
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--dark-900)', color: 'white' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🪙</div>
        <div style={{ fontSize: 14, color: 'var(--dark-400)' }}>Loading PocketX...</div>
      </div>
    </div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Default redirect based on current mode
function WalletRedirect() {
  const { walletMode } = useAuthStore();
  switch (walletMode) {
    case 'non-custodial':
    case 'safe':
      return <Navigate to="/wallet/safe" replace />;
    default:
      return <Navigate to="/wallet/hd" replace />;
  }
}

function AppContent() {
  // Restore session on mount
  useEffect(() => {
    useAuthStore.getState().restoreSession();
  }, []);

  // Initialize SSE connection for deposit notifications
  useSSE();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public: Login page (no layout) */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected: Layout wrapper */}
        <Route path="/" element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }>
          {/* Default redirect */}
          <Route index element={<WalletRedirect />} />

          {/* HD Wallet Routes */}
          <Route path="wallet/hd" element={<WalletPage />} />

          {/* Safe Routes */}
          <Route path="wallet/safe" element={<SafeWalletPage />} />

          {/* Custodial Routes */}
          <Route path="wallet/custodial" element={<CustodialWalletPage />} />

          {/* Shared Routes */}
          <Route path="send" element={<SendRedirect />} />
          <Route path="receive" element={<ReceivePage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="settings" element={<SettingsPage />} />

          {/* Safe management */}
          <Route path="safe" element={<SafeWalletPage />} />

          {/* Admin Routes */}
          {env.ENABLE_ADMIN && (
            <>
              <Route path="admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="admin/batch" element={<AdminBatchTransferPage />} />
              <Route path="admin/transactions" element={<TransactionsPage />} />
              <Route path="admin/saas" element={<SaaSDashboard />} />
            </>
          )}

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/wallet/hd" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

// Redirect send page to the appropriate send flow based on mode
function SendRedirect() {
  const { walletMode } = useAuthStore();
  switch (walletMode) {
    case 'non-custodial':
    case 'safe':
      return <Navigate to="/wallet/safe" replace />;
    default:
      return <Navigate to="/wallet/hd" replace />;
  }
}

export function App() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--dark-950)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          width: 40, height: 40,
          borderRadius: '50%', border: '2px solid rgba(99,102,241,0.3)',
          borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AppContent />
      <ToastContainer />
    </ErrorBoundary>
  );
}
