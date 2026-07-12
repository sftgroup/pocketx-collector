import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { apiResponse } from '../utils/helpers';

/**
 * General rate limiter (BE-01)
 * Default: 100 requests per minute per IP
 */
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: apiResponse(null, 'Too many requests, please try again later', 1001),
});

/**
 * Rate limiter for auth endpoints (email verification code sending)
 * Dev: 30 requests per 60s per IP (relaxed for testing)
 * Prod: tighten via env config
 */
const smsMax = config.nodeEnv === 'production' ? 1 : 30;
export const smsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: smsMax,
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  message: apiResponse(null, 'Too many code requests, please wait', 1001),
});

/**
 * Stricter rate limiter for auth verify-code
 * Dev: 50 requests per minute per IP (relaxed for testing)
 * Prod: 5 req/60s per IP (brute force protection)
 */
const verifyMax = config.nodeEnv === 'production' ? 5 : 50;
export const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: verifyMax,
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  message: apiResponse(null, 'Too many verification attempts, please wait', 1001),
});
