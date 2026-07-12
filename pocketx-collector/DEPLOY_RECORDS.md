# DEPLOY_RECORDS.md — pocketx-collector

## Latest Deploy: 2026-07-05 09:51 CST

| Field | Value |
|-------|-------|
| **Service** | pocketx-collector |
| **Version** | v2.0 — 7-chain RPC integration + Admin Panel v2 |
| **Server** | 43.156.78.59 |
| **Port** | 3000 |
| **Process** | pm2: pocketx-collector |
| **Commit** | a157c572 |
| **Database** | PostgreSQL pocketx_collector@localhost:5432 |

## Previous Deploy: 2026-07-04 19:30 CST

| Field | Value |
|-------|-------|
| **Service** | pocketx-collector |
| **Version** | v2.0 — 7-chain RPC integration + Admin Panel v2 |
| **Server** | 43.156.78.59 |
| **Port** | 3000 |
| **Process** | pm2: pocketx-collector |
| **Commit** | d1a54133 |
| **Database** | PostgreSQL pocketx_collector@localhost:5432 |

### URLs
- Admin Panel: `http://43.156.78.59:3000/admin`
- Health: `http://43.156.78.59:3000/health`
- Data API: `http://43.156.78.59:3000/api/v2/data/events`

### Chains
All 7 chains active: Sepolia, Ethereum, Polygon, Arbitrum, Optimism, BSC, Base
RPC Pool: 14 free endpoints (publicnode.com + 1rpc.io), $0/month

### Admin Panel
- 4 tabs: Dashboard / RPC Pool / Events / System
- Auth: HTTP Basic Auth (admin / pocketx123)
- Live auto-refresh every 10s
