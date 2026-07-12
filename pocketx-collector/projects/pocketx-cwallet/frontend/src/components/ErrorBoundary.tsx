import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '64px 16px', minHeight: '100vh', background: 'var(--dark-950)',
        }}>
          <span style={{ fontSize: 48, marginBottom: 16 }}>⚠️</span>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 8 }}>Something went wrong</h3>
          <p style={{ fontSize: 14, color: 'var(--dark-400)', marginBottom: 24, maxWidth: 360, textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          {this.state.error?.stack && (
            <pre style={{ fontSize: 11, color: 'var(--dark-500)', marginBottom: 16, padding: 12,
              background: 'rgba(0,0,0,0.3)', borderRadius: 8, maxWidth: 600, overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200 }}>
              {this.state.error.stack}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="btn-primary-dark"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
