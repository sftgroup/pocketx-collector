import crypto from 'crypto';
import axios from 'axios';
import { config } from '../config';
import { pool } from '../models/database';
import { logger } from '../utils/logger';
import { Errors } from '../utils/errors';
import { generateId } from '../utils/helpers';
import { deriveAddressForChain, getHDMnemonic, getPrivateKey } from './hdWalletService';
import { encryptPrivateKey } from './encryptionService';


interface CWalletBalanceResponse {
  chain: string;
  address: string;
  balances: Array<{
    token: string;
    token_address: string;
    balance: string;
    usd_value?: string;
  }>;
}

/**
 * Create a new custodial wallet for a user
 * Communicates with CWallet HSM service to generate HD wallet address
 */
export async function createCustodialWallet(
  userId: string,
  chain: string
): Promise<{ id: string; address: string; chain: string }> {
  if (!config.supportedChains.includes(chain)) {
    throw Errors.paramError(`Unsupported chain: ${chain}`);
  }

  const existing = await pool.query(
    'SELECT id, address, chain FROM custodial_wallets WHERE user_id = $1 AND chain = $2',
    [userId, chain]
  );
  if (existing.rows.length > 0) {
    const w = existing.rows[0];
    return { id: w.id, address: w.address, chain: w.chain };
  }

  const namespace = crypto.createHash('sha256').update(`${userId}:${chain}:pocketx`).digest();
  const userIndex = namespace.readUInt32BE(0) & 0x7FFFFFFF;
  const mnemonic = getHDMnemonic();
  const { address, derivationPath } = deriveAddressForChain(userIndex, chain);
  const privateKey = getPrivateKey(mnemonic, derivationPath);
  const encryptedKey = encryptPrivateKey(privateKey);

  const walletId = generateId();
  await pool.query(
    `INSERT INTO custodial_wallets (id, user_id, chain, address, encrypted_key)
     VALUES ($1, $2, $3, $4, $5)`,
    [walletId, userId, chain, address, encryptedKey]
  );

  await pool.query(
    'UPDATE users SET hd_wallet_id = COALESCE(hd_wallet_id, $1) WHERE id = $2',
    [walletId, userId]
  );

  logger.info('Custodial wallet created', { userId, chain, address, walletId });
  return { id: walletId, address, chain };
}

/**
 * Import existing HD wallet (user provides HD path)
 */
export async function importCustodialWallet(
  userId: string,
  chain: string,
  hdPath: string
): Promise<{ id: string; address: string; chain: string }> {
  if (!config.supportedChains.includes(chain)) {
    throw Errors.paramError(`Unsupported chain: ${chain}`);
  }

  const existing = await pool.query(
    'SELECT id, address FROM custodial_wallets WHERE user_id = $1 AND chain = $2',
    [userId, chain]
  );
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, address: existing.rows[0].address, chain };
  }

  const walletId = generateId();
  await pool.query(
    `INSERT INTO custodial_wallets (id, user_id, chain, address)
     VALUES ($1, $2, $3, $4)`,
    [walletId, userId, chain, hdPath]
  );

  logger.info('Custodial wallet imported', { userId, chain, hdPath, walletId });
  return { id: walletId, address: hdPath, chain };
}

/**
 * Get deposit/payment address for a user on a specific chain
 */
export async function getWalletAddress(userId: string, chain: string): Promise<string> {
  const result = await pool.query(
    'SELECT address FROM custodial_wallets WHERE user_id = $1 AND chain = $2',
    [userId, chain]
  );

  if (result.rows.length > 0) {
    return result.rows[0].address;
  }

  const derived = deriveAddressForChain(0, chain);
  return derived.address;
}

/**
 * Get aggregated balance across all chains
 */
export async function getAggregatedBalance(userId: string): Promise<{
  chainBalances: Array<{ chain: string; address: string; balances: any[]; usdTotal: string; error?: string }>;
  totalUsd: string;
}> {
  const wallets = await pool.query(
    'SELECT id, chain, address FROM custodial_wallets WHERE user_id = $1',
    [userId]
  );

  if (wallets.rows.length === 0) {
    return { chainBalances: [], totalUsd: '0' };
  }

  const chainBalances: Array<{ chain: string; address: string; balances: any[]; usdTotal: string; error?: string }> = [];
  let totalUsd = 0;

  for (const wallet of wallets.rows) {
    try {
      const resp = await axios.get(
        `${config.cwallet.baseUrl}/balance?chain=${wallet.chain}&address=${wallet.address}`,
        {
          headers: { 'x-api-key': config.cwallet.apiKey },
          timeout: 10000,
        }
      );
      const data: CWalletBalanceResponse = resp.data;
      const chainTotal = data.balances.reduce(
        (sum, b) => sum + parseFloat(b.usd_value || '0'),
        0
      );
      totalUsd += chainTotal;
      const localTotal = data.balances.reduce(
        (sum: number, b: any) => sum + parseFloat(b.balance || '0'),
        0
      );
      await pool.query(
        'UPDATE custodial_wallets SET balance = $1 WHERE id = $2',
        [localTotal.toFixed(18), wallet.id]
      ).catch(() => {});

      chainBalances.push({
        chain: wallet.chain,
        address: wallet.address,
        balances: data.balances,
        usdTotal: chainTotal.toFixed(2),
      });
    } catch (err: any) {
      logger.warn('Failed to fetch balance', { chain: wallet.chain, error: err.message });
      chainBalances.push({
        chain: wallet.chain, address: wallet.address,
        balances: [], usdTotal: '0', error: 'CWallet API unavailable',
      });
    }
  }

  return { chainBalances, totalUsd: totalUsd.toFixed(2) };
}

/**
 * Get transaction history for user's wallets
 */
export async function getTransactionHistory(
  userId: string,
  offset: number,
  limit: number
): Promise<{ items: any[]; total: number }> {
  const countResult = await pool.query(
    `SELECT COUNT(*)::int as total FROM transactions t
     JOIN custodial_wallets w ON t.wallet_id = w.id
     WHERE w.user_id = $1`,
    [userId]
  );
  const total = countResult.rows[0].total;

  const result = await pool.query(
    `SELECT t.*, w.chain, w.address as wallet_address
     FROM transactions t
     JOIN custodial_wallets w ON t.wallet_id = w.id
     WHERE w.user_id = $1
     ORDER BY t.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return { items: result.rows, total };
}

/**
 * Get HD wallet detail + tokens for a specific chain
 */
export async function getWalletDetail(userId: string, chainId: string): Promise<{
  walletId: string;
  chainId: number;
  address: string;
  tokens: Array<{
    assetId: string;
    symbol: string;
    name: string;
    chainId: number;
    balance: string;
    balanceFormatted: string;
    usdValue?: number;
  }>;
} | null> {
  // Accept both numeric chain ID and string chain name
  const chainIdNum = parseInt(chainId, 10);
  const chainName = isNaN(chainIdNum) ? chainId.toLowerCase() : String(chainIdNum);

  const addr = await pool.query(
    'SELECT id, address FROM custodial_wallets WHERE user_id = $1 AND chain = $2 LIMIT 1',
    [userId, chainName]
  );

  let walletId: string;
  let address: string;
  if (addr.rows.length > 0) {
    walletId = addr.rows[0].id;
    address = addr.rows[0].address;
  } else {
    try {
      const derived = deriveAddressForChain(0, chainName);
      walletId = '';
      address = derived.address;
    } catch {
      return null;
    }
  }

  return {
    walletId,
    chainId: isNaN(chainIdNum) ? 11155111 : chainIdNum, // default Sepolia
    address,
    tokens: [],
  };
}
