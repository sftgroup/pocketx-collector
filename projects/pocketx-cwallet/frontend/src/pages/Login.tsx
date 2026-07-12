/**
 * Login Page — Email verification code login (L-011)
 * Dev mode: fixed code 888888
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { showToast } from '@/components/Toast';

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  fontSize: 15,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: 'white',
  outline: 'none',
};

export function LoginPage() {
  const navigate = useNavigate();
  const { sendCode, verifyCode, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [localLoading, setLocalLoading] = useState(false);

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSendCode = async () => {
    if (!validateEmail(email)) {
      showToast('error', 'Please enter a valid email address');
      return;
    }
    setLocalLoading(true);
    try {
      const result = await sendCode(email);
      setCodeSent(true);
      setCountdown(60);
      showToast('success', 'Verification code sent (dev: 888888)');
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to send code');
    }
    setLocalLoading(false);
  };

  const handleVerify = async () => {
    if (!code || code.length < 6) {
      showToast('error', 'Please enter 6-digit verification code');
      return;
    }
    setLocalLoading(true);
    try {
      await verifyCode(email, code, '');
      showToast('success', 'Login successful');
      navigate('/wallet/hd');
    } catch (err: any) {
      showToast('error', err.message || 'Verification failed');
    }
    setLocalLoading(false);
  };

  const busy = isLoading || localLoading;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 24,
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
    }}>
      <div style={{ ...cardStyle, padding: 32, width: '100%', maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>🪙</span>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white', margin: 0 }}>PocketX</h1>
          <p style={{ fontSize: 14, color: 'var(--dark-400)', marginTop: 8 }}>
            {codeSent ? 'Enter verification code' : 'Sign in with email'}
          </p>
        </div>

        {/* Email input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: 'var(--dark-300)', marginBottom: 6, display: 'block' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={codeSent}
            style={{ ...inputStyle, opacity: codeSent ? 0.5 : 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !codeSent) handleSendCode(); }}
          />
        </div>

        {/* Send code button (step 1) */}
        {!codeSent && (
          <button
            onClick={handleSendCode}
            disabled={busy || !email}
            className="btn-primary-dark"
            style={{ width: '100%', padding: '12px', fontSize: 15, fontWeight: 600 }}
          >
            {busy ? 'Sending...' : 'Send Verification Code'}
          </button>
        )}

        {/* Code input + verify (step 2) */}
        {codeSent && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--dark-300)', marginBottom: 6, display: 'block' }}>Verification Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="888888"
                maxLength={6}
                style={{ ...inputStyle, fontSize: 22, textAlign: 'center', letterSpacing: 8 }}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
              />
            </div>

            <button
              onClick={handleVerify}
              disabled={busy || code.length < 6}
              className="btn-primary-dark"
              style={{ width: '100%', padding: '12px', fontSize: 15, fontWeight: 600 }}
            >
              {busy ? 'Verifying...' : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                onClick={() => { setCodeSent(false); setCode(''); setCountdown(0); }}
                disabled={countdown > 0}
                className="btn-link-dark"
                style={{
                  fontSize: 13, color: countdown > 0 ? 'var(--dark-500)' : 'var(--accent)',
                  cursor: countdown > 0 ? 'not-allowed' : 'pointer', background: 'none', border: 'none',
                }}
              >
                {countdown > 0 ? `Resend in ${countdown}s` : '← Change email / resend'}
              </button>
            </div>
          </>
        )}

        {/* Dev hint */}
        <p style={{ fontSize: 11, color: 'var(--dark-500)', textAlign: 'center', marginTop: 24 }}>
          Dev mode: use code <strong style={{ color: 'var(--accent)' }}>888888</strong> for any email
        </p>
      </div>
    </div>
  );
}
