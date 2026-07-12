import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError, ErrorCode, Errors } from '../utils/errors';
import { pool } from '../models/database';

export interface AuthPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Optional authentication — attaches user if token is present, otherwise passes through.
 * Use for endpoints that work both with and without auth.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // No token → anonymous access
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as AuthPayload;
    const { isTokenRevoked } = await import('../services/authService');
    if (!(await isTokenRevoked(token))) {
      req.user = decoded;
    }
  } catch {
    // Invalid token → continue as anonymous
  }
  next();
}

/**
 * JWT Authentication Middleware (BE-01)
 * Extracts and verifies the Bearer token from Authorization header.
 * Also checks token blacklist for revoked tokens (JWT revocation).
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(Errors.unauthorized('Missing or malformed Authorization header'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as AuthPayload;

    // Check if token is revoked (JWT revocation)
    const { isTokenRevoked } = await import('../services/authService');
    if (await isTokenRevoked(token)) {
      return next(Errors.unauthorized('Token has been revoked'));
    }

    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(Errors.unauthorized('Token expired'));
    }
    return next(Errors.unauthorized('Invalid token'));
  }
}

/**
 * Admin authorization middleware
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Admin access required', 403, ErrorCode.PARAM_ERROR));
  }
  next();
}

/**
 * API Key authentication (for CWallet internal callbacks / admin endpoints)
 * Validates against DB-stored API keys (supports rotation: multiple active keys)
 * Falls back to config.cwallet.apiKey for backward compatibility
 */
export async function requireApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey || typeof apiKey !== 'string') {
    return next(Errors.unauthorized('Missing API key'));
  }

  const crypto = require('crypto');
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  try {
    // Check DB-stored keys first (supports rotation)
    const result = await pool.query(
      `SELECT id, scope FROM api_keys
       WHERE key_hash = $1 AND enabled = true
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [keyHash]
    );

    if (result.rows.length > 0) {
      // Update last_used_at
      await pool.query(
        'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
        [result.rows[0].id]
      ).catch(() => {}); // non-critical
      return next();
    }

    // Fallback: check against config cwallet.apiKey (backward compat)
    if (apiKey === config.cwallet.apiKey) {
      return next();
    }
  } catch {
    // If DB is unavailable, fall back to config
    if (apiKey === config.cwallet.apiKey) {
      return next();
    }
    return next(Errors.unauthorized('API key validation failed'));
  }

  return next(Errors.unauthorized('Invalid API key'));
}

/**
 * CWallet internal HMAC signature verification middleware
 * Verifies that requests from CWallet are authentically signed.
 */
export function verifyCWalletSignature(req: Request, _res: Response, next: NextFunction): void {
  const signature = req.headers['x-cwallet-signature'] as string;
  const timestamp = req.headers['x-cwallet-timestamp'] as string;

  if (!signature || !timestamp) {
    return next(Errors.unauthorized('Missing CWallet signature headers'));
  }

  // Check timestamp is within 5 minutes
  const now = Date.now();
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 5 * 60 * 1000) {
    return next(Errors.unauthorized('CWallet signature expired'));
  }

  // In production, verify HMAC-SHA256(body + timestamp, sharedSecret)
  const expectedSig = require('crypto')
    .createHmac('sha256', config.cwallet.apiKey)
    .update(JSON.stringify(req.body) + timestamp)
    .digest('hex');

  if (signature !== expectedSig) {
    return next(Errors.unauthorized('Invalid CWallet signature'));
  }

  next();
}

/**
 * Tenant ID enforcement — every wallet request must be scoped to the authenticated user
 * This ensures tenantId filtering as per security checklist.
 */
export function enforceTenantScope(req: Request, _res: Response, next: NextFunction): void {
  // For wallet/transaction routes, the userId from JWT must match the wallet's user_id in DB
  // This is enforced at the service layer, but we attach the user context here
  if (!req.user) {
    return next(Errors.unauthorized());
  }
  next();
}

/**
 * SaaS Tenant API Key authentication
 * Validates x-api-key header, resolves tenant_id, attaches to request
 * Used for all /api/v2/saas/* tenant-facing endpoints
 */
export async function requireTenantApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey || typeof apiKey !== 'string') {
    return next(Errors.unauthorized('Missing x-api-key header'));
  }

  try {
    const { getTenantByApiKey } = await import('../services/tenantService');
    const tenant = await getTenantByApiKey(apiKey);

    if (!tenant) {
      return next(Errors.unauthorized('Invalid or suspended API key'));
    }

    // Attach tenant context
    (req as any).tenant = tenant;
    next();
  } catch (err: any) {
    return next(Errors.unauthorized('Tenant authentication failed'));
  }
}
