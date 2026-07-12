interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loading({ message = 'Loading...', fullScreen = false }: LoadingProps) {
  const content = (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: 32,
    }}>
      <div style={{
        width: 32, height: 32,
        borderRadius: '50%',
        border: '3px solid rgba(99,102,241,0.2)',
        borderTopColor: 'var(--accent)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ fontSize: 14, color: 'var(--dark-400)' }}>{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(8px)', zIndex: 50,
      }}>
        {content}
      </div>
    );
  }

  return content;
}

export function PageLoading() {
  return <Loading message="Loading..." fullScreen />;
}
