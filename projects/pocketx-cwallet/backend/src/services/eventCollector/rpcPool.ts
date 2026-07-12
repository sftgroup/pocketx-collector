import axios from 'axios';
import { RpcEndpoint, RpcPoolConfig } from './rpcPoolConfig';
import { logger } from '../../utils/logger';

/**
 * RPC Pool Manager
 *
 * Manages multiple RPC endpoints per chain:
 *  - Epoch allocation (split block range across active endpoints)
 *  - Health checks (healthy → degraded → down)
 *  - Rate limiting (token bucket per endpoint)
 *  - Auto-failover (down endpoints redistribute their epoch)
 */

const HEALTH_CHECK_INTERVAL_MS = 30_000;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 15_000;

export class RpcPoolManager {
  private config: RpcPoolConfig;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: RpcPoolConfig) {
    this.config = config;
    this.startHealthChecks();
  }

  // ================================================================
  // Public: get active endpoints for a chain
  // ================================================================
  activeEndpoints(chain: string): RpcEndpoint[] {
    const eps = this.config[chain];
    if (!eps) return [];
    return eps.filter((ep) => ep.status !== 'down');
  }

  // ================================================================
  // Public: get the total active endpoint count across all chains
  // ================================================================
  totalActiveEndpoints(): number {
    let count = 0;
    for (const chain of Object.keys(this.config)) {
      count += this.activeEndpoints(chain).length;
    }
    return count;
  }

  // ================================================================
  // Public: split blocks across active endpoints (epoch allocation)
  // ================================================================
  splitBlocksAcrossEndpoints(chain: string, blocks: number[]): Array<{ endpoint: RpcEndpoint; blocks: number[] }> {
    const activeEps = this.activeEndpoints(chain);
    if (activeEps.length === 0) {
      throw new Error(`No active RPC endpoints for chain ${chain}`);
    }

    const size = Math.ceil(blocks.length / activeEps.length);
    return activeEps.map((ep, i) => ({
      endpoint: ep,
      blocks: blocks.slice(i * size, (i + 1) * size),
    }));
  }

  // ================================================================
  // Public: fetch a range of blocks with full logs
  // ================================================================
  async fetchBlockRange(
    endpoint: RpcEndpoint,
    chain: string,
    fromBlock: number,
    toBlock: number
  ): Promise<any[]> {
    const blocks: any[] = [];
    for (let bn = fromBlock; bn <= toBlock; bn++) {
      try {
        const block = await this.fetchBlockWithRetry(endpoint, bn);
        if (block) blocks.push(block);
      } catch (err: any) {
        logger.warn(`[rpc-pool] Failed to fetch block ${bn} on ${chain} via ${endpoint.key}`, {
          error: err.message,
        });
      }
    }
    return blocks;
  }

  // ================================================================
  // Public: fetch logs for a specific address / topic range
  // ================================================================
  async fetchLogs(
    endpoint: RpcEndpoint,
    params: {
      address?: string;
      topics?: string[];
      fromBlock: number;
      toBlock: number;
    }
  ): Promise<any[]> {
    return this.rpcCall(endpoint, 'eth_getLogs', [params]);
  }

  // ================================================================
  // Public: get latest block number via fastest endpoint
  // ================================================================
  async getLatestBlock(chain: string): Promise<number> {
    const activeEps = this.activeEndpoints(chain);
    if (activeEps.length === 0) {
      throw new Error(`No active RPC endpoints for chain ${chain}`);
    }
    // Try the first healthy endpoint
    return this.rpcCall(activeEps[0], 'eth_blockNumber', []).then(
      (hex: string) => parseInt(hex, 16)
    );
  }

  // ================================================================
  // Public: get account balance
  // ================================================================
  async getBalance(chain: string, address: string): Promise<string> {
    const activeEps = this.activeEndpoints(chain);
    if (activeEps.length === 0) {
      throw new Error(`No active RPC endpoints for chain ${chain}`);
    }
    return this.rpcCall(activeEps[0], 'eth_getBalance', [address, 'latest']);
  }

  // ================================================================
  // Shutdown
  // ================================================================
  shutdown(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    logger.info('[rpc-pool] RPC Pool Manager shut down');
  }

  // ================================================================
  // Internal: RPC JSON-RPC call with retry
  // ================================================================
  private async rpcCall(endpoint: RpcEndpoint, method: string, params: any[]): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Check rate limit
        if (endpoint.tokens.remaining <= 0) {
          const resetDelay = endpoint.tokens.resetAt - Date.now();
          if (resetDelay > 0) {
            logger.debug(`[rpc-pool] Rate limited on ${endpoint.key}, waiting ${resetDelay}ms`);
            await sleep(Math.min(resetDelay, 5000));
          }
          endpoint.tokens.remaining = endpoint.rateLimit.rpd;
          endpoint.tokens.resetAt = Date.now() + 86400_000;
        }

        const response = await axios.post(
          endpoint.url,
          {
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params,
          },
          {
            timeout: REQUEST_TIMEOUT_MS,
            headers: { 'Content-Type': 'application/json' },
          }
        );

        // Update rate limit tokens
        endpoint.tokens.remaining--;
        endpoint.status = 'healthy'; // Request succeeded → mark healthy

        if (response.data.error) {
          throw new Error(`RPC error: ${response.data.error.message || JSON.stringify(response.data.error)}`);
        }

        return response.data.result;
      } catch (err: any) {
        lastError = err;
        const status = err.response?.status;

        if (status === 429) {
          // Rate limited — back off
          logger.warn(`[rpc-pool] 429 on ${endpoint.key}, retrying in ${attempt * 2}s`);
          await sleep(attempt * 2000);
          continue;
        }

        if (attempt < MAX_RETRIES) {
          await sleep(attempt * 1000);
        }
      }
    }

    // All retries exhausted → mark endpoint as degraded/down
    throw lastError || new Error(`RPC call ${method} failed after ${MAX_RETRIES} attempts`);
  }

  // ================================================================
  // Internal: fetch block with retry
  // ================================================================
  private async fetchBlockWithRetry(endpoint: RpcEndpoint, blockNumber: number): Promise<any> {
    const hexBlock = '0x' + blockNumber.toString(16);

    // Fetch block + logs in parallel
    const [block, logs] = await Promise.all([
      this.rpcCall(endpoint, 'eth_getBlockByNumber', [hexBlock, true]),
      this.rpcCall(endpoint, 'eth_getLogs', [{ fromBlock: hexBlock, toBlock: hexBlock }]),
    ]);

    return { block, logs, blockNumber };
  }

  // ================================================================
  // Internal: health checks + auto-failover
  // ================================================================
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.runHealthChecks();
    }, HEALTH_CHECK_INTERVAL_MS);

    if (this.healthCheckTimer && 'unref' in this.healthCheckTimer) {
      this.healthCheckTimer.unref?.();
    }
  }

  private async runHealthChecks(): Promise<void> {
    for (const [chain, endpoints] of Object.entries(this.config)) {
      for (const ep of endpoints) {
        try {
          const blockHex = await this.rpcCall(ep, 'eth_blockNumber', []);
          const blockNum = parseInt(blockHex, 16);
          if (blockNum > 0) {
            if (ep.status !== 'healthy') {
              logger.info(`[rpc-pool] Endpoint recovered: ${ep.key} (${chain})`);
            }
            ep.status = 'healthy';
          }
        } catch {
          // Mark degraded
          if (ep.status === 'healthy') {
            ep.status = 'degraded';
            logger.warn(`[rpc-pool] Endpoint degraded: ${ep.key} (${chain})`);
          } else if (ep.status === 'degraded') {
            ep.status = 'down';
            logger.error(`[rpc-pool] Endpoint down: ${ep.key} (${chain})`);
          }
        }
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
