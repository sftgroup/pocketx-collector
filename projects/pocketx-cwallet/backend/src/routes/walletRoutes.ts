import { Router } from 'express';
import { asyncHandler, apiResponse, paginationParams } from '../utils/helpers';
import { authenticate, requireAdmin } from '../middleware/auth';
import * as walletService from '../services/walletService';

const router = Router();

/**
 * POST /api/v2/wallet/create
 * Create custodial wallet for a chain
 * Auth: JWT required
 * Body: { chain: string }
 */
router.post(
  '/create',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const { chain } = req.body;

    if (!chain || typeof chain !== 'string') {
      return res.status(400).json(apiResponse(null, 'Missing required field: chain', 1001));
    }

    const wallet = await walletService.createCustodialWallet(userId, chain.toLowerCase());
    res.json(apiResponse(wallet, 'Custodial wallet created'));
  })
);

/**
 * POST /api/v2/wallet/import
 * Import existing HD wallet
 * Auth: JWT required
 * Body: { chain: string, hdPath: string }
 */
router.post(
  '/import',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const { chain, hdPath } = req.body;

    if (!chain || !hdPath) {
      return res.status(400).json(apiResponse(null, 'Missing required fields: chain, hdPath', 1001));
    }

    const wallet = await walletService.importCustodialWallet(userId, chain.toLowerCase(), hdPath);
    res.json(apiResponse(wallet, 'Custodial wallet imported'));
  })
);

/**
 * GET /api/v2/wallet/balance
 * Query aggregated balance across all chains
 * Auth: JWT required
 * Query: (optional) chain — filter by chain
 */
router.get(
  '/balance',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const balances = await walletService.getAggregatedBalance(userId);
    res.json(apiResponse(balances, 'Success'));
  })
);

/**
 * GET /api/v2/wallet/address
 * Get deposit address for a specific chain
 * Auth: JWT required
 * Query: chain: string
 */
router.get(
  '/address',
  authenticate,
  asyncHandler(async (req, res) => {
    const { chain } = req.query;
    const userId = req.user!.userId;

    if (!chain || typeof chain !== 'string') {
      return res.status(400).json(apiResponse(null, 'Missing required query param: chain', 1001));
    }

    const address = await walletService.getWalletAddress(userId, chain.toLowerCase());
    res.json(apiResponse({ address, chain }, 'Success'));
  })
);

/**
 * GET /api/v2/wallet/transactions
 * Get transaction history with pagination
 * Auth: JWT required
 * Query: page, limit
 */
router.get(
  '/transactions',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const { offset, limit } = paginationParams(req.query);
    const result = await walletService.getTransactionHistory(userId, offset, limit);

    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    res.json({
      code: 0,
      message: 'success',
      data: {
        items: result.items,
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      },
    });
  })
);


/**
 * GET /api/v2/wallet/:chainId
 * Get HD wallet details + tokens for a specific chain
 */
router.get(
  "/:chainId",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const { chainId } = req.params;
    const wallet = await walletService.getWalletDetail(userId, chainId);
    if (!wallet) {
      return res.status(404).json(apiResponse(null, "Wallet not found", 1404));
    }
    res.json(apiResponse(wallet, "Success"));
  })
);
export default router;
