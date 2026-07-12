import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { RpcPoolManager } from './rpcPool';
import { pool } from '../../models/database';
import { logger } from '../../utils/logger';

/**
 * Event Normalizer
 *
 * Converts raw on-chain data into standardized events records.
 * Responsibilities:
 *  - Address checksumming (ethers.getAddress)
 *  - Amount normalization (wei → decimal)
 *  - Chain name normalization
 *  - Event deduplication (txHash + logIndex)
 */

const CONFIRMATIONS_REQUIRED = 3; // Sepolia uses 3, Eth mainnet 12

export interface NormalizedEvent {
  event_id: string;
  event_type: string;
  source: string;
  chain: string;
  block_number: number;
  tx_hash: string;
  log_index: number;
  contract_address: string | null;
  from_address: string | null;
  to_address: string | null;
  token_address: string | null;
  token_symbol: string | null;
  token_id: string | null;
  amount: string | null;
  amount_raw: string | null;
  event_data: Record<string, any>;
  topic_hash: string | null;
  status: string;
  confirmations: number;
}

/** Safely convert hex string to BigInt — returns 0n for empty/invalid hex */
function safeBigInt(hex: string): bigint {
  try {
    if (!hex || hex === '0x' || hex === '0x0') return 0n;
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

/** Safely parse a hex string to a number — returns 0 for empty/invalid hex */
function safeParseInt(hex: string): number {
  try {
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    return parseInt(hex, 16);
  } catch {
    return 0;
  }
}

/**
 * Extract and normalize all events from a raw block+logs
 */
export function normalizeBlock(rawBlock: any, chain: string): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const { block, logs } = rawBlock;

  if (!block || !block.transactions) return events;

  const blockNumber = safeParseInt(block.number);
  const blockTimestamp = safeParseInt(block.timestamp);

  // 1. Extract ETH transfers from transactions
  for (const tx of block.transactions) {
    if (!tx.hash) continue;
    const txHashStr = tx.hash;

    // ETH transfer (value > 0)
    const valueWei = safeBigInt(tx.value || '0x0');
    if (valueWei > 0n) {
      events.push({
        event_id: `${txHashStr}_0`,
        event_type: 'transfer',
        source: 'blockchain',
        chain: normalizeChainName(chain),
        block_number: blockNumber,
        tx_hash: txHashStr,
        log_index: 0,
        contract_address: null,
        from_address: safeChecksum(tx.from),
        to_address: safeChecksum(tx.to),
        token_address: null,
        token_symbol: nativeToken(chain),
        token_id: null,
        amount: ethers.formatEther(valueWei),
        amount_raw: valueWei.toString(),
        event_data: {
          gas: safeParseInt(tx.gas || '0x0'),
          gasPrice: safeParseInt(tx.gasPrice || '0x0'),
          nonce: safeParseInt(tx.nonce || '0x0'),
          input: tx.input?.length > 500 ? tx.input.slice(0, 500) + '...' : tx.input,
        },
        topic_hash: null,
        status: 'confirmed',
        confirmations: CONFIRMATIONS_REQUIRED,
      });
    }
  }

  // 2. Extract ERC-20 Transfer events from logs
  if (logs && Array.isArray(logs)) {
    for (const log of logs) {
      const topics = log.topics || [];
      const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

      if (topics.length >= 3 && topics[0] === TRANSFER_TOPIC) {
        const logIndex = safeParseInt(log.logIndex || '0');
        const dataHex = log.data && log.data !== '0x' ? log.data : '0x0';

        events.push({
          event_id: `${log.transactionHash || '0xunknown'}_${logIndex}`,
          event_type: 'transfer',
          source: 'blockchain',
          chain: normalizeChainName(chain),
          block_number: blockNumber,
          tx_hash: log.transactionHash || '',
          log_index: logIndex,
          contract_address: safeChecksum(log.address),
          from_address: topics[1] ? topicToAddress(topics[1]) : null,
          to_address: topics[2] ? topicToAddress(topics[2]) : null,
          token_address: safeChecksum(log.address),
          token_symbol: null,
          token_id: null,
          amount: ethers.formatUnits(safeBigInt(dataHex), 0),
          amount_raw: safeBigInt(dataHex).toString(),
          event_data: {
            blockTimestamp,
            logIndex,
            removed: log.removed || false,
          },
          topic_hash: TRANSFER_TOPIC,
          status: 'confirmed',
          confirmations: CONFIRMATIONS_REQUIRED,
        });
      }
    }
  }

  return events;
}

/**
 * Insert normalized events into the database (idempotent on event_id).
 * Uses SAVEPOINT per row so one bad record doesn't abort the entire batch.
 */
export async function insertEvents(events: NormalizedEvent[]): Promise<number> {
  if (events.length === 0) return 0;

  const client = await pool.connect();
  let insertedCount = 0;

  try {
    // Wrap entire batch in one transaction; use SAVEPOINTs so one bad row
    // doesn't abort the whole batch.
    await client.query('BEGIN');

    for (const evt of events) {
      try {
        await client.query('SAVEPOINT sp');
        await client.query(
          `INSERT INTO events (
            id, event_id, event_type, source, chain, block_number, tx_hash, log_index,
            contract_address, from_address, to_address, token_address, token_symbol,
            token_id, amount, amount_raw, event_data, topic_hash, status, confirmations,
            collected_at, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19, $20,
            NOW(), NOW()
          )
          ON CONFLICT (event_id) DO UPDATE SET confirmations = EXCLUDED.confirmations`,
          [
            uuidv4(),
            evt.event_id,
            evt.event_type,
            evt.source,
            evt.chain,
            evt.block_number,
            evt.tx_hash,
            evt.log_index,
            evt.contract_address,
            evt.from_address,
            evt.to_address,
            evt.token_address,
            evt.token_symbol,
            evt.token_id,
            evt.amount,
            evt.amount_raw,
            JSON.stringify(evt.event_data),
            evt.topic_hash,
            evt.status,
            evt.confirmations,
          ]
        );
        await client.query('RELEASE SAVEPOINT sp');
        insertedCount++;
      } catch (err: any) {
        await client.query('ROLLBACK TO SAVEPOINT sp').catch(() => {});
        if (err.code !== '23505') {
          logger.warn('[normalizer] Failed to insert event', { event_id: evt.event_id, error: err.message });
        }
      }
    }

    await client.query('COMMIT');
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('[normalizer] Insert batch failed', { error: err.message });
    throw err;
  } finally {
    client.release();
  }

  return insertedCount;
}

/**
 * Update checkpoint after a successful scan cycle
 */
export async function updateCheckpoint(chain: string, collectorName: string, lastBlock: number, lastTxHash?: string): Promise<void> {
  await pool.query(
    `UPDATE event_checkpoints
     SET last_block = $1, last_tx_hash = $2, last_fetch_at = NOW(), status = 'running', error_message = NULL
     WHERE chain = $3 AND collector_name = $4`,
    [lastBlock, lastTxHash || null, chain, collectorName]
  );
}

/**
 * Get the last scanned block for a chain+collector
 */
export async function getCheckpoint(chain: string, collectorName: string): Promise<number> {
  const result = await pool.query(
    'SELECT last_block FROM event_checkpoints WHERE chain = $1 AND collector_name = $2',
    [chain.toLowerCase(), collectorName]
  );
  return result.rows.length > 0 ? parseInt(result.rows[0].last_block, 10) : 0;
}

// ================================================================
// Helpers
// ================================================================

function safeChecksum(address: string | null | undefined): string | null {
  if (!address) return null;
  try {
    return ethers.getAddress(address);
  } catch {
    return null;
  }
}

function topicToAddress(topic: string): string {
  try {
    return ethers.getAddress('0x' + topic.slice(26));
  } catch {
    return topic;
  }
}

function normalizeChainName(chain: string): string {
  const map: Record<string, string> = {
    eth: 'ethereum',
    ethereum: 'ethereum',
    sepolia: 'sepolia',
    polygon: 'polygon',
    matic: 'polygon',
    arbitrum: 'arbitrum',
    optimism: 'optimism',
    op: 'optimism',
    bsc: 'bsc',
    base: 'base',
  };
  return map[chain.toLowerCase()] || chain.toLowerCase();
}

function nativeToken(chain: string): string {
  const map: Record<string, string> = {
    sepolia: 'sETH',
    ethereum: 'ETH',
    polygon: 'MATIC',
    arbitrum: 'ETH',
    optimism: 'ETH',
    bsc: 'BNB',
    base: 'ETH',
  };
  return map[chain.toLowerCase()] || 'ETH';
}
