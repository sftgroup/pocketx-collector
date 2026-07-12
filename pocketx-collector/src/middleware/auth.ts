import { Request, Response, NextFunction } from 'express';

/**
 * Placeholder authenticate — admin panel uses Basic Auth (adminAuth middleware).
 * This is kept for potential future JWT usage.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Admin panel relies on adminBasicAuth, not JWT
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  next();
}
