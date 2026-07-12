interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 16px', textAlign: 'center',
    }}>
      <span style={{ fontSize: 48, marginBottom: 16 }}>{icon}</span>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark-200)', marginBottom: 4 }}>{title}</h3>
      {description && (
        <p style={{ fontSize: 14, color: 'var(--dark-400)', marginBottom: 16, maxWidth: 360 }}>{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary-dark"
          style={{ marginTop: 8 }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
