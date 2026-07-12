import { create } from 'zustand'
import type { ChainId, TokenBalance, NonCustodialWallet, SafeWallet } from '@/types'

interface WalletState {
  balances: TokenBalance[]
  balancesLoading: boolean

  nonCustodialWallets: NonCustodialWallet[]
  safeWallets: SafeWallet[]

  // Actions
  updateBalances: (b: TokenBalance[]) => void
  setBalancesLoading: (l: boolean) => void

  setNonCustodialWallet: (wallet: NonCustodialWallet) => void
  removeNonCustodialWallet: (chainId: ChainId) => void

  setSafeWallet: (wallet: SafeWallet) => void
  removeSafeWallet: (safeAddress: string) => void
  fetchBalances: (chainId: ChainId) => Promise<void>
}

export const useWalletStore = create<WalletState>((set) => ({
  balances: [],
  balancesLoading: false,

  nonCustodialWallets: [],
  safeWallets: [],

  updateBalances: (b) => set({ balances: b }),
  setBalancesLoading: (l) => set({ balancesLoading: l }),

  setNonCustodialWallet: (wallet) =>
    set((state) => ({
      nonCustodialWallets: [...state.nonCustodialWallets.filter((w) => w.chainId !== wallet.chainId), wallet],
    })),

  removeNonCustodialWallet: (chainId) =>
    set((state) => ({
      nonCustodialWallets: state.nonCustodialWallets.filter((w) => w.chainId !== chainId),
    })),

  setSafeWallet: (wallet) =>
    set((state) => ({
      safeWallets: [...state.safeWallets.filter((w) => w.safeAddress !== wallet.safeAddress), wallet],
    })),

  removeSafeWallet: (safeAddress) =>
    set((state) => ({
      safeWallets: state.safeWallets.filter((w) => w.safeAddress !== safeAddress),
    })),

  fetchBalances: async (chainId) => {
    set({ balancesLoading: true })
    try {
      set({ balancesLoading: false })
    } catch {
      set({ balancesLoading: false })
    }
  },
}))
