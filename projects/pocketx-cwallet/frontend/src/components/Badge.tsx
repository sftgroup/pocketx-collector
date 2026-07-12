interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

const baseStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '3px 10px', borderRadius: 9999,
  fontSize: 11, fontWeight: 500, lineHeight: '16px',
};

const variantStyles: Record<string, React.CSSProperties> = {
  success: { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' },
  warning: { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' },
  error: { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' },
  info: { background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' },
  neutral: { background: 'rgba(255,255,255,0.05)', color: '#a0a0a0', border: '1px solid rgba(255,255,255,0.05)' },
};

export function Badge({ variant = 'neutral', children, style }: BadgeProps) {
  return (
    <span style={{ ...baseStyle, ...variantStyles[variant], ...style }}>
      {children}
    </span>
  );
}
