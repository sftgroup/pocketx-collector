/**
 * Contract addresses for PocketX v2.0
 * All addresses should come from environment variables or deployment config.
 * No hardcoded addresses in components.
 */

import { env } from '@/env'
import type { ChainId } from '@/types'

interface ContractAddresses {
  // Token contracts
  usdc?: string
  usdt?: string

  // Protocol contracts
  safeFactory?: string
  safeSingleton?: string

  // Custodial
  custodialManager?: string
  gasTank?: string
}

type AddressMap = Partial<Record<ChainId, ContractAddresses>>

// FIXME: Replace with actual deployed contract addresses from deployment config
const DEFAULT_ADDRESSES: AddressMap = {
  solana: {
    usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    usdt: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
  bnb: {
    usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    usdt: '0x55d398326f99059fF775485246999027B3197955',
    safeFactory: '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2',
    safeSingleton: '0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552',
  },
}

/**
 * Get contract addresses for a specific chain.
 * Falls back to defaults, then empty object.
 */
export function getContractAddresses(chainId: ChainId): ContractAddresses {
  return DEFAULT_ADDRESSES[chainId] || {}
}

/**
 * Get a specific contract address.
 */
export function getContractAddress(chainId: ChainId, contract: keyof ContractAddresses): string | undefined {
  return getContractAddresses(chainId)[contract]
}
