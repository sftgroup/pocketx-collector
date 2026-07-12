import { Router } from 'express';
import { asyncHandler, apiResponse } from '../utils/helpers';
import { authenticate, requireAdmin, requireTenantApiKey } from '../middleware/auth';
import { pool } from '../models/database';
import * as tenantService from '../services/tenantService';
import * as saasService from '../services/saasService';

const router = Router();

/**
 * SaaS WaaS Routes (F-033 ~ F-037)
 *
 * ── Tenant Management (admin only) ──
 * POST   /api/v2/saas/tenants           — Register new tenant
 * GET    /api/v2/saas/tenants           — List all tenants
 * GET    /api/v2/saas/tenants/:id       — Get tenant details
 * PATCH  /api/v2/saas/tenants/:id       — Update tenant config
 * DELETE /api/v2/saas/tenants/:id       — Suspend tenant
 *
 * ── Tenant-facing API (authenticated via x-api-key) ──
 * POST   /api/v2/saas/address           — Allocate address (F-034)
 * GET    /api/v2/saas/address/:userId   — Get address details
 * GET    /api/v2/saas/addresses         — List all addresses
 * POST   /api/v2/saas/withdraw          — Create withdrawal request (F-036)
 * GET    /api/v2/saas/withdrawals       — List withdrawals
 * POST   /api/v2/saas/withdraw/:id/approve  — Approve withdrawal
 * POST   /api/v2/saas/withdraw/:id/reject   — Reject withdrawal
 * POST   /api/v2/saas/sweep             — Trigger auto-sweep (F-035)
 * GET    /api/v2/saas/balances          — Balance overview (F-037)
 * GET    /api/v2/saas/transactions      — Transaction history (F-037)
 */

// ═══════════════════════════════════════════════
// Admin: Tenant Management (F-033)
// ═══════════════════════════════════════════════

/**
 * POST /api/v2/saas/tenants
 * Register a new enterprise tenant (admin only)
 */
router.post(
  '/tenants',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, contactEmail, webhookUrl } = req.body;

    if (!name || !contactEmail) {
      return res.status(400).json(apiResponse(null, 'Missing required fields: name, contactEmail', 1001));
    }

    const result = await tenantService.registerTenant({ name, contactEmail, webhookUrl });
    res.status(201).json(apiResponse(result, 'Tenant registered'));
  })
);

/**
 * GET /api/v2/saas/tenants
 * List all tenants (admin only)
 */
router.get(
  '/tenants',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status, limit, offset } = req.query;
    const result = await tenantService.listTenants({
      status: status as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    res.json(apiResponse(result));
  })
);

/**
 * GET /api/v2/saas/tenants/:id
 * Get tenant details (admin only)
 */
router.get(
  '/tenants/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenant = await tenantService.getTenant(req.params.id);
    res.json(apiResponse(tenant));
  })
);

/**
 * PATCH /api/v2/saas/tenants/:id
 * Update tenant configuration (admin only)
 */
router.patch(
  '/tenants/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenant = await tenantService.updateTenant(req.params.id, req.body);
    res.json(apiResponse(tenant, 'Tenant updated'));
  })
);

/**
 * DELETE /api/v2/saas/tenants/:id
 * Suspend a tenant (admin only)
 */
router.delete(
  '/tenants/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await tenantService.suspendTenant(req.params.id);
    res.json(apiResponse(null, 'Tenant suspended'));
  })
);

// ═══════════════════════════════════════════════
// Tenant-facing API: Address Management (F-034)
// ═══════════════════════════════════════════════

/**
 * POST /api/v2/saas/address
 * Allocate an address for a tenant's external user (L-019)
 * Auth: x-api-key (tenant)
 */
router.post(
  '/address',
  requireTenantApiKey,
  asyncHandler(async (req, res) => {
    const tenant = (req as any).tenant;
    const { externalUserId, chain, label } = req.body;

    if (!externalUserId || !chain) {
      return res.status(400).json(apiResponse(null, 'Missing required fields: externalUserId, chain', 1001));
    }

    const result = await saasService.allocateAddress({
      tenantId: tenant.id,
      externalUserId,
      chain,
      label,
    });

    res.status(result.isNew ? 201 : 200).json(apiResponse(result, result.isNew ? 'Address allocated' : 'Address already exists'));
  })
);

/**
 * GET /api/v2/saas/address/:userId
 * Get address details for a tenant's external user
 * Auth: x-api-key (tenant)
 */
router.get(
  '/address/:userId',
  requireTenantApiKey,
  asyncHandler(async (req, res) => {
    const tenant = (req as any).tenant;
    const address = await saasService.getAddress(tenant.id, req.params.userId);
    res.json(apiResponse(address));
  })
);

/**
 * GET /api/v2/saas/addresses
 * List all addresses for a tenant
 * Auth: x-api-key (tenant)
 */
router.get(
  '/addresses',
  requireTenantApiKey,
  asyncHandler(async (req, res) => {
    const tenant = (req as any).tenant;
    const { status, chain, limit, offset } = req.query;

    const result = await saasService.listAddresses({
      tenantId: tenant.id,
      status: status as string,
      chain: chain as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json(apiResponse(result));
  })
);

// ═══════════════════════════════════════════════
// Tenant-facing API: Withdrawals (F-036)
// ═══════════════════════════════════════════════

/**
 * POST /api/v2/saas/withdraw
 * Create a withdrawal request (L-021/022)
 * Auth: x-api-key (tenant)
 */
router.post(
  '/withdraw',
  requireTenantApiKey,
  asyncHandler(async (req, res) => {
    const tenant = (req as any).tenant;
    const { externalUserId, toAddress, token, amount } = req.body;

    if (!externalUserId || !toAddress || !amount) {
      return res.status(400).json(apiResponse(null, 'Missing required fields: externalUserId, toAddress, amount', 1001));
    }

    const result = await saasService.createWithdrawal({
      tenantId: tenant.id,
      externalUserId,
      toAddress,
      token: token || '*',
      amount,
    });

    res.status(201).json(apiResponse(result, 'Withdrawal created'));
  })
);

/**
 * GET /api/v2/saas/withdrawals
 * List withdrawals for a tenant
 * Auth: x-api-key (tenant)
 */
router.get(
  '/withdrawals',
  requireTenantApiKey,
  asyncHandler(async (req, res) => {
    const tenant = (req as any).tenant;
    const { status, limit, offset } = req.query;

    const result = await saasService.listWithdrawals({
      tenantId: tenant.id,
      status: status as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json(apiResponse(result));
  })
);

// ═══════════════════════════════════════════════
// Admin: Withdrawal Review (F-036)
// ═══════════════════════════════════════════════

/**
 * POST /api/v2/saas/withdraw/:id/approve
 * Approve a withdrawal (tenant admin review)
 * Auth: JWT (admin) or tenant API key
 */
router.post(
  '/withdraw/:id/approve',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    // Admin reviews on behalf of tenant
    const withdrawal = await pool.query(
      'SELECT tenant_id FROM saas_withdrawals WHERE id = $1',
      [req.params.id]
    );
    if (withdrawal.rows.length === 0) {
      return res.status(404).json(apiResponse(null, 'Withdrawal not found', 1001));
    }

    const result = await saasService.approveWithdrawal(
      withdrawal.rows[0].tenant_id,
      req.params.id,
      req.user!.email
    );
    res.json(apiResponse(result, 'Withdrawal approved'));
  })
);

/**
 * POST /api/v2/saas/withdraw/:id/reject
 * Reject a withdrawal (tenant admin review)
 * Auth: JWT (admin)
 */
router.post(
  '/withdraw/:id/reject',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json(apiResponse(null, 'Missing required field: reason', 1001));
    }

    const withdrawal = await pool.query(
      'SELECT tenant_id FROM saas_withdrawals WHERE id = $1',
      [req.params.id]
    );
    if (withdrawal.rows.length === 0) {
      return res.status(404).json(apiResponse(null, 'Withdrawal not found', 1001));
    }

    const result = await saasService.rejectWithdrawal(
      withdrawal.rows[0].tenant_id,
      req.params.id,
      reason,
      req.user!.email
    );
    res.json(apiResponse(result, 'Withdrawal rejected'));
  })
);

// ═══════════════════════════════════════════════
// Tenant-facing API: Sweep & Dashboard (F-035, F-037)
// ═══════════════════════════════════════════════

/**
 * POST /api/v2/saas/sweep
 * Trigger auto-sweep for a tenant (F-035)
 * Auth: x-api-key (tenant)
 */
router.post(
  '/sweep',
  requireTenantApiKey,
  asyncHandler(async (req, res) => {
    const tenant = (req as any).tenant;
    const result = await saasService.sweepTenantFunds(tenant.id);
    res.json(apiResponse(result, 'Sweep completed'));
  })
);

/**
 * GET /api/v2/saas/balances
 * Balance overview for a tenant (F-037)
 * Auth: x-api-key (tenant) or JWT (admin via query param)
 */
router.get(
  '/balances',
  requireTenantApiKey,
  asyncHandler(async (req, res) => {
    const tenant = (req as any).tenant;
    const balances = await saasService.getTenantBalances(tenant.id);
    res.json(apiResponse(balances));
  })
);

/**
 * GET /api/v2/saas/transactions
 * Transaction history for a tenant (F-037)
 * Auth: x-api-key (tenant)
 */
router.get(
  '/transactions',
  requireTenantApiKey,
  asyncHandler(async (req, res) => {
    const tenant = (req as any).tenant;
    const { limit, offset } = req.query;

    const result = await saasService.getTenantTransactions({
      tenantId: tenant.id,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json(apiResponse(result));
  })
);

// ═══════════════════════════════════════════════
// Tenant-facing: API Key Management
// ═══════════════════════════════════════════════

/**
 * GET /api/v2/saas/apikeys
 * List all API keys for the authenticated tenant
 * Auth: JWT (tenant user)
 */
router.get(
  '/apikeys',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (!user?.userId) {
      return res.status(401).json(apiResponse(null, 'Unauthorized', 401));
    }
    const keys = await saasService.listTenantApiKeys(user.userId, user.email);
    res.json(apiResponse(keys));
  })
);

/**
 * POST /api/v2/saas/apikeys
 * Generate a new API key for the authenticated tenant
 * Auth: JWT (tenant user)
 */
router.post(
  '/apikeys',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (!user?.userId) {
      return res.status(401).json(apiResponse(null, 'Unauthorized', 401));
    }
    const { name } = req.body;
    const result = await saasService.createTenantApiKey(user.userId, user.email, name || 'default');
    res.status(201).json(apiResponse(result));
  })
);

/**
 * POST /api/v2/saas/apikeys/:id/rotate
 * Rotate an existing API key (generates new key, deactivates old one)
 * Auth: JWT (tenant user)
 */
router.post(
  '/apikeys/:id/rotate',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const keyId = req.params.id;
    if (!user?.userId) {
      return res.status(401).json(apiResponse(null, 'Unauthorized', 401));
    }
    const result = await saasService.rotateTenantApiKey(user.userId, user.email, keyId);
    res.json(apiResponse(result));
  })
);

/**
 * DELETE /api/v2/saas/apikeys/:id
 * Revoke an API key
 * Auth: JWT (tenant user)
 */
router.delete(
  '/apikeys/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const keyId = req.params.id;
    if (!user?.userId) {
      return res.status(401).json(apiResponse(null, 'Unauthorized', 401));
    }
    await saasService.revokeTenantApiKey(user.userId, user.email, keyId);
    res.json(apiResponse(null, 'Key revoked'));
  })
);

export default router;
