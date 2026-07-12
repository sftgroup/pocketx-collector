import { useAuthStore } from '@/store/authStore';
import { getChains, getChainInfo } from '@/utils/chain';
import type { ChainId } from '@/types';

interface ChainSelectorProps {
  className?: string;
  onChange?: (chainId: ChainId) => void;
}

const chainDotColors: Record<string, string> = {
  solana: '#8b5cf6',
  bnb: '#f59e0b',
  ethereum: '#3b82f6',
  polygon: '#8b5cf6',
};

export function ChainSelector({ onChange }: ChainSelectorProps) {
  const { activeChainId, setActiveChainId } = useAuthStore();
  const chains = getChains();

  const handleChange = (chainId: ChainId) => {
    setActiveChainId(chainId);
    onChange?.(chainId);
  };

  if (chains.length <= 1) {
    const chain = getChainInfo(chains[0]?.id || 'solana');
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--dark-400)', marginBottom: 16 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: chainDotColors[chain.id] || 'var(--accent)',
        }} />
        <span>{chain.name}</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', borderRadius: 12, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.05)',
      marginBottom: 16,
    }}>
      {chains.map((chain) => {
        const isActive = activeChainId === chain.id;
        return (
          <button
            key={chain.id}
            onClick={() => handleChange(chain.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', fontSize: 12, fontWeight: 500,
              background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--dark-400)',
              borderRight: '1px solid rgba(255,255,255,0.05)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isActive ? 'var(--accent)' : chainDotColors[chain.id] || 'var(--dark-500)',
            }} />
            {chain.name}
          </button>
        );
      })}
    </div>
  );
}
