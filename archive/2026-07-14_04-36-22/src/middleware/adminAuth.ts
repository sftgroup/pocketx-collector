import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * HTTP Basic Auth middleware for admin panel.
 * Returns 401 with WWW-Authenticate header on failure.
 */
export function adminBasicAuth(req: Request, res: Response, next: NextFunction): void {
  // Admin API routes: check cookie first (set after Basic Auth on /admin page)
  if (req.originalUrl.startsWith('/api/v2/admin')) {
    if (req.cookies?.admin_session === 'valid') {
      return next();
    }
  }

  // Skip auth for non-admin API routes (they use JWT)
  if (req.originalUrl.startsWith('/api/') && !req.originalUrl.startsWith('/api/v2/admin')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="PocketX Admin"');
    res.status(401).send('Unauthorized');
    return;
  }

  try {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const [username, password] = decoded.split(':');

    if (username === config.admin.username && password === config.admin.password) {
      return next();
    }
  } catch {
    // Fall through to 401
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="PocketX Admin"');
  res.status(401).send('Invalid credentials');
}
