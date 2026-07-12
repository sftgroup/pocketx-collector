/**
 * Environment configuration - all values from env vars, no hardcoding.
 */
function getEnv(key: string, fallback: string = ''): string {
  return (import.meta as any).env?.[key] ?? fallback;
}

export const env = {
  API_BASE_URL: getEnv('VITE_API_BASE_URL', 'http://localhost:8080'),
  API_TIMEOUT: parseInt(getEnv('VITE_API_TIMEOUT', '30000'), 10),
  SSE_URL: getEnv('VITE_SSE_URL', 'http://localhost:8080/api/v2/events/stream'),
  SSE_TOKEN_URL: getEnv('VITE_SSE_TOKEN_URL', 'http://localhost:8080/api/v2/events/token'),
  SUPPORTED_CHAINS: getEnv('VITE_SUPPORTED_CHAINS', 'solana,bnb,sepolia').split(','),
  DEFAULT_CHAIN: getEnv('VITE_DEFAULT_CHAIN', 'sepolia'),
  SOLANA_RPC_URL: getEnv('VITE_SOLANA_RPC_URL', 'https://api.devnet.solana.com'),
  BNB_RPC_URL: getEnv('VITE_BNB_RPC_URL', 'https://bsc-testnet.publicnode.com'),
  SAFE_API_URL: getEnv('VITE_SAFE_API_URL', 'https://safe-transaction.staging.5afe.dev'),
  ENABLE_CUSTODIAL: getEnv('VITE_ENABLE_CUSTODIAL', 'true') === 'true',
  ENABLE_SAFE: getEnv('VITE_ENABLE_SAFE', 'true') === 'true',
  ENABLE_GAS_SPONSOR: getEnv('VITE_ENABLE_GAS_SPONSOR', 'true') === 'true',
  ENABLE_ADMIN: getEnv('VITE_ENABLE_ADMIN', 'true') === 'true',
  APP_NAME: getEnv('VITE_APP_NAME', 'PocketX'),
  APP_VERSION: getEnv('VITE_APP_VERSION', '2.0.0'),
} as const;
