import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { logger } from './logger';
import { migrateEventCollectorTables } from './services/migration';
import { BlockScanner, getScanner } from './services/scanner';
import { DataCleaner } from './services/cleaner';
import adminRoutes from './routes/adminRoutes';
import dataRoutes from './routes/dataRoutes';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pocketx-collector' });
});

// Auth helpers for admin page access
function getAdminToken(req: any): string | null {
  return req.cookies?.admin_token || null;
}
function isAdminAuthed(req: any): boolean {
  return !!(getAdminToken(req));
}

// Admin login page
app.get('/admin/login', (_req, res) => {
  const fs = require('fs');
  let html = fs.readFileSync(path.join(__dirname, '..', 'public', 'login.html'), 'utf8');
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(html);
});

// Admin panel — check cookie, redirect to login if not authed
app.get('/admin', (req, res) => {
  if (isAdminAuthed(req)) {
    const fs = require('fs');
    let html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(html);
  } else {
    res.redirect('/admin/login');
  }
});

// Admin API
app.use('/api/v2/admin', adminRoutes);

// Data wholesale API
app.use('/api/v2/data', dataRoutes);

async function main() {
  await migrateEventCollectorTables();

  const scanner = new BlockScanner();
  await scanner.init();
  scanner.start();

  const cleaner = new DataCleaner();
  cleaner.start();

  const port = config.port || 3000;
  app.listen(port, () => {
    logger.info('PocketX Collector on :${port}');
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
    cleaner.start = () => {}; // no-op
    await scanner.start(); // no-op
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  logger.error('Startup failed', e);
  process.exit(1);
});
