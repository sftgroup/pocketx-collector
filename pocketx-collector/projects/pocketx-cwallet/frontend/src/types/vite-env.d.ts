/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_TIMEOUT: string
  readonly VITE_SSE_URL: string
  readonly VITE_SUPPORTED_CHAINS: string
  readonly VITE_DEFAULT_CHAIN: string
  readonly VITE_SOLANA_RPC_URL: string
  readonly VITE_BNB_RPC_URL: string
  readonly VITE_SAFE_API_URL: string
  readonly VITE_ENABLE_CUSTODIAL: string
  readonly VITE_ENABLE_SAFE: string
  readonly VITE_ENABLE_GAS_SPONSOR: string
  readonly VITE_ENABLE_ADMIN: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
