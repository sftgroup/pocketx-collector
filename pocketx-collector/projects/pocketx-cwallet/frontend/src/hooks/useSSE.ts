import { useEffect } from 'react';
import { sseService } from '@/services/sse';
import { useAuthStore } from '@/store/authStore';

/**
 * SSE hook — receives real-time deposit / balance / tx updates
 */
export function useSSE() {
  const { isAuthenticated, session } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !session?.token) return;

    const unsub = sseService.onEvent((event: any) => {
      // Handle different event types
      switch (event.type) {
        case 'deposit':
        case 'balance_update':
        case 'transaction_update':
          // Events handled by sseService internally
          break;
      }
    });

    return () => { unsub(); };
  }, [isAuthenticated, session?.token]);
}
