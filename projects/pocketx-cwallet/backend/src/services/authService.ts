import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { pool } from '../models/database';
import { logger } from '../utils/logger';
import { AppError, ErrorCode, Errors } from '../utils/errors';
import { generateId, sanitizeEmail, generateCode } from '../utils/helpers';
import { AuthPayload } from '../middleware/auth';

/**
 * BE-02: User Authentication Service
 * Handles email verification code, JWT tokens, session management
 */

// In-memory verification code store (in production, use Redis TTL)
const verificationCodes = new Map<string, { code: string; expiresAt: number; attempts: number }>();
const MAX_ATTEMPTS = 3;
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LOCKOUT_MS = 60 * 1000; // 60 seconds lockout

/** Development mode fixed verification code — skips real email sending */
const DEV_MODE_VERIFICATION_CODE = '888888';

interface UserRow {
  id: string;
  email: string;
  payment_password_hash: string | null;
  hd_wallet_id: string | null;
  role: 'user' | 'admin';
  created_at: Date;
}

/**
 * Send verification code to email (L-011)
 * In dev/test mode, returns fixed code 888888 without sending email
 */
export async function sendVerificationCode(email: string): Promise<void> {
  const sanitized = sanitizeEmail(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    throw Errors.paramError('Invalid email format');
  }

  // Check lockout
  const existing = verificationCodes.get(sanitized);
  if (existing && existing.attempts >= MAX_ATTEMPTS) {
    const lockoutEnd = existing.expiresAt + LOCKOUT_MS;
    if (Date.now() < lockoutEnd) {
      throw new AppError('Too many attempts, please wait 60s', 429, ErrorCode.PARAM_ERROR);
    }
    verificationCodes.delete(sanitized);
  }

  const expiresAt = Date.now() + CODE_TTL_MS;

  if (config.nodeEnv === 'production' && config.email?.provider === 'smtp') {
    // Production: generate random code and send via SMTP
    const code = generateCode();
    verificationCodes.set(sanitized, { code, expiresAt, attempts: 0 });
    logger.info(`[EMAIL] Sending verification code to ${sanitized}`);
    // TODO: integrate with SendGrid / AWS SES / SMTP
  } else {
    // Dev/test mode: use fixed code 888888 — no real email sent
    verificationCodes.set(sanitized, { code: DEV_MODE_VERIFICATION_CODE, expiresAt, attempts: 0 });
    logger.info(`[EMAIL:DVI Overification code sent to ${sanitized} (dev mode)`);
  }
}

/**
 * Verify code and issue JWT tokens
 */
export async function verifyCodeAndLogin(
  email: string,
  code: string
): Promise<{ accessToken: string; refreshToken: string; userId: string; isNewUser: boolean; role: string }> {
  const sanitized = sanitizeEmail(email);
  const record = verificationCodes.get(sanitized);

  if (!record) {
    throw Errors.paramError('No verification code sent or code expired');
  }

  if (Date.now() > record.expiresAt) {
    verificationCodes.delete(sanitized);
    throw Errors.paramError('Verification code expired, please request a new one');
  }

  // Check if already locked out before any attempt
  if (record.attempts >= MAX_ATTEMPTS) {
    throw new AppError(
      'Too many verification attempts, please wait 60s',
      429,
      ErrorCode.PARAM_ERROR
    );
  }

  record.attempts += 1;

  if (record.code !== code) {
    if (record.attempts >= MAX_ATTEMPTS) {
      // Set extended expiry for lockout period
      record.expiresAt = Date.now() + LOCKOUT_MS;
      throw new AppError(
        'Verification code incorrect. Too many attempts, locked for 60s',
        429,
        ErrorCode.PARAM_ERROR
      );
    }
    throw Errors.paramError('Verification code incorrect');
  }

  // Code valid — clean up
  verificationCodes.delete(sanitized);

  // Find or create user
  const client = await pool.connect();
  try {
    let user: UserRow | null = null;
    const existing = await client.query('SELECT * FROM users WHERE email = $1', [sanitized]);
    let isNewUser = false;

    if (existing.rows.length > 0) {
      user = existing.rows[0];
    } else {
      const newId = generateId();
      await client.query(
        'INSERT INTO users (id, email, role) VALUES ($1, $2, $3)',
        [newId, sanitized, 'user']
      );
      user = { id: newId, email: sanitized, payment_password_hash: null, hd_wallet_id: null, role: 'user', created_at: new Date() };
      isNewUser = true;
    }

    if (!user) throw new AppError('User lookup failed', 500, ErrorCode.PARAM_ERROR);
    const tokens = generateTokens(user.id, sanitized, user.role);
    return { ...tokens, userId: user.id, isNewUser, role: user.role };
  } finally {
    client.release();
  }
}

/**
 * Verify payment password
 */
export async function verifyPaymentPassword(userId: string, password: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT payment_password_hash FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw Errors.notFound('User');
  }

  const hash: string | null = result.rows[0].payment_password_hash;
  if (!hash) {
    throw Errors.paramError('Payment password not set');
  }

  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    throw Errors.paymentPasswordError();
  }
  return true;
}

/**
 * Set payment password — create or change
 */
export async function setPaymentPassword(
  userId: string,
  newPassword: string,
  oldPassword?: string
): Promise<void> {
  // Validate format
  if (!/^\d{6}$/.test(newPassword)) {
    throw Errors.paramError('Payment password must be 6 digits');
  }

  // Verify old password if changing
  if (oldPassword) {
    const hash = await getPaymentPasswordHash(userId);
    if (hash) {
      const valid = await bcrypt.compare(oldPassword, hash);
      if (!valid) throw Errors.paymentPasswordError();
    }
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await pool.query(
    'UPDATE users SET payment_password_hash = $1 WHERE id = $2',
    [hashed, userId]
  );
}

/**
 * Check if payment password is set
 */
export async function hasPaymentPassword(userId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT payment_password_hash FROM users WHERE id = $1',
    [userId]
  );
  return !!(result.rows[0]?.payment_password_hash);
}

async function getPaymentPasswordHash(userId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT payment_password_hash FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.payment_password_hash || null;
}

/**
 * Refresh JWT token — revokes old token, issues new pair
 */
export async function refreshToken(refreshTokenValue: string): Promise<{ accessToken: string; refreshToken: string }> {
  try {
    // Check if token is already revoked before verifying (defense in depth)
    if (await isTokenRevoked(refreshTokenValue)) {
      throw Errors.unauthorized('Token has been revoked');
    }

    const decoded = jwt.verify(refreshTokenValue, config.jwt.refreshSecret) as AuthPayload;

    // Revoke the old refresh token
    await revokeToken(refreshTokenValue, decoded.userId, 'rotation');

    const tokens = generateTokens(decoded.userId, decoded.email, decoded.role);
    return tokens;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw Errors.unauthorized('Invalid or expired refresh token');
  }
}

/**
 * Logout — revoke the current refresh token (JWT revocation)
 */
export async function logoutUser(refreshTokenValue: string, userId: string): Promise<void> {
  await revokeToken(refreshTokenValue, userId, 'logout');
}

/**
 * Check if a token has been revoked (blacklisted)
 */
export async function isTokenRevoked(token: string): Promise<boolean> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const result = await pool.query(
    'SELECT id FROM token_blacklist WHERE token_hash = $1 AND expires_at > NOW()',
    [tokenHash]
  );
  return result.rows.length > 0;
}

/**
 * Clean up expired verification codes from in-memory Map
 * Runs every 60s to prevent memory leaks
 */
function startCodeCleanup(): void {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, val] of verificationCodes.entries()) {
      if (now > val.expiresAt + LOCKOUT_MS) {
        verificationCodes.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired verification codes from memory`);
    }
  }, 60000);
  if (cleanupInterval && 'unref' in cleanupInterval) {
    cleanupInterval.unref();
  }
}

// Start cleanup on module load
startCodeCleanup();

/**
 * Add a token to the blacklist (revocation)
 * Uses SHA-256 hash to avoid storing raw tokens in DB
 */
async function revokeToken(token: string, userId: string, reason: 'logout' | 'rotation' | 'compromise'): Promise<void> {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded?.exp) return;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(decoded.exp * 1000);

    await pool.query(
      `INSERT INTO token_blacklist (id, token_hash, user_id, reason, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (token_hash) DO NOTHING`,
      [generateId(), tokenHash, userId, reason, expiresAt]
    );

    logger.info('Token revoked', { userId, reason });
  } catch (err: any) {
    logger.warn('Failed to revoke token', { userId, error: err.message });
  }
}

/**
 * Generate access + refresh tokens
 */
function generateTokens(userId: string, email: string, role: string): { accessToken: string; refreshToken: string; role: string } {
  const payload: AuthPayload = { userId, email, role: role as 'user' | 'admin' };
  const accessToken = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as any });
  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn as any });
  return { accessToken, refreshToken, role };
}
