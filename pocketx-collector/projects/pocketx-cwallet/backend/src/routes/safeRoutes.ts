import { Router } from 'express';
import { asyncHandler, apiResponse } from '../utils/helpers';
import { authenticate } from '../middleware/auth';
import { Errors } from '../utils/errors';
import { logger } from '../utils/logger';
import * as multiSigService from '../services/multiSigService';

const router = Router();

/**
 * Safe Multi-Sig Routes (F-027 ~ F-032)
 *
 * POST   /api/v2/safe/create        — Create Safe wallet (F-027)
 * POST   /api/v2/safe/propose       — Propose transaction (F-028)
 * POST   /api/v2/safe/confirm       — Sign/confirm transaction (F-029)
 * POST   /api/v2/safe/execute       — Execute when threshold met (F-030)
 * GET    /api/v2/safe/list          — List user's Safe wallets (F-031)
 * GET    /api/v2/safe/:address      — Safe wallet details + transactions
 * PUT    /api/v2/safe/:address/owners — Update owners/threshold (F-032)
 */

/**
 * POST /api/v2/safe/create
 * Create a new Gnosis Safe wallet (F-027)
 */
router.post(
  '/create',
  authenticate,
  asyncHandler(async (req, res) => {
    const { chainId, owners, threshold, name } = req.body;
    const userId = req.user!.userId;

    if (!chainId || !owners || !Array.isArray(owners) || owners.length === 0) {
      return res.status(400).json(apiResponse(null, 'Missing required fields: chainId, owners (non-empty array)', 1001));
    }
    if (typeof threshold !== 'number' || threshold < 1 || threshold > owners.length) {
      return res.status(400).json(apiResponse(null, `Threshold must be between 1 and ${owners.length}`, 1001));
    }

    const safe = await multiSigService.createSafe({ userId, chainId, owners, threshold, name });
    res.status(201).json(apiResponse(safe, 'Safe wallet created'));
  })
);

/**
 * POST /api/v2/safe/propose
 * Propose a multi-sig transaction (F-028)
 */
router.post(
  '/propose',
  authenticate,
  asyncHandler(async (req, res) => {
    const { safeAddress, to, value, data } = req.body;
    const userId = req.user!.userId;

    if (!safeAddress || !to) {
      return res.status(400).json(apiResponse(null, 'Missing required fields: safeAddress, to', 1001));
    }

    const tx = await multiSigService.proposeTransaction({
      userId,
      safeAddress,
      to,
      value: value || '0',
      data,
    });

    res.status(201).json(apiResponse(tx, 'Transaction proposed'));
  })
);

/**
 * POST /api/v2/safe/confirm
 * Sign/confirm a multi-sig transaction (F-029)
 */
router.post(
  '/confirm',
  authenticate,
  asyncHandler(async (req, res) => {
    const { safeAddress, safeTxHash, signature } = req.body;
    const userId = req.user!.userId;

    if (!safeAddress || !safeTxHash || !signature) {
      return res.status(400).json(apiResponse(null, 'Missing required fields: safeAddress, safeTxHash, signature', 1001));
    }

    const result = await multiSigService.confirmTransaction({
      userId, safeAddress, safeTxHash, signature,
    });

    const msg = result.sigCount >= result.threshold
      ? `Threshold met! ${result.sigCount}/${result.threshold} — ready to execute`
      : `Signed (${result.sigCount}/${result.threshold})`;

    res.json(apiResponse(result, msg));
  })
);

/**
 * POST /api/v2/safe/execute
 * Execute a transaction when threshold is met (F-030)
 */
router.post(
  '/execute',
  authenticate,
  asyncHandler(async (req, res) => {
    const { safeTxHash } = req.body;
    const userId = req.user!.userId;

    if (!safeTxHash) {
      return res.status(400).json(apiResponse(null, 'Missing required field: safeTxHash', 1001));
    }

    const result = await multiSigService.executeTransaction({ userId, safeTxHash });
    res.json(apiResponse(result, 'Transaction executed'));
  })
);

/**
 * GET /api/v2/safe/list
 * List all Safe wallets for current user (F-031)
 */
router.get(
  '/list',
  authenticate,
  asyncHandler(async (req, res) => {
    const safes = await multiSigService.listSafes(req.user!.userId);
    res.json(apiResponse({ items: safes }));
  })
);

/**
 * GET /api/v2/safe/:address
 * Get Safe wallet details + transactions (F-031)
 */
router.get(
  '/:address',
  authenticate,
  asyncHandler(async (req, res) => {
    const { address } = req.params;

    if (!address || !address.startsWith('0x') || address.length !== 42) {
      return res.status(400).json(apiResponse(null, 'Invalid address format', 1001));
    }

    const safe = await multiSigService.getSafe(address);
    const transactions = await multiSigService.getSafeTransactions(address);

    res.json(apiResponse({ safe, transactions }));
  })
);

/**
 * PUT /api/v2/safe/:address/owners
 * Update Safe owners and threshold (F-032)
 * ⚠️ In production: this is itself a multi-sig tx requiring threshold approval
 */
router.put(
  '/:address/owners',
  authenticate,
  asyncHandler(async (req, res) => {
    const { address } = req.params;
    const { owners, threshold } = req.body;

    if (!owners || !Array.isArray(owners) || !threshold) {
      return res.status(400).json(apiResponse(null, 'Missing required fields: owners, threshold', 1001));
    }

    const result = await multiSigService.updateSafeOwners({
      userId: req.user!.userId,
      safeAddress: address,
      newOwners: owners,
      newThreshold: threshold,
    });

    res.json(apiResponse(result, 'Safe owners updated'));
  })
);

export default router;
