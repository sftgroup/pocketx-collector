import { Router } from 'express';
import { asyncHandler, apiResponse } from '../helpers';
import { authenticate, optionalAuth } from '../middleware/auth';
import { queryEvents, getChainStats } from '../services/dataWholesale';
import { getCleaner } from '../services/cleaner';
import { getScanner } from '../services/scanner';
import { pool } from '../database';

const router = Router();

/**
 * Data Routes — Event Collector + Data Wholesale
 *
 * GET  /api/v2/data/events        — Query on-chain events (supports chain/address/event_type/block pagination)
 * GET  /api/v2/data/stats         — Chain-level statistics
 * GET  /api/v2/data/health        — Collector health (scanner status, lag, storage)
 * GET  /api/v2/data/checkpoints   — All collector checkpoints
 */

/**
 * GET /api/v2/data/events
 * Query standardized on-chain events.
 *
 * Query params:
 *   chain         — filter by chain name (sepolia, ethereum, polygon, etc.)
 *   address       — filter by from_address OR to_address
 *   contract      — filter by contract_address
 *   event_type    — filter by event_type (transfer, etc.)
 *   from_block    — block range start
 *   to_block      — block range end
 *   page_size     — results per page (default 100, max 500)
 *   page_token    — cursor for next page
 *
 * Auth: JWT (internal) or API Key (external)
 */
router.get(
  '/events',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const params = {
      chain: req.query.chain as string | undefined,
      address: req.query.address as string | undefined,
      contract: req.query.contract as string | undefined,
      event_type: req.query.event_type as string | undefined,
      from_block: req.query.from_block ? parseInt(req.query.from_block as string, 10) : undefined,
      to_block: req.query.to_block ? parseInt(req.query.to_block as string, 10) : undefined,
      page_size: req.query.page_size ? parseInt(req.query.page_size as string, 10) : undefined,
      page_token: req.query.page_token as string | undefined,
    };

    const result = await queryEvents(params);
    res.json(apiResponse(result));
  })
);

/**
 * GET /api/v2/data/stats
 * Get chain-level event statistics
 */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const stats = await getChainStats();
    const storageStats = await getCleaner().getStorageStats();
    res.json(apiResponse({ chains: stats, storage: storageStats }));
  })
);

/**
 * GET /api/v2/data/health
 * Collector health status — scanner state, endpoint count, storage
 */
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const scanner = getScanner();
    const scannerHealth = scanner.getHealth();
    const cleaner = getCleaner();
    const storage = await cleaner.getStorageStats();

    // Get latest checkpoints
    const checkpoints = await pool.query(
      'SELECT chain, collector_name, last_block, status, last_fetch_at FROM event_checkpoints ORDER BY chain'
    );

    res.json(apiResponse({
      status: 'ok',
      scanners: scannerHealth.collectors,
      endpoints: scannerHealth.endpoints,
      storage,
      checkpoints: checkpoints.rows,
    }));
  })
);

/**
 * GET /api/v2/data/checkpoints
 * All collector checkpoints
 */
router.get(
  '/checkpoints',
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      'SELECT chain, collector_name, last_block, status, last_fetch_at, error_message FROM event_checkpoints ORDER BY chain, collector_name'
    );
    res.json(apiResponse(result.rows));
  })
);

export default router;
