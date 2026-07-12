# Deploy Records

## Frontend (PocketX CWallet)
| Field | Value |
|------|------|
| Service | pocketx-cwallet frontend |
| Location | 101.33.109.117:6102 |
| Path | /var/www/pocketx-dist/ (nginx) |
| Source | projects/pocketx-cwallet/frontend/dist/ |
| Health | curl http://101.33.109.117:6102 -> 200 |

## Backend (PocketX CWallet)
| Field | Value |
|------|------|
| Service | pocketx-cwallet backend |
| Location | 101.33.109.117:6100 |
| Path | /home/ubuntu/pocketx-cwallet/backend/ |
| Source | projects/pocketx-cwallet/backend/src/ |
| Health | curl http://101.33.109.117:6100/health -> {"status":"ok"} |

## On-Chain Contracts (Sepolia, Deployed 2026-07-01)
| Contract | Address | Tx Hash |
|------|------|------|
| SafeProxyFactory | 0xfc7fa546b24477e8a2ce3a8d39869b122017ea2b | 0x5a5ff062a1292e88612281076a3cf61c31af5a2aaf4e3637b1acd42e1076ac89 |
| GasSponsor | 0xd31fa3f33ce097775ab453a09df5b6dd8319d9a4 | 0x4a59b3703b3c04abc86fc5553238ff0ed118b7d326761543c287ec85e91656ae |
| Safe Singleton (Gnosis v1.3.0) | 0xd9Db270c1B5E3Bd161E8c8503c55cE2eE09156F0 | (pre-deployed) |
| Network | Sepolia | Chain ID: 11155111 |
| Tool | Foundry forge script --broadcast | |

## Latest Deploys
- 2026-06-30: chainId fix, SendModal/ReceiveModal fallback, ErrorBoundary stack traces
- 2026-07-01: SafeProxyFactory + GasSponsor on-chain deployment
- 2026-07-01: Admin charts + QR scan + batch progress + webhook retry + confirm/reject
