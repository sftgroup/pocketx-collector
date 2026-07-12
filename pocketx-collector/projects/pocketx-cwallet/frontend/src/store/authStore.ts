import { create } from 'zustand'
import { api } from '@/services/api'
import { sseService } from '@/services/sse'
import type { AuthSession, ChainId, WalletMode } from '@/types'
import { env } from '@/env'

interface AuthState {
  session: AuthSession | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  isAdmin: boolean

  walletMode: WalletMode
  activeChainId: ChainId

  setWalletMode: (mode: WalletMode) => void
  setActiveChainId: (chainId: ChainId) => void

  sendCode: (email: string) => Promise<{ sessionId: string }>
  verifyCode: (email: string, code: string, sessionId: string) => Promise<void>
  setPayPassword: (password: string) => Promise<void>
  logout: () => void
  clearError: () => void
  restoreSession: () => void
}

const AUTH_STORAGE_KEY = 'pocketx_auth'
const MODE_STORAGE_KEY = 'pocketx_wallet_mode'
const CHAIN_STORAGE_KEY = 'pocketx_active_chain'

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  get isAdmin() { return get().session?.role === 'admin'; },
  walletMode: (localStorage.getItem(MODE_STORAGE_KEY) as WalletMode) || 'hd',
  activeChainId: (localStorage.getItem(CHAIN_STORAGE_KEY) as ChainId) || (env.DEFAULT_CHAIN as ChainId),

  setWalletMode: (mode) => {
    localStorage.setItem(MODE_STORAGE_KEY, mode)
    set({ walletMode: mode })
  },

  setActiveChainId: (chainId) => {
    localStorage.setItem(CHAIN_STORAGE_KEY, chainId)
    set({ activeChainId: chainId })
  },

  sendCode: async (email) => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.sendVerificationCode(email)
      set({ isLoading: false })
      if (res.code !== 0) {
        throw new Error(res.message || 'Failed to send verification code')
      }
      return res.data || (res as any).sessionId
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
      throw err
    }
  },

  verifyCode: async (email, code, sessionId) => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.verifyCode(email, code, sessionId)
      const session: AuthSession = {
        userId: res.data.userId,
        email,
        token: res.data.token,
        refreshToken: res.data.refreshToken,
        expiresAt: res.data.expiresAt,
        role: res.data.role || 'user',
      }
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
      sseService.connect(session.token)
      set({ session, isAuthenticated: true, isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
      throw err
    }
  },

  setPayPassword: async (password) => {
    set({ isLoading: true, error: null })
    try {
      await api.setPaymentPassword(password)
      set({ isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
      throw err
    }
  },

  logout: () => {
    sseService.disconnect()
    localStorage.removeItem(AUTH_STORAGE_KEY)
    set({ session: null, isAuthenticated: false, error: null })
  },

  clearError: () => set({ error: null }),

  restoreSession: () => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (stored) {
        const session = JSON.parse(stored) as AuthSession
        if (session.expiresAt > Date.now()) {
          set({ session, isAuthenticated: true, isLoading: false })
          sseService.connect(session.token)
          return;
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY)
        }
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
    set({ isLoading: false })
  },
}))
