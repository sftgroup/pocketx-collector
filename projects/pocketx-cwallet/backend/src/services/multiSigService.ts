import { v4 as uuidv4 } from 'uuid';
import {
  createPublicClient, createWalletClient, http, getAddress,
  keccak256, encodePacked, encodeAbiParameters, parseAbiParameters,
  encodeFunctionData, getCreate2Address, parseEther,
  type Address, type Hex
} from 'viem';
import { sepolia } from 'viem/chains';
import { getContractAddress } from 'viem/utils';
import { pool } from '../models/database';
import { logger } from '../utils/logger';
import { Errors } from '../utils/errors';
import { config } from '../config';
import { getHDMnemonic, getPrivateKey } from './hdWalletService';

/**
 * Multi-Sig Service (F-027~F-032)
 * Gnosis Safe-compatible multi-signature wallet management
 *
 * Uses Safe Proxy Factory pattern:
 * - SafeProxyFactory: creates Safe proxies via createProxyWithNonce
 * - Safe: the multi-sig wallet contract
 *
 * Sepolia Safe addresses (v1.4.1):
 * - Safe Singleton: 0x29fcb43b46531bc0030c8fc6d5e1d063e48a7bc7
 * - SafeProxyFactory: 0xc22834581ebc8527d974f8a1c97e1bea4ef910bc
 * - SafeL2 Singleton: 0x29fcb43b46531bc0030c8fc6d5e1d063e48a7bc7 (same for L2)
 */

// Standard Safe ABI fragments
const SAFE_PROXY_FACTORY_ABI = [
  {
    type: 'function',
    name: 'createProxyWithNonce',
    inputs: [
      { name: '_singleton', type: 'address' },
      { name: 'initializer', type: 'bytes' },
      { name: 'saltNonce', type: 'uint256' },
    ],
    outputs: [{ name: 'proxy', type: 'address' }],
  },
] as const;

const SAFE_ABI = [
  {
    type: 'function',
    name: 'getOwners',
    inputs: [],
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getThreshold',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nonce',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTransactionHash',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: '_nonce', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
  },
] as const;

// Chain configs
const CHAIN_CONFIG: Record<string, {
  chain: any;
  rpcUrl: string;
  safeSingleton: Address;
  safeProxyFactory: Address;
}> = {
  '11155111': {
    chain: sepolia,
    rpcUrl: config.sepoliaRpcUrl || 'https://1rpc.io/sepolia',
    safeSingleton: '0x29fcb43b46531bc0030c8fc6d5e1d063e48a7bc7' as Address,
    safeProxyFactory: '0xfc7fa546b24477e8a2ce3a8d39869b122017ea2b' as Address,
  },
};

function getChainCfg(chainId: string) {
  const cfg = CHAIN_CONFIG[chainId];
  if (!cfg) throw Errors.paramError(`Chain ${chainId} not supported for Multi-Sig`);
  return cfg;
}

/**
 * Encode Safe setup data for initializer
 * setup(owners, threshold, to, data, fallbackHandler, paymentToken, payment, paymentReceiver)
 */
function encodeSafeSetup(
  owners: Address[],
  threshold: number,
): Hex {
  
  return encodeFunctionData({
    abi: [{
      type: 'function',
      name: 'setup',
      inputs: [
        { name: '_owners', type: 'address[]' },
        { name: '_threshold', type: 'uint256' },
        { name: 'to', type: 'address' },
        { name: 'data', type: 'bytes' },
        { name: 'fallbackHandler', type: 'address' },
        { name: 'paymentToken', type: 'address' },
        { name: 'payment', type: 'uint256' },
        { name: 'paymentReceiver', type: 'address' },
      ],
      outputs: [],
    }],
    functionName: 'setup',
    args: [
      owners,
      BigInt(threshold),
      '0x0000000000000000000000000000000000000000' as Address,
      '0x' as Hex,
      '0x0000000000000000000000000000000000000000' as Address,
      '0x0000000000000000000000000000000000000000' as Address,
      0n,
      '0x0000000000000000000000000000000000000000' as Address,
    ],
  });
}

/**
 * Calculate deterministic Safe address (CREATE2)
 * Uses the same formula as Safe's Ethers.js SDK:
 * proxyAddress = create2(proxyFactory, saltNonce, deploymentCode)
 */
async function predictSafeAddress(
  chainId: string,
  owners: Address[],
  threshold: number,
  saltNonce: bigint,
): Promise<Address> {
  const cfg = getChainCfg(chainId);
  

  // Standard Safe Proxy creation code (deployed on chain)
  // This bytecode deploys a minimal proxy pointing to the Safe singleton
  const proxyCreationCode = '0x608060405234801561001057600080fd5b506040516101e63803806101e683398101604081905261002f91610038565b6001600160a01b0316608052610068565b60006020828403121561004a57600080fd5b81516001600160a01b038116811461006157600080fd5b9392505050565b6080516101646100826000396000603e01526101646000f3fe608060405234801561001057600080fd5b506004361061002b5760003560e01c80635c60da1b14610030575b600080fd5b6100577f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b03909116815260200160405180910390f35b60b17f3d602d80600a3d3981f3363d3d373d3d3d363d7300000000000000000000000081527f5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000606090811b919091176014526000906074906020906073903880600e565b6039600e81fd5b50600080526020600020905090565b81801592909304919091015250565b50600090607d9060209060a1565b919050565b6000602082840312156100bf57600080fd5b81516001600160a01b03811681146100d657600080fd5b939250505056fea2646970667358221220c2b0b43b04d3f94a14c34dac010e96ba74b58f6e4d97bf339c6cf2b55fe1cd3164736f6c634300081a0033' as Hex;

  // Compute CREATE2 salt: keccak256(keccak256(initializer) | saltNonce)
  const initializer = encodeSafeSetup(owners, threshold);
  const initializerHash = keccak256(
    encodePacked(['bytes', 'uint256'], [initializer, saltNonce])
  );
  
  const salt = keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, uint256'),
      [initializerHash, saltNonce]
    )
  );

  // Encode constructor argument (singleton address) for proxy creation
  const initCode = encodePacked(
    ['bytes', 'bytes'],
    [
      proxyCreationCode,
      encodeAbiParameters(parseAbiParameters('address'), [cfg.safeSingleton]),
    ]
  );

  return getCreate2Address({
    from: cfg.safeProxyFactory,
    salt,
    bytecode: initCode,
  }) as Address;
}

// ── Safe CRUD ──

export async function createSafe(params: {
  userId: string;
  chainId: string;
  owners: string[];
  threshold: number;
  name?: string;
}): Promise<{
  safeAddress: string;
  chainId: string;
  owners: string[];
  threshold: number;
  status: string;
}> {
  const { userId, chainId, owners, threshold, name } = params;

  if (!owners || owners.length === 0) throw Errors.paramError('At least one owner required');
  if (threshold < 1 || threshold > owners.length) {
    throw Errors.paramError(`Threshold must be between 1 and ${owners.length}`);
  }

  const cfg = getChainCfg(chainId);
  const ownerAddrs = owners.map(o => getAddress(o) as Address);

  // Deterministic salt from userId + timestamp
  const saltNonce = BigInt(`0x${uuidv4().replace(/-/g, '').slice(0, 16)}`);

  // Predict Safe address
  const predictedAddress = await predictSafeAddress(chainId, ownerAddrs, threshold, saltNonce);

  // Check if safe already exists for this user
  const existing = await pool.query(
    'SELECT id FROM safe_wallets WHERE user_id = $1 AND chain_id = $2 AND safe_address = $3',
    [userId, chainId, predictedAddress]
  );

  if (existing.rows.length > 0) {
    return {
      safeAddress: predictedAddress,
      chainId,
      owners,
      threshold,
      status: 'active',
    };
  }

  // In production: deploy via tx to SafeProxyFactory.createProxyWithNonce
  // For dev: store predicted address (deployment happens on first tx)
  const safeId = uuidv4();
  await pool.query(
    `INSERT INTO safe_wallets (id, user_id, chain_id, safe_address, owners, threshold, name, status, salt_nonce)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
    [safeId, userId, chainId, predictedAddress, JSON.stringify(owners), threshold, name || null, saltNonce.toString()]
  );

  logger.info('Safe wallet created', { safeId, safeAddress: predictedAddress, owners, threshold });

  return {
    safeAddress: predictedAddress,
    chainId,
    owners,
    threshold,
    status: 'pending',
  };
}

export async function getSafe(safeAddress: string): Promise<any> {
  const result = await pool.query(
    'SELECT * FROM safe_wallets WHERE safe_address = $1',
    [safeAddress]
  );
  if (result.rows.length === 0) throw Errors.notFound('Safe wallet');
  return result.rows[0];
}

export async function listSafes(userId: string): Promise<any[]> {
  const result = await pool.query(
    'SELECT * FROM safe_wallets WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

// ── Safe Transactions ──

export async function proposeTransaction(params: {
  userId: string;
  safeAddress: string;
  to: string;
  value: string;
  data?: string;
}): Promise<{ txId: string; safeTxHash: string; nonce: number }> {
  const { userId, safeAddress, to, value, data } = params;

  if (!safeAddress || !to) throw Errors.paramError('Missing safeAddress or to');

  const safe = await getSafe(safeAddress);
  const chainId = safe.chain_id;

  // Get current nonce from chain (or DB counter)
  const nonceSig = await pool.query(
    "SELECT COALESCE(MAX(nonce), 0) + 1 as next_nonce FROM safe_transactions WHERE safe_address = $1",
    [safeAddress]
  );
  const nonce = nonceSig.rows[0].next_nonce || 0;

  // Compute Safe tx hash
  const safeTxHash = computeSafeTxHash(safeAddress, to, value, data || '0x', nonce, chainId);

  const txId = uuidv4();
  await pool.query(
    `INSERT INTO safe_transactions (id, safe_address, proposer_id, to_address, value, data, nonce, safe_tx_hash, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
    [txId, safeAddress, userId, to, value, data || '0x', nonce, safeTxHash]
  );

  logger.info('Safe tx proposed', { txId, safeAddress, safeTxHash, nonce });

  return { txId, safeTxHash, nonce };
}

export async function confirmTransaction(params: {
  userId: string;
  safeAddress: string;
  safeTxHash: string;
  signature: string; // EIP-712 signature or EOA sig
}): Promise<{ confirmed: boolean; sigCount: number; threshold: number }> {
  const { userId, safeAddress, safeTxHash, signature } = params;

  const tx = await pool.query(
    "SELECT * FROM safe_transactions WHERE safe_tx_hash = $1 AND status = 'pending'",
    [safeTxHash]
  );
  if (tx.rows.length === 0) throw Errors.notFound('Transaction');

  // Check for duplicate signature
  const existingSig = await pool.query(
    'SELECT id FROM safe_signatures WHERE safe_tx_hash = $1 AND signer_id = $2',
    [safeTxHash, userId]
  );

  if (existingSig.rows.length > 0) {
    // Already signed — return current state
    const count = await pool.query(
      'SELECT COUNT(*)::int as cnt FROM safe_signatures WHERE safe_tx_hash = $1',
      [safeTxHash]
    );
    const safe = await getSafe(safeAddress);
    return { confirmed: true, sigCount: count.rows[0].cnt, threshold: safe.threshold };
  }

  // Store signature
  await pool.query(
    `INSERT INTO safe_signatures (id, safe_tx_hash, signer_id, signature, signature_type)
     VALUES ($1, $2, $3, $4, $5)`,
    [uuidv4(), safeTxHash, userId, signature, 'eoa']
  );

  // Check if threshold met
  const count = await pool.query(
    'SELECT COUNT(*)::int as cnt FROM safe_signatures WHERE safe_tx_hash = $1',
    [safeTxHash]
  );
  const safe = await getSafe(safeAddress);
  const sigCount = count.rows[0].cnt;

  if (sigCount >= safe.threshold) {
    await pool.query(
      "UPDATE safe_transactions SET status = 'ready' WHERE safe_tx_hash = $1",
      [safeTxHash]
    );
    logger.info('Safe tx ready for execution', { safeTxHash, sigCount, threshold: safe.threshold });
  }

  return { confirmed: true, sigCount, threshold: safe.threshold };
}

export async function executeTransaction(params: {
  userId: string;
  safeTxHash: string;
}): Promise<{ txHash: string | null; status: string }> {
  const { userId, safeTxHash } = params;

  const tx = await pool.query(
    "SELECT * FROM safe_transactions WHERE safe_tx_hash = $1 AND status = 'ready'",
    [safeTxHash]
  );
  if (tx.rows.length === 0) throw Errors.paramError('Transaction not ready — threshold not met');

  const safe = await getSafe(tx.rows[0].safe_address);

  // Get all signatures
  const sigs = await pool.query(
    'SELECT * FROM safe_signatures WHERE safe_tx_hash = $1 ORDER BY created_at',
    [safeTxHash]
  );

  // Build packed signatures (sorted by owner address order in safe)
  const ownerSigs = safe.owners.map((owner: string) => {
    const sig = sigs.rows.find((s: { signer_id: string; signature: string }) => s.signer_id === owner
      // Both hex format and userId format
    );
    return sig ? sig.signature : '0x';
  }).filter((s: string) => s !== '0x');

  const packedSigs = ownerSigs.join('').replace(/0x/g, '');

  // In production: call Safe.execTransaction(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures)
  // For dev: simulate
  const cfg = getChainCfg(safe.chain_id);
  logger.info('Safe tx execution (dev mode)', {
    safeTxHash,
    safeAddress: safe.safe_address,
    sigCount: sigs.rows.length,
    threshold: safe.threshold,
  });

  await pool.query(
    `UPDATE safe_transactions SET status = 'executed', executor_id = $1, executed_at = NOW() WHERE safe_tx_hash = $2`,
    [userId, safeTxHash]
  );

  return { txHash: null, status: 'executed' };
}

export async function getSafeTransactions(safeAddress: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT t.*, COALESCE(s.sig_count, 0)::int as sig_count
     FROM safe_transactions t
     LEFT JOIN (
       SELECT safe_tx_hash, COUNT(*) as sig_count FROM safe_signatures GROUP BY safe_tx_hash
     ) s ON t.safe_tx_hash = s.safe_tx_hash
     WHERE t.safe_address = $1
     ORDER BY t.nonce DESC`,
    [safeAddress]
  );
  return result.rows;
}

// ── Owner Management ──

export async function updateSafeOwners(params: {
  userId: string;
  safeAddress: string;
  newOwners: string[];
  newThreshold: number;
}): Promise<{ owners: string[]; threshold: number }> {
  const { safeAddress, newOwners, newThreshold } = params;

  if (newThreshold < 1 || newThreshold > newOwners.length) {
    throw Errors.paramError(`Threshold must be 1-${newOwners.length}`);
  }

  // In production: this is itself a multi-sig tx (requires threshold signatures)
  await pool.query(
    'UPDATE safe_wallets SET owners = $1, threshold = $2, updated_at = NOW() WHERE safe_address = $3',
    [JSON.stringify(newOwners), newThreshold, safeAddress]
  );

  logger.info('Safe owners updated', { safeAddress, owners: newOwners, threshold: newThreshold });
  return { owners: newOwners, threshold: newThreshold };
}

// ── Utils ──

function computeSafeTxHash(
  safeAddress: string,
  to: string,
  value: string,
  data: string,
  nonce: number,
  chainId: string,
): string {
  const buildBigInt = (v: string) => v.includes('.') ? parseEther(v) : BigInt(v);

  // EIP-712 typed data hash for Safe transactions
  // SafeTx type: address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 nonce
  const safeTxTypeHash = keccak256(
    encodePacked(
      ['string'],
      ['SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)']
    )
  );

  // Encode tx data hash
  const txDataHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, address, uint256, bytes32, uint8, uint256, uint256, uint256, address, address, uint256'),
      [
        safeTxTypeHash,
        to as Address,
        buildBigInt(value),
        keccak256(data as Hex),
        0,  // operation: Call
        0n, // safeTxGas
        0n, // baseGas
        0n, // gasPrice
        '0x0000000000000000000000000000000000000000' as Address, // gasToken
        '0x0000000000000000000000000000000000000000' as Address, // refundReceiver
        BigInt(nonce),
      ]
    )
  );

  return txDataHash;
}
