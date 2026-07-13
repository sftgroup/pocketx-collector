import { Router, Request, Response, NextFunction } from 'express';
import { asyncHandler, apiResponse } from '../helpers';
import { authenticate } from '../middleware/auth';
import { adminBasicAuth } from '../middleware/adminAuth';
import { pool } from '../database';
import { logger } from '../logger';
import { getScanner } from '../services/scanner';
import { getCleaner } from '../services/cleaner';

const router = Router();

// All admin routes require authentication — support Basic Auth, cookie session, and JWT
function adminAuth(req: Request, res: Response, next: NextFunction): void {
  // Cookie session from /admin page login
  if (req.cookies?.admin_session === 'valid') {
    return next();
  }
  // Basic Auth header (direct API access or browser prompt)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Basic ')) {
    adminBasicAuth(req, res, next);
    return;
  }
  // JWT (programmatic access)
  authenticate(req, res, next);
}
router.use(adminAuth);

/**
 * POST /api/v2/admin/rpc-endpoint
 * Add or update an RPC endpoint. Persisted to admin_rpc_config table.
 */
router.post(
  '/rpc-endpoint',
  asyncHandler(async (req, res) => {
    const { chain, key, url, provider, tier, rpm, rpd } = req.body;
    if (!chain || !url) {
      return res.status(400).json(apiResponse(null, 'chain and url are required', -1));
    }

    const endpointKey = key || `${chain}-${Date.now()}`;
    const endpointProvider = provider || 'custom';
    const endpointTier = tier || 'free';
    const endpointRpm = rpm || 60;
    const endpointRpd = rpd || 10_000;

    await pool.query(
      `INSERT INTO admin_rpc_config (chain, endpoint_key, url, provider, tier, rpm, rpd, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (chain, endpoint_key)
       DO UPDATE SET url = $3, provider = $4, tier = $5, rpm = $6, rpd = $7, enabled = true, updated_at = NOW()`,
      [chain.toLowerCase(), endpointKey, url, endpointProvider, endpointTier, endpointRpm, endpointRpd]
    );

    logger.info('[admin] RPC endpoint saved', { chain, key: endpointKey });
    res.json(apiResponse({ chain, key: endpointKey, saved: true }));
  })
);

/**
 * GET /api/v2/admin/rpc-endpoints
 * List all configured RPC endpoints
 */
router.get(
  '/rpc-endpoints',
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      'SELECT chain, endpoint_key, url, provider, tier, rpm, rpd, enabled, created_at, updated_at FROM admin_rpc_config ORDER BY chain, endpoint_key'
    );
    res.json(apiResponse(result.rows));
  })
);

/**
 * DELETE /api/v2/admin/rpc-endpoint/:chain/:key
 * Remove an RPC endpoint
 */
router.delete(
  '/rpc-endpoint/:chain/:key',
  asyncHandler(async (req, res) => {
    const { chain, key } = req.params;
    await pool.query(
      'DELETE FROM admin_rpc_config WHERE chain = $1 AND endpoint_key = $2',
      [chain.toLowerCase(), key]
    );
    logger.info('[admin] RPC endpoint removed', { chain, key });
    res.json(apiResponse({ removed: true }));
  })
);

/**
 * PATCH /api/v2/admin/rpc-endpoint/:chain/:key/toggle
 * Enable/disable an endpoint
 */
router.patch(
  '/rpc-endpoint/:chain/:key/toggle',
  asyncHandler(async (req, res) => {
    const { chain, key } = req.params;
    const result = await pool.query(
      'UPDATE admin_rpc_config SET enabled = NOT enabled, updated_at = NOW() WHERE chain = $1 AND endpoint_key = $2 RETURNING enabled',
      [chain.toLowerCase(), key]
    );
    res.json(apiResponse({ enabled: result.rows[0]?.enabled }));
  })
);

/**
 * GET /api/v2/admin/dashboard
 * Full dashboard data: scanner status, storage, events count, endpoints
 */
router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const scanner = getScanner();
    const cleaner = getCleaner();
    const scannerHealth = scanner.getHealth();

    const [storage, eventsStat, checkpoints, endpoints] = await Promise.all([
      cleaner.getStorageStats(),
      pool.query(`
        SELECT chain, count(*)::int as total, max(block_number)::bigint as latest_block
        FROM events WHERE collected_at > NOW() - interval '1 hour'
        GROUP BY chain ORDER BY total DESC
      `),
      pool.query(
        'SELECT chain, collector_name, last_block, status, last_fetch_at, error_message FROM event_checkpoints ORDER BY chain'
      ),
      pool.query(
        'SELECT chain, endpoint_key, url, provider, enabled FROM admin_rpc_config ORDER BY chain, endpoint_key'
      ),
    ]);

    // Per-chain blocks scanned last hour
    const hourlyStats: Record<string, any> = {};
    for (const row of eventsStat.rows) {
      const cp = checkpoints.rows.find((c: any) => c.chain === row.chain);
      hourlyStats[row.chain] = {
        total: row.total,
        latest_block: row.latest_block,
        checkpoint: cp?.last_block || 0,
        status: cp?.status || 'unknown',
      };
    }

    // Checkpoint blocks for chains without events yet
    for (const cp of checkpoints.rows) {
      if (!hourlyStats[cp.chain]) {
        hourlyStats[cp.chain] = {
          total: 0,
          latest_block: 0,
          checkpoint: cp.last_block,
          status: cp.status,
        };
      }
    }

    res.json(apiResponse({
      scanner: scannerHealth,
      storage,
      hourly: hourlyStats,
      endpoints: endpoints.rows,
    }));
  })
);

/**
 * GET /api/v2/admin/config
 * Get current RPC config as env-var compatible JSON
 */
router.get(
  '/config',
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      'SELECT chain, endpoint_key, url, provider, tier, rpm, rpd, enabled FROM admin_rpc_config WHERE enabled = true ORDER BY chain, endpoint_key'
    );

    const config: Record<string, any[]> = {};
    for (const row of result.rows) {
      if (!config[row.chain]) config[row.chain] = [];
      config[row.chain].push({
        key: row.endpoint_key,
        url: row.url,
        provider: row.provider,
        tier: row.tier,
        rateLimit: { rpm: row.rpm, rpd: row.rpd },
      });
    }

    res.json(apiResponse(config));
  })
);

/**
 * GET /api/v2/admin/dc-subscriptions
 * All Data Center subscriptions (from tenants db)
 */
router.get(
  '/dc-subscriptions',
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      `SELECT name, id as tenant_id, data_plan_id, dc_api_key, dc_api_key_created_at
       FROM tenants WHERE data_plan_id IS NOT NULL
       ORDER BY dc_api_key_created_at DESC NULLS LAST`
    );
    res.json(apiResponse({ items: result.rows }));
  })
);

/**
 * GET /api/v2/admin/saas-overview
 * All tenants overview (WaaS/Vault)
 */
router.get(
  '/saas-overview',
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      `SELECT name, status, hot_wallet_address, data_plan_id, created_at
       FROM tenants ORDER BY created_at DESC`
    );
    res.json(apiResponse({ items: result.rows }));
  })
);

/**
 * GET /api/v2/admin/api-keys
 * List all API keys
 */
router.get(
  '/api-keys',
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      'SELECT key_hash, enabled, last_used_at, expires_at FROM api_keys ORDER BY last_used_at DESC NULLS LAST'
    );
    res.json(apiResponse(result.rows));
  })
);

export default router;
