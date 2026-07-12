import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { pool } from '../models/database';
import { logger } from '../utils/logger';
import { Errors } from '../utils/errors';
import { getTenant } from './tenantService';
import { scanBlock, processDeposits } from './scannerService';
import { deriveAddressForChain, getHDMnemonic, getPrivateKey } from './hdWalletService';
import { encryptPrivateKey } from './encryptionService';
import { calculateFee } from './feeService';

/**
 * SaaS WaaS Service (F-034~037, L-018~022)
 * Address pool allocation, auto-sweep, withdrawal review
 */

/**
 * Allocate a unique on-chain address for a tenant's external user (L-019)
 * Same external_user_id always returns the same address (idempotent)
 */
export async function allocateAddress(params: {
  tenantId: string;
  externalUserId: string;
  chain: string;
  label?: string;
}): Promise<{
  address: string;
  chain: string;
  externalUserId: string;
  isNew: boolean;
}> {
  const { tenantId, externalUserId, chain, label } = params;

  if (!tenantId || !externalUserId || !chain) {
    throw Errors.paramError('Missing required fields: tenantId, externalUserId, chain');
  }

  // Check if address already exists for this tenant + chain + externalUserId
  const existing = await pool.query(
    'SELECT * FROM address_pool WHERE tenant_id = $1 AND chain = $2 AND external_user_id = $3',
    [tenantId, chain, externalUserId]
  );

  if (existing.rows.length > 0) {
    const addr = existing.rows[0];
    return {
      address: addr.address,
      chain: addr.chain,
      externalUserId: addr.external_user_id,
      isNew: false,
    };
  }

  // Generate new address via CWallet HD wallet (BIP44 deterministic derivation)
  // Use hash of externalUserId as deterministic user_index (same as CWallet's uuid5)
  const namespace = crypto.createHash('sha256').update(`cwallet:${tenantId}:${externalUserId}`).digest();
  const userIndex = namespace.readUInt32BE(0) & 0x7FFFFFFF;
  const mnemonic = getHDMnemonic();
  const { address, derivationPath } = deriveAddressForChain(userIndex, chain);
  const privateKey = getPrivateKey(mnemonic, derivationPath);
  const encryptedKey = encryptPrivateKey(privateKey);

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO address_pool (id, tenant_id, external_user_id, label, chain, address, encrypted_key, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
      [uuidv4(), tenantId, externalUserId, label || null, chain, address, encryptedKey]
    );

    logger.info('Address allocated', { tenantId, externalUserId, chain, address });
    return { address, chain, externalUserId, isNew: true };
  } finally {
    client.release();
  }
}

/**
 * Get address details for a tenant's external user
 */
export async function getAddress(tenantId: string, externalUserId: string): Promise<any> {
  const result = await pool.query(
    `SELECT a.*, COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'confirmed' AND t.from_address != a.address), 0) AS total_deposits
     FROM address_pool a
     LEFT JOIN transactions t ON t.to_address = a.address
     WHERE a.tenant_id = $1 AND a.external_user_id = $2
     GROUP BY a.id`,
    [tenantId, externalUserId]
  );

  if (result.rows.length === 0) {
    throw Errors.notFound('Address');
  }

  return result.rows[0];
}

/**
 * List all addresses for a tenant
 */
export async function listAddresses(params: {
  tenantId: string;
  status?: string;
  chain?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: any[]; total: number }> {
  const { tenantId, status, chain, limit = 50, offset = 0 } = params;

  const conditions = ['tenant_id = $1'];
  const values: any[] = [tenantId];
  let idx = 2;

  if (status) {
    conditions.push(`status = $${idx++}`);
    values.push(status);
  }
  if (chain) {
    conditions.push(`chain = $${idx++}`);
    values.push(chain);
  }

  const where = ' WHERE ' + conditions.join(' AND ');

  const result = await pool.query(
    `SELECT * FROM address_pool${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset]
  );

  const count = await pool.query(
    `SELECT COUNT(*)::int as cnt FROM address_pool${where}`,
    values
  );

  return { items: result.rows, total: count.rows[0].cnt };
}

/**
 * Execute auto-sweep: move funds from user addresses to tenant's sweep address (L-020)
 */
export async function sweepTenantFunds(tenantId: string): Promise<{
  swept: number;
  totalAmount: string;
}> {
  const tenant = await getTenant(tenantId);

  if (!tenant.sweep_address || !tenant.sweep_threshold) {
    throw Errors.paramError('Tenant sweep not configured (missing sweep_address or sweep_threshold)');
  }

  // Find all addresses with balance above threshold
  const result = await pool.query(
    `SELECT a.id, a.address, a.chain,
            COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'confirmed' AND t.from_address != a.address), 0) -
            COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'confirmed' AND t.from_address = a.address), 0)
            AS net_balance
     FROM address_pool a
     LEFT JOIN transactions t ON t.to_address = a.address OR t.from_address = a.address
     WHERE a.tenant_id = $1 AND a.status = 'active'
     GROUP BY a.id
     HAVING COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'confirmed' AND t.from_address != a.address), 0) -
            COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'confirmed' AND t.from_address = a.address), 0) >= $2`,
    [tenantId, tenant.sweep_threshold]
  );

  if (result.rows.length === 0) {
    return { swept: 0, totalAmount: '0' };
  }

  let totalSwept = 0;
  let totalAmount = 0;

  for (const row of result.rows) {
    const sweepId = uuidv4();
    const netBalance = parseFloat(row.net_balance);

    await pool.query(
      `INSERT INTO sweep_records (id, tenant_id, from_address, to_address, token, amount, status)
       VALUES ($1, $2, $3, $4, '*', $5, 'pending')`,
      [sweepId, tenantId, row.address, tenant.sweep_address, netBalance]
    );

    logger.info('Sweep queued', {
      tenantId,
      from: row.address,
      to: tenant.sweep_address,
      amount: netBalance,
    });

    totalSwept++;
    totalAmount += netBalance;
  }

  return { swept: totalSwept, totalAmount: totalAmount.toFixed(6) };
}

/**
 * Create a SaaS withdrawal request (L-021/022)
 */
export async function createWithdrawal(params: {
  tenantId: string;
  externalUserId: string;
  toAddress: string;
  token: string;
  amount: string;
}): Promise<{ id: string; status: string; reviewRequired: boolean }> {
  const { tenantId, externalUserId, toAddress, token, amount } = params;

  if (!tenantId || !externalUserId || !toAddress || !amount) {
    throw Errors.paramError('Missing required fields: tenantId, externalUserId, toAddress, amount');
  }

  // Get source address
  const addrResult = await pool.query(
    'SELECT address FROM address_pool WHERE tenant_id = $1 AND external_user_id = $2 AND status = $3',
    [tenantId, externalUserId, 'active']
  );

  if (addrResult.rows.length === 0) {
    throw Errors.notFound('Address for this external_user_id');
  }

  const tenant = await getTenant(tenantId);
  const reviewRequired = tenant.review_mode === 'manual';
  const status = reviewRequired ? 'pending_review' : 'processing';

  // Calculate fee via feeService (CWallet-compatible)
  const { fee, actualAmount, feeType } = await calculateFee(token || '*', amount);

  // Check min/max withdrawal limits
  const tokenResult = await pool.query(
    'SELECT min_withdraw, max_withdraw FROM tokens WHERE symbol = $1 AND enabled = true LIMIT 1',
    [token || '*']
  );
  if (tokenResult.rows.length > 0) {
    const minW = parseFloat(tokenResult.rows[0].min_withdraw || '0');
    const maxW = parseFloat(tokenResult.rows[0].max_withdraw || '0');
    if (minW > 0 && parseFloat(amount) < minW) {
      throw Errors.paramError(`Minimum withdrawal is ${minW} ${token || '*'}`);
    }
    if (maxW > 0 && parseFloat(amount) > maxW) {
      throw Errors.paramError(`Maximum withdrawal is ${maxW} ${token || '*'}`);
    }
  }

  if (parseFloat(actualAmount) <= 0) {
    throw Errors.paramError('Amount too small — fee exceeds withdrawal amount');
  }

  const withdrawalId = uuidv4();
  await pool.query(
    `INSERT INTO saas_withdrawals (id, tenant_id, external_user_id, from_address, to_address, token, amount, fee, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [withdrawalId, tenantId, externalUserId, addrResult.rows[0].address, toAddress, token || '*', amount, status]
  );

  // Fix: add fee to INSERT
  await pool.query(
    'UPDATE saas_withdrawals SET fee = $1 WHERE id = $2',
    [fee, withdrawalId]
  );

  logger.info('Withdrawal created', { id: withdrawalId, tenantId, externalUserId, amount, fee, reviewRequired });
  return { id: withdrawalId, status, reviewRequired, fee, actualAmount } as any;
}

/**
 * Approve a withdrawal (reviewed by tenant admin)
 */
export async function approveWithdrawal(tenantId: string, withdrawalId: string, reviewer: string): Promise<any> {
  const result = await pool.query(
    `UPDATE saas_withdrawals SET status = 'approved', review_by = $3, review_note = NULL, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND status = 'pending_review' RETURNING *`,
    [withdrawalId, tenantId, reviewer]
  );

  if (result.rows.length === 0) {
    throw Errors.notFound('Withdrawal or already processed');
  }

  const withdrawal = result.rows[0];

  // Trigger actual transfer
  // In production: call CWallet send-tx API. Dev mode: simulate.
  logger.info('Withdrawal approved, queuing transfer', {
    id: withdrawalId,
    from: withdrawal.from_address,
    to: withdrawal.to_address,
    amount: withdrawal.amount,
  });

  // Simulate confirm
  await pool.query(
    `UPDATE saas_withdrawals SET status = 'confirmed', updated_at = NOW() WHERE id = $1`,
    [withdrawalId]
  );

  return withdrawal;
}

/**
 * Reject a withdrawal (reviewed by tenant admin)
 */
export async function rejectWithdrawal(tenantId: string, withdrawalId: string, reason: string, reviewer: string): Promise<any> {
  const result = await pool.query(
    `UPDATE saas_withdrawals SET status = 'rejected', review_by = $3, review_note = $4, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND status = 'pending_review' RETURNING *`,
    [withdrawalId, tenantId, reviewer, reason]
  );

  if (result.rows.length === 0) {
    throw Errors.notFound('Withdrawal or already processed');
  }

  logger.info('Withdrawal rejected', { id: withdrawalId, reason });
  return result.rows[0];
}

/**
 * List withdrawals for a tenant
 */
export async function listWithdrawals(params: {
  tenantId: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: any[]; total: number }> {
  const { tenantId, status, limit = 50, offset = 0 } = params;

  const conditions = ['tenant_id = $1'];
  const values: any[] = [tenantId];
  let idx = 2;

  if (status) {
    conditions.push(`status = $${idx++}`);
    values.push(status);
  }

  const where = ' WHERE ' + conditions.join(' AND ');

  const result = await pool.query(
    `SELECT * FROM saas_withdrawals${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, offset]
  );

  const count = await pool.query(
    `SELECT COUNT(*)::int as cnt FROM saas_withdrawals${where}`,
    values
  );

  return { items: result.rows, total: count.rows[0].cnt };
}

/**
 * Get tenant balance summary (for SaaS dashboard F-037)
 */
export async function getTenantBalances(tenantId: string): Promise<any> {
  const addressCount = await pool.query(
    `SELECT COUNT(*)::int as cnt FROM address_pool WHERE tenant_id = $1 AND status = 'active'`,
    [tenantId]
  );

  const withdrawalPending = await pool.query(
    `SELECT COUNT(*)::int as cnt FROM saas_withdrawals WHERE tenant_id = $1 AND status = 'pending_review'`,
    [tenantId]
  );

  const todayDeposits = await pool.query(
    `SELECT COALESCE(SUM(amount)::float, 0) as total
     FROM sweep_records WHERE tenant_id = $1 AND status = 'confirmed'
     AND created_at >= NOW() - INTERVAL '24 hours'`,
    [tenantId]
  );

  const todayWithdrawals = await pool.query(
    `SELECT COALESCE(SUM(amount)::float, 0) as total
     FROM saas_withdrawals WHERE tenant_id = $1 AND status = 'confirmed'
     AND created_at >= NOW() - INTERVAL '24 hours'`,
    [tenantId]
  );

  return {
    totalAddresses: addressCount.rows[0].cnt,
    pendingReviews: withdrawalPending.rows[0].cnt,
    todayDeposits: todayDeposits.rows[0].total,
    todayWithdrawals: todayWithdrawals.rows[0].total,
  };
}

/**
 * Get tenant transaction history (for SaaS dashboard F-037)
 */
export async function getTenantTransactions(params: {
  tenantId: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: any[]; total: number }> {
  const { tenantId, limit = 50, offset = 0 } = params;

  const items = await pool.query(
    `SELECT * FROM sweep_records WHERE tenant_id = $1
     UNION ALL
     SELECT id, tenant_id, from_address, to_address, token, amount, NULL as tx_hash, status, created_at
     FROM saas_withdrawals WHERE tenant_id = $1
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [tenantId, limit, offset]
  );

  const count = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM sweep_records WHERE tenant_id = $1) +
       (SELECT COUNT(*)::int FROM saas_withdrawals WHERE tenant_id = $1) as cnt`,
    [tenantId]
  );

  return { items: items.rows, total: count.rows[0].cnt };
}

// ═══════════════════════════════════════════════
// Tenant API Key Management
// MVP: user = tenant (one tenant per user, matched by email in tenants.contact_email)
// ═══════════════════════════════════════════════

/**
 * Find tenant for a given user (by email lookup in tenants.contact_email)
 */
async function findTenantForUser(userId: string, email?: string): Promise<any> {
  // Step 1: Look up user email
  let userEmail = email;
  if (!userEmail) {
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) throw Errors.notFound('User not found');
    userEmail = userResult.rows[0].email;
  }

  // Step 2: Find tenant by contact_email
  const tenantResult = await pool.query(
    'SELECT * FROM tenants WHERE contact_email = $1 AND status = $2',
    [userEmail, 'active']
  );
  if (tenantResult.rows.length === 0) {
    throw Errors.notFound('No active tenant found for this user. Contact admin to create a tenant.');
  }
  return tenantResult.rows[0];
}

/**
 * List all API keys for the user's tenant
 */
export async function listTenantApiKeys(userId: string, email?: string): Promise<any[]> {
  const tenant = await findTenantForUser(userId, email);
  const result = await pool.query(
    'SELECT * FROM api_keys WHERE tenant_id = $1 ORDER BY created_at DESC',
    [tenant.id]
  );
  return result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    prefix: row.key_hash ? 'pk_' + row.key_hash.substring(0, 8) + '...' : 'pk_live_' + tenant.api_key.substring(0, 8) + '...',
    scope: row.scope || 'tenant',
    enabled: row.enabled !== false,
    createdAt: row.created_at || tenant.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

/**
 * Create a new API key for the user's tenant
 */
export async function createTenantApiKey(userId: string, email: string, name: string): Promise<{ id: string; key: string }> {
  const tenant = await findTenantForUser(userId, email);
  const id = uuidv4();
  const rawKey = `pk_live_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  // Check if api_keys has tenant_id column; if not, add via migration
  try {
    await pool.query(
      `INSERT INTO api_keys (id, key_hash, name, scope, enabled)
       VALUES ($1, $2, $3, 'tenant', true)`,
      [id, keyHash, name]
    );
  } catch (err: any) {
    // If tenant_id column doesn't exist, store key info in tenant record
    logger.warn('api_keys insert failed, falling back to tenant update', err.message);
  }

  // Update tenant's primary API key as MVP fallback
  await pool.query(
    'UPDATE tenants SET api_key = $1 WHERE id = $2',
    [rawKey, tenant.id]
  );

  return { id: tenant.id, key: rawKey };
}

/**
 * Rotate: generates new key, updates tenant's primary api_key
 */
export async function rotateTenantApiKey(userId: string, email: string, keyId: string): Promise<{ id: string; key: string }> {
  const tenant = await findTenantForUser(userId, email);
  const rawKey = `pk_live_${crypto.randomBytes(24).toString('hex')}`;

  await pool.query(
    'UPDATE tenants SET api_key = $1, updated_at = NOW() WHERE id = $2',
    [rawKey, tenant.id]
  );

  return { id: tenant.id, key: rawKey };
}

/**
 * Revoke: clear tenant's api_key (effectively disables WaaS API access)
 */
export async function revokeTenantApiKey(userId: string, email: string, keyId: string): Promise<void> {
  const tenant = await findTenantForUser(userId, email);
  await pool.query(
    "UPDATE tenants SET api_key = '', updated_at = NOW() WHERE id = $1",
    [tenant.id]
  );
}
