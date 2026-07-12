import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { initDatabase } from './models/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { generalLimiter } from './middleware/rateLimiter';
import { adminBasicAuth } from './middleware/adminAuth';
import { processPendingEvents } from './services/webhookService';
import { migrateEventCollectorTables } from './services/eventCollector/migration';
import { getScanner } from './services/eventCollector/scanner';
import { getCleaner } from './services/eventCollector/cleaner';

// Routes
import authRoutes from './routes/authRoutes';
import walletRoutes from './routes/walletRoutes';
import txRoutes from './routes/txRoutes';
import riskRoutes from './routes/riskRoutes';
import eventRoutes from './routes/eventRoutes';
import safeRoutes from './routes/safeRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import internalRoutes from './routes/internalRoutes';
import saasRoutes from './routes/saasRoutes';
import dataRoutes from './routes/dataRoutes';
import adminRoutes from './routes/adminRoutes';

const app = express();

// ============================================================
// BE-01: API Gateway — Middleware stack
// ============================================================

// Security headers
app.use(helmet());

// CORS (BE-01)
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-CWallet-Signature', 'X-CWallet-Timestamp'],
  credentials: true,
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// JSON parse error handler — catch malformed JSON before it hits route handlers
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in (err as any)) {
    res.status(400).json({ code: 1001, message: 'Invalid JSON in request body', data: null });
    return;
  }
  next(err);
});

// Request logging
app.use(requestLogger);

// Rate limiting (BE-01)
app.use(generalLimiter);

// Health check
app.get('/health', (_req, res) => {
  const scanner = getScanner();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    collectors: scanner.getHealth().collectors,
    rpcEndpoints: scanner.getHealth().endpoints,
  });
});

// ============================================================
// Routes — API v2
// ============================================================

// Auth (BE-02)
app.use('/api/v2/auth', authRoutes);

// Wallet (BE-03)
app.use('/api/v2/wallet', walletRoutes);

// Transactions (BE-04)
app.use('/api/v2/tx', txRoutes);

// Risk Control (BE-05)
app.use('/api/v2/risk', riskRoutes);

// Events / Webhooks (BE-08)
app.use('/api/v2/events', eventRoutes);
app.use('/api/v2/webhooks', eventRoutes);

// Safe multi-sig (3.6)
app.use('/api/v2/safe', safeRoutes);

// Dashboard (F-024, admin only)
app.use('/api/v2/dashboard', dashboardRoutes);

// Internal routes (CWallet API)
app.use('/api/v2/internal', internalRoutes);

// SaaS WaaS routes (F-033 ~ F-037)
app.use('/api/v2/saas', saasRoutes);

// Data routes — Event Collector + Data Wholesale
app.use('/api/v2/data', dataRoutes);

// Admin routes — RPC config, dashboard
app.use('/api/v2/admin', adminRoutes);

// Admin panel (SPA, HTTP Basic Auth)
app.get('/admin', adminBasicAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// ============================================================
// Start Server
// ============================================================

async function start(): Promise<void> {
  try {
    // Initialize database
    await initDatabase();

    // Process any pending webhook events
    await processPendingEvents();

    // Start the HTTP server
    app.listen(config.port, () => {
      logger.info(`PocketX Backend v2.0 started on port ${config.port}`, {
        env: config.nodeEnv,
        chains: config.supportedChains,
      });
    });

    // Initialize Event Collector tables + start Block Scanner + Data Cleaner
    await migrateEventCollectorTables();
    await getScanner().start();
    getCleaner().start();

    // Clean expired token blacklist entries every hour
    const tokenCleanupInterval = setInterval(async () => {
      try {
        const { pool } = await import('./models/database');
        const result = await pool.query(
          'DELETE FROM token_blacklist WHERE expires_at <= NOW()'
        );
        if (result.rowCount && result.rowCount > 0) {
          logger.info('Token blacklist cleanup', { removed: result.rowCount });
        }
      } catch (err: any) {
        logger.error('Token blacklist cleanup error', { error: err.message });
      }
    }, 3600000); // every hour

    // Prevent the intervals from preventing graceful shutdown
    if (tokenCleanupInterval && 'unref' in tokenCleanupInterval) {
      tokenCleanupInterval.unref();
    }

  } catch (err: any) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down');
  getScanner().shutdown();
  getCleaner().shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received — shutting down');
  getScanner().shutdown();
  getCleaner().shutdown();
  process.exit(0);
});

start();

export default app;
