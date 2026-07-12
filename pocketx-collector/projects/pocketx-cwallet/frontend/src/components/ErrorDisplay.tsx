interface ErrorDisplayProps {
  error: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorDisplay({ error, onRetry, onDismiss }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <div style={{
      borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
      padding: 14, animation: 'fade-in 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>❌</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent-red)', marginBottom: 2 }}>Error</p>
          <p style={{ fontSize: 13, color: '#fca5a5', wordBreak: 'break-word' }}>{error}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{ fontSize: 13, color: 'var(--accent-red)', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{ fontSize: 16, color: '#f87171', cursor: 'pointer', background: 'none', border: 'none', padding: '0 4px' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
