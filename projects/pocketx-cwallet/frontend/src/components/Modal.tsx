import { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeWidths: Record<string, string> = { sm: '380px', md: '440px', lg: '520px' };

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        ref={overlayRef}
        onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          animation: 'fade-in 0.2s ease',
        }}
      >
        <div style={{
          background: 'var(--dark-800)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, width: '100%', maxWidth: sizeWidths[size] || '440px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          animation: 'slide-up 0.2s ease',
          overflow: 'hidden',
        }}>
          {title && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>{title}</h2>
              <button
                onClick={onClose}
                style={{
                  padding: 6, borderRadius: 8, color: 'var(--dark-400)',
                  cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--dark-400)'; }}
              >
                ✕
              </button>
            </div>
          )}
          <div style={{ padding: '16px 24px' }}>{children}</div>
        </div>
      </div>
    </>
  );
}
