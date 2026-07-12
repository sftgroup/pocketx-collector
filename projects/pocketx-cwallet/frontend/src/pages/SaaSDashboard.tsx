import { useState, useEffect } from 'react'
import { api } from '@/services/api'

interface Tenant {
  id: string
  name: string
  contact_email: string
  status: 'pending' | 'active' | 'suspended'
  api_key: string
  webhook_url: string | null
  sweep_address: string | null
  sweep_threshold: number
  review_mode: 'manual' | 'auto'
  created_at: string
}

const MODE_BGS: Record<string, string> = {
  active: 'rgba(34,197,94,0.12)',
  pending: 'rgba(234,179,8,0.12)',
  suspended: 'rgba(239,68,68,0.12)',
}

const MODE_COLORS: Record<string, string> = {
  active: '#22c55e',
  pending: '#eab308',
  suspended: '#ef4444',
}

export default function SaaSDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newTenant, setNewTenant] = useState({ name: '', contactEmail: '', webhookUrl: '' })
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState<{ apiKey: string; apiSecret: string } | null>(null)

  const loadTenants = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await api.listTenants()
      setTenants(res.data?.items || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTenants() }, [])

  const handleCreate = async () => {
    if (!newTenant.name || !newTenant.contactEmail) return
    try {
      setCreating(true)
      setError('')
      const res = await api.createTenant({
        name: newTenant.name,
        contactEmail: newTenant.contactEmail,
        webhookUrl: newTenant.webhookUrl || undefined,
      })
      setCreateResult(res.data)
      setShowCreate(false)
      setNewTenant({ name: '', contactEmail: '', webhookUrl: '' })
      loadTenants()
    } catch (err: any) {
      setError(err.message || 'Failed to create tenant')
    } finally {
      setCreating(false)
    }
  }

  const s = styles

  if (loading) {
    return (
      <div style={s.container}>
        <h2 style={s.h1}>SaaS WaaS · Tenants</h2>
        <p style={s.loading}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <h2 style={s.h1}>SaaS WaaS · Tenants</h2>
          <p style={s.subtitle}>
            {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button
          style={s.createBtn}
          onClick={() => setShowCreate(true)}
        >
          + New Tenant
        </button>
      </div>

      {error && (
        <div style={s.error}>
          {error}
          <button style={s.errorClose} onClick={() => setError('')}>×</button>
        </div>
      )}

      {createResult && (
        <div style={s.result}>
          <strong>Tenant Created!</strong>
          <p>API Key: <code>{createResult.apiKey}</code></p>
          <p>API Secret: <code>{createResult.apiSecret}</code></p>
          <p style={{ color: '#ef4444', fontSize: 12 }}>
            ⚠️ Save the API Secret — it won't be shown again!
          </p>
          <button style={s.resultClose} onClick={() => setCreateResult(null)}>×</button>
        </div>
      )}

      {showCreate && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.h3}>Register New Tenant</h3>
            <label style={s.label}>Company Name</label>
            <input
              style={s.input}
              placeholder="Acme Corp"
              value={newTenant.name}
              onChange={e => setNewTenant({ ...newTenant, name: e.target.value })}
            />
            <label style={s.label}>Contact Email</label>
            <input
              style={s.input}
              placeholder="admin@acme.com"
              value={newTenant.contactEmail}
              onChange={e => setNewTenant({ ...newTenant, contactEmail: e.target.value })}
            />
            <label style={s.label}>Webhook URL (optional)</label>
            <input
              style={s.input}
              placeholder="https://acme.com/webhooks/pocketx"
              value={newTenant.webhookUrl}
              onChange={e => setNewTenant({ ...newTenant, webhookUrl: e.target.value })}
            />
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                style={s.submitBtn}
                onClick={handleCreate}
                disabled={creating || !newTenant.name || !newTenant.contactEmail}
              >
                {creating ? 'Creating...' : 'Create Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tenants.length === 0 && !loading ? (
        <div style={s.empty}>
          <p style={{ fontSize: 48 }}>🏢</p>
          <h3>No tenants yet</h3>
          <p>Register your first enterprise customer</p>
        </div>
      ) : (
        <div style={s.grid}>
          {tenants.map(t => (
            <div key={t.id} style={s.card}>
              <div style={s.cardTop}>
                <h4 style={s.cardName}>{t.name}</h4>
                <span style={{
                  ...s.badge,
                  background: MODE_BGS[t.status] || MODE_BGS.active,
                  color: MODE_COLORS[t.status] || MODE_COLORS.active,
                }}>
                  {t.status}
                </span>
              </div>
              <p style={s.cardEmail}>{t.contact_email}</p>
              <div style={s.cardMeta}>
                <div style={s.metaRow}>
                  <span style={s.metaLabel}>API Key</span>
                  <code style={s.metaValue}>{t.api_key.substring(0, 16)}...</code>
                </div>
                <div style={s.metaRow}>
                  <span style={s.metaLabel}>Review Mode</span>
                  <span style={s.metaValue}>{t.review_mode}</span>
                </div>
                <div style={s.metaRow}>
                  <span style={s.metaLabel}>Sweep Threshold</span>
                  <span style={s.metaValue}>{t.sweep_threshold || '—'}</span>
                </div>
                {t.webhook_url && (
                  <div style={s.metaRow}>
                    <span style={s.metaLabel}>Webhook</span>
                    <span style={s.metaValue}>{t.webhook_url.substring(0, 30)}...</span>
                  </div>
                )}
              </div>
              <p style={s.cardDate}>Created {new Date(t.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px 32px',
    maxWidth: 1200,
    margin: '0 auto',
    color: '#e5e7eb',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  h1: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  createBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  error: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 10,
    padding: '12px 16px',
    marginBottom: 16,
    color: '#fca5a5',
    fontSize: 13,
    position: 'relative' as const,
  },
  errorClose: {
    position: 'absolute' as const,
    top: 8, right: 12,
    background: 'none', border: 'none',
    color: '#fca5a5', fontSize: 18,
    cursor: 'pointer',
  },
  result: {
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 10,
    padding: '16px 20px',
    marginBottom: 16,
    color: '#86efac',
    fontSize: 13,
    position: 'relative' as const,
    lineHeight: 1.8,
  },
  resultClose: {
    position: 'absolute' as const,
    top: 8, right: 12,
    background: 'none', border: 'none',
    color: '#86efac', fontSize: 18,
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'rgba(17,17,27,0.95)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 16,
    padding: '28px 32px',
    width: 480,
    maxWidth: '90vw',
  },
  h3: {
    fontSize: 18,
    fontWeight: 600,
    marginTop: 0,
    marginBottom: 20,
    color: '#e5e7eb',
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#e5e7eb',
    fontSize: 14,
    boxSizing: 'border-box' as const,
  },
  modalBtns: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 24,
  },
  cancelBtn: {
    padding: '8px 20px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: 14,
  },
  submitBtn: {
    padding: '8px 20px',
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 14,
    opacity: 1,
  },
  empty: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#6b7280',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: 16,
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: '20px 24px',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
    color: '#e5e7eb',
  },
  badge: {
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
  },
  cardEmail: {
    fontSize: 13,
    color: '#6b7280',
    margin: '0 0 12px',
  },
  cardMeta: {
    borderTop: '1px solid rgba(255,255,255,0.05)',
    paddingTop: 12,
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: 12,
  },
  metaLabel: {
    color: '#6b7280',
  },
  metaValue: {
    color: '#9ca3af',
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  },
  cardDate: {
    fontSize: 11,
    color: '#4b5563',
    marginTop: 12,
    marginBottom: 0,
  },
  loading: {
    textAlign: 'center' as const,
    padding: 40,
    color: '#6b7280',
    fontSize: 14,
  },
}
