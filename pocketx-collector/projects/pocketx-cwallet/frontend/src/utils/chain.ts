import type { ChainId, ChainInfo } from '@/types'
import { env } from '@/env'

// Sepolia (Ethereum-based) chain config for DApp deployment
export const CHAIN_CONFIGS: Record<ChainId, ChainInfo> = {
  solana: {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    icon: '/chains/solana.svg',
    rpcUrl: env.SOLANA_RPC_URL,
    explorerUrl: 'https://explorer.solana.com',
    nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
  },
  bnb: {
    id: 'bnb',
    name: 'BNB Chain',
    symbol: 'BNB',
    icon: '/chains/bnb.svg',
    rpcUrl: env.BNB_RPC_URL,
    explorerUrl: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  },
  sepolia: {
    id: 'sepolia',
    name: 'Sepolia',
    symbol: 'ETH',
    icon: '/chains/eth.svg',
    rpcUrl: 'https://sepolia.infura.io/v3/6533af1da2b743a9b79cb9733e034217',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
  },
}

export function getChainInfo(chainId: ChainId): ChainInfo {
  return CHAIN_CONFIGS[chainId]
}

export function getChains(): ChainInfo[] {
  return env.SUPPORTED_CHAINS
    .filter((id): id is ChainId => id === 'solana' || id === 'bnb' || id === 'sepolia')
    .map((id) => CHAIN_CONFIGS[id])
    .filter(Boolean)  // safety: skip any unmatched chain id
}
