// ============================================================================
// Core Domain Types for PocketX v2.0
// ============================================================================

/* ─── Wallet Modes ─── */
export type WalletMode = 'non-custodial' | 'custodial' | 'safe';

export interface WalletModeOption {
  id: WalletMode;
  label: string;
  description: string;
  icon: string;
  disabled?: boolean;
}

/* ─── Chains ─── */
export type ChainId = 'solana' | 'bnb' | 'sepolia';

export interface ChainInfo {
  id: ChainId;
  name: string;
  symbol: string;
  icon: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

/* ─── Tokens ─── */
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: ChainId;
  logoURI?: string;
  priceUsd?: number;
}

export interface TokenBalance extends TokenInfo {
  balance: string;
  balanceFormatted: string;
  usdValue?: number;
}

/* ─── Wallets ─── */
export interface CustodialWallet {
  id: string;
  chainId: string;
  address: string;
  balance: string;
  balanceFormatted: string;
  encryptedKey?: string;
}

export interface NonCustodialWallet {
  type: 'hd';
  chainId: ChainId;
  address: string;
  derivationPath: string;
  connected: boolean;
}

export interface SafeWallet {
  type: 'safe';
  safeAddress: string;
  chainId: ChainId;
  owners: string[];
  threshold: number;
  nonce: number;
  version: string;
  deployed: boolean;
}

export type Wallet = NonCustodialWallet | CustodialWallet | SafeWallet;

/* ─── Transactions ─── */
export type TransactionStatus = 'pending' | 'confirming' | 'confirmed' | 'failed' | 'reverted';
export type TransactionType = 'send' | 'receive' | 'swap' | 'approve' | 'safe_submit' | 'safe_confirm' | 'safe_execute';

export interface Transaction {
  hash: string;
  chainId: ChainId;
  type: TransactionType;
  from: string;
  to: string;
  value: string;
  token?: TokenInfo;
  status: TransactionStatus;
  timestamp: number;
  gasUsed?: string;
  gasPrice?: string;
  fee?: string;
  memo?: string;
}

/* ─── Risk Control ─── */
export interface RiskResult {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  reasons: string[];
  action: 'allow' | 'require_approval' | 'block';
}

/* ─── Auth ─── */
export interface AuthSession {
  userId: string;
  email: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
  role?: string;
}

export interface VerificationCodePayload {
  email: string;
  code: string;
  sessionId: string;
}

/* ─── Safe: Multisig Transactions ─── */
export interface SafeTransactionProposal {
  safeAddress: string;
  to: string;
  value: string;
  data: string;
  operation: 0 | 1;
  safeTxGas: number;
  baseGas: number;
  gasPrice: string;
  gasToken: string;
  refundReceiver: string;
  nonce: number;
}

export interface SafeTransactionEntry {
  safeTxHash: string;
  proposer: string;
  confirmations: SafeConfirmation[];
  executed: boolean;
  executedAt?: number;
  txHash?: string;
  proposal: SafeTransactionProposal;
  status: 'pending' | 'confirmed' | 'executed' | 'failed';
}

export interface SafeConfirmation {
  owner: string;
  signature: string;
  submittedAt: number;
}

/* ─── Admin Dashboard ─── */
export interface DashboardStats {
  totalAssets: { [chainId: string]: { token: string; amount: string; usdValue: number } };
  dailyVolume: number;
  dailyTransactions: number;
  activeUsers: number;
  totalUsers: number;
  assetsOverTime: AssetSnapshot[];
}

export interface AssetSnapshot {
  date: string;
  totalUsd: number;
}

export interface BatchTransferRecord {
  index: number;
  to: string;
  amount: string;
  token: string;
  status: 'pending' | 'success' | 'failed';
  txHash?: string;
  error?: string;
}

/* ─── SSE Event Types ─── */
export interface DepositEvent {
  type: 'deposit';
  userId: string;
  chainId: ChainId;
  txHash: string;
  from: string;
  to: string;
  token: TokenInfo;
  amount: string;
  amountFormatted: string;
  usdValue?: number;
  timestamp: number;
}

export interface BalanceUpdateEvent {
  type: 'balance_update';
  userId: string;
  chainId: ChainId;
  balances: TokenBalance[];
}

export interface TransactionUpdateEvent {
  type: 'transaction_update';
  userId: string;
  txHash: string;
  status: TransactionStatus;
}

export type SSEEvent = DepositEvent | BalanceUpdateEvent | TransactionUpdateEvent;

/* ─── UI States ─── */
export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

export interface PaginationParams {
  page: number;
  limit: number;
  total?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/* ─── API Response ─── */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}
