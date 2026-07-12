import { pool } from '../../models/database';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database migration: Event Collector tables
 *
 * events         — full-chain block data (72h retention)
 * event_checkpoints — per-collector scanning progress (permanent)
 * payment_events  — payment-linked events for reconciliation (permanent)
 */

export async function migrateEventCollectorTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ============================================================
    // events table — all on-chain events from all chains
    // ============================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY,
        event_id VARCHAR(128) UNIQUE NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        source VARCHAR(20) NOT NULL DEFAULT 'blockchain',
        chain VARCHAR(20) NOT NULL,
        block_number BIGINT NOT NULL,
        tx_hash VARCHAR(66) NOT NULL,
        log_index INTEGER DEFAULT 0,
        contract_address VARCHAR(42),
        from_address VARCHAR(42),
        to_address VARCHAR(42),
        token_address VARCHAR(42),
        token_symbol VARCHAR(20),
        token_id VARCHAR(78),
        amount NUMERIC(78, 0),
        amount_raw VARCHAR(78),
        event_data JSONB DEFAULT '{}',
        topic_hash VARCHAR(66),
        status VARCHAR(20) DEFAULT 'confirmed',
        confirmations INTEGER DEFAULT 1,
        collected_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ============================================================
    // Core indexes (high-frequency query paths)
    // ============================================================
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_chain_block ON events (chain, block_number DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_from_address ON events (from_address);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_to_address ON events (to_address);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_contract ON events (contract_address);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_tx_hash ON events (tx_hash);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_collected_at ON events (collected_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_event_id ON events (event_id);`);

    // Composite indexes for high-frequency queries
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_chain_type_block ON events (chain, event_type, block_number DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_to_chain_block ON events (to_address, chain, block_number DESC);`);

    // ============================================================
    // event_checkpoints — scanning progress per collector per chain
    // ============================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_checkpoints (
        id UUID PRIMARY KEY,
        chain VARCHAR(20) NOT NULL,
        collector_name VARCHAR(50) NOT NULL,
        last_block BIGINT NOT NULL DEFAULT 0,
        last_tx_hash VARCHAR(66),
        last_fetch_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'running',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(chain, collector_name)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_checkpoints_chain_collector ON event_checkpoints (chain, collector_name);`);

    // ============================================================
    // payment_events — payment-linked events (permanent)
    // ============================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_events (
        id UUID PRIMARY KEY,
        event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        order_id VARCHAR(64) NOT NULL,
        matched_by VARCHAR(20) DEFAULT 'address_match',
        confidence DECIMAL(3, 2) DEFAULT 1.00,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events (order_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_events_event ON payment_events (event_id);`);

    // ============================================================
    // admin_rpc_config — RPC endpoint configuration (managed via admin panel)
    // ============================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_rpc_config (
        id SERIAL PRIMARY KEY,
        chain VARCHAR(20) NOT NULL,
        endpoint_key VARCHAR(50) NOT NULL,
        url TEXT NOT NULL,
        provider VARCHAR(30) DEFAULT 'custom',
        tier VARCHAR(20) DEFAULT 'free',
        rpm INTEGER DEFAULT 60,
        rpd INTEGER DEFAULT 10000,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(chain, endpoint_key)
      );
    `);

    // ============================================================
    // Seed checkpoints for all supported chains
    // ============================================================
    const chains = ['sepolia', 'ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc', 'base'];
    for (const chain of chains) {
      await client.query(
        `INSERT INTO event_checkpoints (id, chain, collector_name, last_block, status)
         VALUES ($1, $2, 'block_scanner', 0, 'running')
         ON CONFLICT (chain, collector_name) DO NOTHING`,
        [uuidv4(), chain]
      );
    }

    await client.query('COMMIT');
    logger.info('[migration] Event Collector tables created successfully', {
      tables: ['events', 'event_checkpoints', 'payment_events'],
      chains: chains.length,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    logger.error('[migration] Failed to create Event Collector tables', { error: err.message });
    throw err;
  } finally {
    client.release();
  }
}
