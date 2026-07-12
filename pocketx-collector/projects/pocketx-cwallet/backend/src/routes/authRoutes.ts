import { Router } from 'express';
import { asyncHandler, apiResponse } from '../utils/helpers';
import { authenticate } from '../middleware/auth';
import { smsLimiter, verifyLimiter } from '../middleware/rateLimiter';
import * as authService from '../services/authService';

const router = Router();

/**
 * BE-02: Authentication Routes
 * POST /api/v2/auth/send-code  — Send email verification code (dev: fixed code 888888)
 * POST /api/v2/auth/verify-code — Verify code → JWT
 * POST /api/v2/auth/set-password — Set payment password
 * POST /api/v2/auth/refresh — Refresh JWT
 */

/**
 * POST /api/v2/auth/send-code
 * Send verification code to email (L-011)
 * Dev mode: fixed code 888888, no real email sent
 * Body: { email: string }
 */
router.post(
  '/send-code',
  smsLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json(apiResponse(null, 'Missing required field: email', 1001));
    }

    await authService.sendVerificationCode(email);
    res.json(apiResponse(null, 'Verification code sent'));
  })
);

/**
 * POST /api/v2/auth/verify-code
 * Verify code → returns JWT access + refresh tokens (L-011)
 * Dev mode: use code "888888"
 * Body: { email: string, code: string }
 */
router.post(
  '/verify-code',
  verifyLimiter,
  asyncHandler(async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json(apiResponse(null, 'Missing required fields: email, code', 1001));
    }

    const result = await authService.verifyCodeAndLogin(email, code);
    res.json(apiResponse(result, 'Login successful'));
  })
);

/**
 * POST /api/v2/auth/set-password
 * Set 6-digit payment password
 * Auth: JWT required
 * Body: { password: string }
 */
router.post(
  '/set-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const { password } = req.body;
    const userId = req.user!.userId;

    if (!password) {
      return res.status(400).json(apiResponse(null, 'Missing required field: password', 1001));
    }

    await authService.setPaymentPassword(userId, password);
    res.json(apiResponse(null, 'Payment password set successfully'));
  })
);

/**
 * POST /api/v2/auth/refresh
 * Refresh JWT tokens (old token is revoked on rotation)
 * Body: { refreshToken: string }
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json(apiResponse(null, 'Missing required field: refreshToken', 1001));
    }

    const tokens = await authService.refreshToken(refreshToken);
    res.json(apiResponse(tokens, 'Token refreshed'));
  })
);

/**
 * POST /api/v2/auth/logout
 * Logout — revoke the current refresh token
 * Auth: JWT required
 * Body: { refreshToken: string }
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const userId = req.user!.userId;

    if (!refreshToken) {
      return res.status(400).json(apiResponse(null, 'Missing required field: refreshToken', 1001));
    }

    await authService.logoutUser(refreshToken, userId);
    res.json(apiResponse(null, 'Logged out successfully'));
  })
);

/**
 * POST /api/v2/auth/set-payment-password
 * Set or change 6-digit payment password
 * Auth: JWT required
 * Body: { newPassword: string, oldPassword?: string }
 */
router.post(
  '/set-payment-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const { newPassword, oldPassword } = req.body;
    const userId = req.user!.userId;

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json(apiResponse(null, 'Missing required field: newPassword', 1001));
    }

    await authService.setPaymentPassword(userId, newPassword, oldPassword || undefined);
    res.json(apiResponse(null, 'Payment password set successfully'));
  })
);

/**
 * GET /api/v2/auth/payment-password-status
 * Check if user has set payment password
 * Auth: JWT required
 */
router.get(
  '/payment-password-status',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const has = await authService.hasPaymentPassword(userId);
    res.json(apiResponse({ hasPaymentPassword: has }));
  })
);

export default router;
