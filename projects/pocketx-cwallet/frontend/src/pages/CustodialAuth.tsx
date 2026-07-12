/**
 * Custodial Auth — set payment PIN for custodial wallets
 */

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { showToast } from '@/components/Toast';
import { api } from '@/services/api';

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

export function CustodialAuthPage() {
  const { session } = useAuthStore();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetPin = async () => {
    if (pin.length < 6) {
      showToast('error', 'PIN must be at least 6 digits');
      return;
    }
    setLoading(true);
    try {
      const rsp = await api.post('/wallet/pin', { pin });
      if ((rsp.data as any)?.code === 0) {
        showToast('success', 'Payment PIN set');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 40 }}>
      <span style={{ fontSize: 56 }}>🔐</span>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>Set Payment PIN</h1>
      <p style={{ fontSize: 14, color: 'var(--dark-400)', textAlign: 'center' }}>
        Required for custodial wallet transactions
      </p>
      <div style={{ ...cardStyle, padding: 24, width: '100%', maxWidth: 400 }}>
        <input
          type="password"
          maxLength={6}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="6-digit PIN"
          style={{
            width: '100%', padding: '12px', fontSize: 18, textAlign: 'center',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, color: 'white', outline: 'none', letterSpacing: 8,
          }}
        />
        <button onClick={handleSetPin} disabled={loading} className="btn-primary-dark" style={{ width: '100%', marginTop: 16, padding: '12px' }}>
          {loading ? 'Setting...' : 'Set PIN'}
        </button>
      </div>
    </div>
  );
}
