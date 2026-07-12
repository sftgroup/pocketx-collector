import { env } from '@/env'
import type { ApiResponse } from '@/types'

class ApiClient {
  private baseUrl: string
  private timeout: number

  constructor() {
    this.baseUrl = env.API_BASE_URL
    this.timeout = env.API_TIMEOUT
  }

  private getToken(): string | null {
    try {
      const stored = localStorage.getItem('pocketx_auth')
      if (stored) {
        const session = JSON.parse(stored)
        return session.token
      }
    } catch { /* ignore */ }
    return null
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { signal?: AbortSignal }
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      const token = this.getToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: options?.signal || controller.signal,
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new ApiError(
          errorBody.message || `Request failed: ${response.status}`,
          response.status,
          errorBody.code
        )
      }

      return await response.json()
    } catch (err) {
      if (err instanceof ApiError) throw err
      if ((err as Error).name === 'AbortError') {
        throw new ApiError('Request timeout', 408)
      }
      throw new ApiError((err as Error).message || 'Network error', 0)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  get<T>(path: string, signal?: AbortSignal) {
    return this.request<T>('GET', path, undefined, { signal })
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body)
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body)
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path)
  }

  // ── Chain-agnostic address generation ──
  async generateAddress(chainId: string, userId: string) {
    return this.post<{ address: string; hdPath: string }>('/wallet/create', { chain: chainId, userId })
  }

  async sendVerificationCode(email: string) {
    return this.post<{ sessionId: string }>('/auth/send-code', { email })
  }

  async verifyCode(email: string, code: string, sessionId: string) {
    const res = await this.post<any>('/auth/verify-code', { email, code, sessionId })
    // Map backend response fields to frontend expected format
    return {
      data: {
        userId: res.data.userId,
        token: res.data.accessToken || res.data.token,
        refreshToken: res.data.refreshToken,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
        isNewUser: res.data.isNewUser || false,
        role: res.data.role || 'user',
      },
    }
  }

  // Payment password — set or change (v2)
  async setPaymentPassword(newPassword: string, oldPassword?: string) {
    return this.post<{ success: boolean }>('/auth/set-payment-password', { newPassword, oldPassword })
  }

  // Payment password — check if set
  async getPaymentPasswordStatus() {
    return this.get<{ hasPaymentPassword: boolean }>('/auth/payment-password-status')
  }

  async transfer(params: {
    userId: string; to: string; amount: string; token: string; chainId: string; payPassword: string
  }) {
    return this.post<{ txHash: string; risk?: any }>('/tx/send', params)
  }

  async checkRisk(params: { userId: string; to: string; amount: string; chainId: string }) {
    return this.post<{ level: string; score: number; reasons: string[]; action: string }>(
      '/risk/limits', params
    )
  }

  // ── Balances ──
  async getBalances(userId: string, chainId: string) {
    return this.get<any>(`/wallet/balance?userId=${userId}&chainId=${chainId}`)
  }

  // ── Transactions ──
  async getTransactions(userId: string, params: { page?: number; limit?: number; chainId?: string }) {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.chainId) qs.set('chainId', params.chainId)
    return this.get<{ items: any[]; total: number; page: number; limit: number; hasMore: boolean }>(
      `/wallet/transactions?userId=${userId}&${qs.toString()}`
    )
  }

  // ── Admin Dashboard ──
  async getDashboardStats() {
    return this.get<{
      totalAssets: any; dailyVolume: number; dailyTransactions: number;
      activeUsers: number; totalUsers: number; assetsOverTime: any[]
    }>('/dashboard/summary')
  }

  async getAdminTransactions(params: { page?: number; limit?: number; status?: string }) {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.status) qs.set('status', params.status)
    return this.get<{ items: any[]; total: number }>(`/wallet/transactions?${qs.toString()}`)
  }

  async exportCsv(params: { fromDate?: string; toDate?: string }) {
    const qs = new URLSearchParams()
    if (params.fromDate) qs.set('fromDate', params.fromDate)
    if (params.toDate) qs.set('toDate', params.toDate)
    // TODO: backend has no CSV export endpoint yet
    return this.get<string>(`/dashboard/summary?${qs.toString()}`)
  }

  async batchTransfer(params: { userId: string; transfers: { to: string; amount: string; token: string }[] }) {
    return this.post<{ batchId: string; results: any[] }>('/tx/batch', params)
  }

  async uploadBatchCsv(formData: FormData) {
    return this.request<any>('POST', '/admin/batch-upload', formData)
  }

  async executeBatchTransfer(params: { chainId: string; paymentPassword: string }) {
    return this.post<{ batchId: string; results: any[] }>('/admin/batch-execute', params)
  }

  // ── Safe ──
  async createSafe(params: { owners: string[]; threshold: number; chainId: string }) {
    return this.post<{ safeAddress: string }>('/safe/create', params)
  }

  async proposeSafeTx(params: {
    safeAddress: string; to: string; value: string; data: string; chainId: string
  }) {
    return this.post<{ safeTxHash: string }>('/safe/propose', params)
  }

  async confirmSafeTx(safeAddress: string, safeTxHash: string, signature: string) {
    return this.post<{ success: boolean }>('/safe/confirm', { safeAddress, safeTxHash, signature })
  }

  async executeSafeTx(safeTxHash: string) {
    return this.post<{ txHash: string }>('/safe/execute', { safeTxHash })
  }

  async getSafeTransactions(safeAddress: string) {
    return this.get<{ items: any[] }>(`/safe/${safeAddress}`)
  }

  async getSafeList() {
    return this.get<{ items: any[] }>('/safe/list')
  }

  async updateSafeOwners(safeAddress: string, owners: string[], threshold: number) {
    return this.put<{ owners: string[]; threshold: number }>(`/safe/${safeAddress}/owners`, { owners, threshold })
  }

  // ── SaaS WaaS (F-033~037) ──
  async createTenant(params: { name: string; contactEmail: string; webhookUrl?: string }) {
    return this.post<{ tenantId: string; apiKey: string; apiSecret: string }>('/saas/tenants', params)
  }

  async listTenants(params?: { status?: string; limit?: number; offset?: number }) {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    return this.get<{ items: any[]; total: number }>(`/saas/tenants?${qs.toString()}`)
  }

  async getTenantBalances() {
    return this.get<any>('/dashboard/saas-balances')
  }

  async approveWithdrawal(id: string) {
    return this.post<{ success: boolean }>(`/saas/withdraw/${id}/approve`)
  }

  async getBatchProgress(batchId: string) {
    return this.get<any>(`/tx/batch/${batchId}/progress`)
  }

  async rejectWithdrawal(id: string, reason: string) {
    return this.post<{ success: boolean }>(`/saas/withdraw/${id}/reject`, { reason })
  }

  // ── Transaction Confirmation ──
  async getPendingTransactions() {
    return this.get<any[]>('/tx/pending')
  }

  async confirmTransaction(txId: string, paymentPassword: string) {
    return this.post<{ txId: string; txHash: string; status: string }>(`/tx/${txId}/confirm`, { paymentPassword })
  }

  async rejectTransaction(txId: string) {
    return this.post<{ txId: string; status: string }>(`/tx/${txId}/reject`)
  }
}

export class ApiError extends Error {
  status: number
  code?: number
  constructor(message: string, status: number, code?: number) {
    super(message)
    this.status = status
    this.code = code
    this.name = 'ApiError'
  }
}

export const api = new ApiClient()
