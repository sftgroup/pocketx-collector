import { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

const toastListeners: Set<(toasts: ToastMessage[]) => void> = new Set();
let toasts: ToastMessage[] = [];

function notifyListeners() {
  toastListeners.forEach((fn) => fn([...toasts]));
}

export function showToast(type: ToastType, title: string, message?: string, duration = 4000) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const toast: ToastMessage = { id, type, title, message, duration };
  toasts = [...toasts, toast];
  notifyListeners();
  setTimeout(() => dismissToast(id), duration);
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notifyListeners();
}

const icons: Record<ToastType, string> = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

const toastBg: Record<ToastType, string> = {
  success: 'rgba(16,185,129,0.1)',
  error: 'rgba(239,68,68,0.1)',
  info: 'rgba(59,130,246,0.1)',
  warning: 'rgba(245,158,11,0.1)',
};
const toastBd: Record<ToastType, string> = {
  success: 'rgba(16,185,129,0.2)',
  error: 'rgba(239,68,68,0.2)',
  info: 'rgba(59,130,246,0.2)',
  warning: 'rgba(245,158,11,0.2)',
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14,
      borderRadius: 12, border: `1px solid ${toastBd[toast.type]}`,
      background: toastBg[toast.type], backdropFilter: 'blur(24px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      minWidth: 280, maxWidth: 400,
      animation: 'slide-up 0.2s ease',
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icons[toast.type]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'white' }}>{toast.title}</p>
        {toast.message && <p style={{ fontSize: 13, color: 'var(--dark-300)', marginTop: 2 }}>{toast.message}</p>}
      </div>
      <button onClick={onDismiss} style={{ color: 'var(--dark-400)', cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0, padding: '0 4px' }}>
        ✕
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [current, setCurrent] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (updated: ToastMessage[]) => setCurrent(updated);
    toastListeners.add(listener);
    setCurrent([...toasts]);
    return () => { toastListeners.delete(listener); };
  }, []);

  if (current.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 100,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {current.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
      ))}
    </div>
  );
}
