import { env } from '@/env'
import type { SSEEvent } from '@/types'

type SSECallback = (event: SSEEvent) => void
type SSEErrorCallback = (error: Event) => void

export class SSEService {
  private eventSource: EventSource | null = null
  private listeners: Set<SSECallback> = new Set()
  private errorListeners: Set<SSEErrorCallback> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private jwtToken: string | null = null
  private sseToken: string | null = null

  /**
   * Connect to SSE stream.
   * Acquires a short-lived SSE token first (not JWT) to avoid leaking
   * the long-lived JWT in URL query params (proxy logs, browser history).
   */
  async connect(jwt: string): Promise<void> {
    this.jwtToken = jwt
    await this.fetchSSEToken()
    this.doConnect()
  }

  /** Fetch a one-time-use SSE token via authenticated API call */
  private async fetchSSEToken(): Promise<void> {
    try {
      const resp = await fetch(`${env.SSE_TOKEN_URL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.jwtToken}`,
        },
      })
      if (!resp.ok) {
        console.error('[SSE] Failed to fetch SSE token:', resp.status)
        return
      }
      const data = await resp.json()
      if (data.code === 0 && data.data?.token) {
        this.sseToken = data.data.token
        console.log('[SSE] Acquired SSE token, expires in', data.data.expiresIn, 's')
      }
    } catch (err) {
      console.error('[SSE] SSE token fetch error:', err)
    }
  }

  private doConnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
    }

    // SSE token is one-time-use — if we reconnect, fetch a new one
    // Fall back to new fetch if sseToken is null
    const token = this.sseToken
    if (!token) {
      console.warn('[SSE] No SSE token, reconnecting with fresh token')
      this.fetchSSEToken().then(() => {
        if (this.sseToken) this.doConnect()
      })
      return
    }

    const url = `${env.SSE_URL}?token=${encodeURIComponent(token)}`
    this.eventSource = new EventSource(url)

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0
    }

    this.eventSource.addEventListener('deposit', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent
        this.notify(data)
      } catch (err) {
        console.error('[SSE] Failed to parse deposit event:', err)
      }
    })

    this.eventSource.addEventListener('balance_update', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent
        this.notify(data)
      } catch (err) {
        console.error('[SSE] Failed to parse balance_update event:', err)
      }
    })

    this.eventSource.addEventListener('transaction_update', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent
        this.notify(data)
      } catch (err) {
        console.error('[SSE] Failed to parse transaction_update event:', err)
      }
    })

    this.eventSource.onerror = (event: Event) => {
      this.errorListeners.forEach((cb) => cb(event))
      this.tryReconnect()
    }
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[SSE] Max reconnect attempts reached')
      return
    }
    this.reconnectAttempts++
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000)
    setTimeout(() => {
      if (this.jwtToken) {
        this.fetchSSEToken().then(() => {
          this.doConnect()
        })
      }
    }, delay)
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.jwtToken = null
    this.sseToken = null
    this.reconnectAttempts = 0
  }

  onEvent(callback: SSECallback): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  onError(callback: SSEErrorCallback): () => void {
    this.errorListeners.add(callback)
    return () => {
      this.errorListeners.delete(callback)
    }
  }

  private notify(event: SSEEvent): void {
    this.listeners.forEach((cb) => {
      try {
        cb(event)
      } catch (err) {
        console.error('[SSE] Listener error:', err)
      }
    })
  }
}

export const sseService = new SSEService()
