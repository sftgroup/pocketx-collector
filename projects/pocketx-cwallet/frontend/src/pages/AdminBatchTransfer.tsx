/**
 * FE-07: Admin Batch Transfer — PocketX Dark Theme
 */

import { useState, useRef, useCallback } from 'react';
import { api } from '@/services/api';
import { Loading } from '@/components/Loading';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { showToast } from '@/components/Toast';
import { shortenAddress } from '@/utils/format';
import type { BatchTransferRecord } from '@/types';

type BatchStep = 'upload' | 'preview' | 'executing' | 'complete';

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

export function AdminBatchTransferPage() {
  const [step, setStep] = useState<BatchStep>('upload');
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<BatchTransferRecord[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [batchId, setBatchId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    setError(null);
    if (!file.name.endsWith('.csv')) { setError('Please upload a CSV file'); return; }
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { setError('CSV must have header and data rows'); return; }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const toIdx = headers.indexOf('to'), amountIdx = headers.indexOf('amount'), tokenIdx = headers.indexOf('token');
      if (toIdx === -1 || amountIdx === -1 || tokenIdx === -1) { setError('CSV must have: to, amount, token'); return; }
      const parsed: BatchTransferRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (!cols[toIdx] || !cols[amountIdx] || !cols[tokenIdx]) continue;
        if (isNaN(parseFloat(cols[amountIdx]))) { setError(`Row ${i}: invalid amount`); return; }
        parsed.push({ index: i - 1, to: cols[toIdx], amount: cols[amountIdx], token: cols[tokenIdx], status: 'pending' });
      }
      if (parsed.length === 0) { setError('No valid records'); return; }
      if (parsed.length > 500) { setError('Max 500 transfers'); return; }
      setRecords(parsed);
      setStep('preview');
      showToast('success', 'CSV parsed', `${parsed.length} transfers loaded`);
    } catch (err: any) { setError(err.message || 'Failed to parse'); }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleExecute = async () => {
    setStep('executing'); setProgress({ current: 0, total: records.length }); setShowConfirm(false);
    const updated = [...records];
    const batchSize = 10;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      try {
        const res = await api.batchTransfer({ userId: 'admin', transfers: batch.map(r => ({ to: r.to, amount: r.amount, token: r.token })) });
        if (res.data?.results) {
          res.data.results.forEach((r: any, j: number) => {
            const idx = i + j;
            if (idx < updated.length) updated[idx] = { ...updated[idx], status: r.status || (r.success ? 'success' : 'failed'), txHash: r.txHash, error: r.error };
          });
        }
        if (res.data?.batchId) {
          setBatchId(res.data.batchId);
          // Poll progress from server
          pollBatchProgress(res.data.batchId, records.length);
        }
      } catch (err: any) {
        batch.forEach((_, j) => { const idx = i + j; if (idx < updated.length) updated[idx] = { ...updated[idx], status: 'failed', error: err.message }; });
      }
      setProgress({ current: Math.min(i + batchSize, records.length), total: records.length });
      setRecords([...updated]);
    }
    setStep('complete');
    const ok = updated.filter(r => r.status === 'success').length;
    const fail = updated.filter(r => r.status === 'failed').length;
    showToast(fail === 0 ? 'success' : 'warning', 'Batch complete', `${ok} ok, ${fail} failed`);
  };

  const pollBatchProgress = async (id: string, total: number) => {
    let attempts = 0;
    const maxAttempts = 30; // poll up to 5 min
    const poll = async () => {
      if (attempts++ >= maxAttempts) return;
      try {
        const rsp = await api.getBatchProgress(id);
        const data = rsp.data as any;
        if (data.progress < 100 && data.status !== 'completed') {
          setProgress({ current: data.succeeded + data.failed, total: data.total || total });
          setTimeout(poll, 5000);
        }
      } catch { /* polling is best-effort */ }
    };
    setTimeout(poll, 3000);
  };

  const handleReset = () => {
    setStep('upload'); setRecords([]); setProgress({ current: 0, total: 0 }); setBatchId(null); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const okCount = records.filter(r => r.status === 'success').length;
  const failCount = records.filter(r => r.status === 'failed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>Batch Transfer</h1>
        <p style={{ fontSize: 14, color: 'var(--dark-400)', marginTop: 4 }}>Send tokens to multiple addresses via CSV upload</p>
      </div>
      <ErrorDisplay error={error} onDismiss={() => setError(null)} />

      {step === 'upload' && (
        <div
          onDragOver={e => e.preventDefault()} onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{ ...cardStyle, padding: 48, textAlign: 'center', border: '2px dashed rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        >
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
          <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>📤</span>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 8 }}>Upload CSV File</h3>
          <p style={{ fontSize: 14, color: 'var(--dark-400)', marginBottom: 16 }}>Drag & drop or click to select</p>
          <div style={{ display: 'inline-block', padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 12, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--dark-300)', textAlign: 'left' }}>
            to,amount,token<br />0x12...,100,USDC<br />0x87...,50,USDC
          </div>
          <p style={{ fontSize: 11, color: 'var(--dark-500)', marginTop: 12 }}>Max 500 rows</p>
        </div>
      )}

      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Preview — {records.length} transfers</h3>
              <span style={{ fontSize: 11, color: 'var(--dark-400)' }}>Review before executing</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleReset} className="btn-secondary-dark">Cancel</button>
              <button onClick={() => setShowConfirm(true)} className="btn-primary-dark">Execute All</button>
            </div>
          </div>
          <div style={{ ...cardStyle, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--dark-400)' }}>#</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--dark-400)' }}>To</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: 'var(--dark-400)' }}>Amount</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: 'var(--dark-400)' }}>Token</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.index} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '10px 16px', color: 'var(--dark-500)', fontSize: 12 }}>{r.index + 1}</td>
                      <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--dark-200)', fontSize: 12 }}>{shortenAddress(r.to, 8)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500, color: 'white' }}>{r.amount}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--dark-300)' }}>{r.token}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 'executing' && (
        <div style={{ ...cardStyle, padding: 40, textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, margin: '0 auto 16px', borderRadius: '50%', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 8 }}>Executing Batch Transfer</h3>
          <p style={{ fontSize: 14, color: 'var(--dark-400)', marginBottom: 16 }}>
            Processing {progress.current} of {progress.total} transfers...
          </p>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: 'linear-gradient(to right, var(--accent), var(--accent-purple))',
              width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
              transition: 'width 0.3s',
            }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--dark-500)', marginTop: 8 }}>
            {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}% complete
          </p>
        </div>
      )}

      {step === 'complete' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...cardStyle, padding: 32, textAlign: 'center' }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>{failCount === 0 ? '✅' : '⚠️'}</span>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 4 }}>Batch Transfer Complete</h3>
            {batchId && <p style={{ fontSize: 11, color: 'var(--dark-400)', marginBottom: 16 }}>Batch ID: {batchId}</p>}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 20 }}>
              <div><p style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-green)' }}>{okCount}</p><p style={{ fontSize: 11, color: 'var(--dark-400)' }}>Success</p></div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
              <div><p style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-red)' }}>{failCount}</p><p style={{ fontSize: 11, color: 'var(--dark-400)' }}>Failed</p></div>
            </div>
            <button onClick={handleReset} className="btn-primary-dark" style={{ margin: '0 auto' }}>New Batch</button>
          </div>
          <div style={{ ...cardStyle, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Transfer Details</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--dark-400)' }}>#</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--dark-400)' }}>To</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, fontWeight: 500, color: 'var(--dark-400)' }}>Amount</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 10, fontWeight: 500, color: 'var(--dark-400)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.index} style={{ borderTop: '1px solid rgba(255,255,255,0.03)', background: r.status === 'failed' ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--dark-500)' }}>{r.index + 1}</td>
                      <td style={{ padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--dark-200)', fontSize: 11 }}>{shortenAddress(r.to, 8)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, color: 'white' }}>{r.amount} {r.token}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}><Badge variant={r.status === 'success' ? 'success' : 'error'}>{r.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title="Confirm Batch Transfer">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--dark-300)' }}>
            You are about to execute <strong style={{ color: 'white' }}>{records.length}</strong> transfers.
            This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setShowConfirm(false)} className="btn-secondary-dark" style={{ flex: 1 }}>Cancel</button>
            <button onClick={handleExecute} className="btn-primary-dark" style={{ flex: 1 }}>Confirm & Execute</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
