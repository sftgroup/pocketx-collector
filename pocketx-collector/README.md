# PocketX Collector

多链数据服务平台 — 链上事件采集 + 交易广播 + 代币价格预言机 + Data API + WebSocket 实时推送。

**服务地址**: `http://43.156.78.59:3000`  
**Admin Panel**: `http://43.156.78.59:3000/admin`  
**代码仓库**: [github.com/sftgroup/pocketX](https://github.com/sftgroup/pocketX) (main)

---

## 功能矩阵

| 模块 | 能力 | 接口 | 费用 |
|------|------|------|------|
| **代币价格预言机** | 查任意代币价格（符号或地址），三源降级：缓存→Binance合约→OKX实时查询 | `GET /api/v2/data/price` | $0 |
| **链上事件采集** | 7 链实时区块扫描 + 标准化存储 (TimescaleDB 2.28) | `GET /api/v2/data/events` | $0 |
| **批量事件查询** | 多地址 × 多链一次请求 | `POST /api/v2/data/events/batch` | $0 |
| **交易广播** | 已签名 tx → 7 链 RPC 广播（每条链 3 个备选 RPC 自动容错） | `POST /api/v1/relay` | $0 |
| **WebSocket 推送** | 实时事件流 + 按链过滤 | `ws://host:3000/api/v2/data/ws` | $0 |
| **市场数据** | OKX DEX Token 价格 (6 链) + Binance 合约价格 (20 主流符号) | `GET /api/v2/data/market/*` | $0 |
| **API Key 鉴权** | 管理员分发 key，记录用量，可启停/限速 | Admin Panel → API Keys | $0 |
| **TypeScript SDK** | 单文件零依赖，完整类型定义，3x 自动重试 | `sdk/pocketx-sdk.ts` | $0 |
| **Admin Panel** | Dashboard/RPC Pool/Events/API Keys/Users/OKX/Market/System (暗色主题 React SPA) | `/admin` | $0 |

---

## 快速接入

```ts
import { PocketX } from './pocketx-sdk';
const px = new PocketX('http://43.156.78.59:3000', 'pkx_xxx');

// 查代币价格（符号或地址，三源自动降级）
const price = await px.price('ethereum', '0xdac17f958d2ee523a2206206994597c13d831ec7');
// → { token: 'USDT', price_usd: 1.0002, source: 'okx_dex' }

// 查链上事件（游标分页）
const events = await px.events.query({ chain: 'ethereum', page_size: 50 });

// 批量查多地址
const batch = await px.events.batch({ chains: ['ethereum','bsc'], addresses: ['0x...','0x...'] });

// 广播交易
const { tx_hash } = await px.relay('ethereum', '0x02f8...');

// 实时事件流
px.ws(['ethereum'], (event) => console.log(event));
```

---

## 支持的多链

| 链 | Scanner | Relay | OKX DEX | Binance | 免费 RPC |
|----|---------|-------|---------|---------|----------|
| Ethereum | ✅ | ✅ | ✅ | ✅ | 3 端点 |
| BSC | ✅ | ✅ | ✅ | ✅ | 3 端点 |
| Polygon | ✅ | ✅ | ✅ | — | 3 端点 |
| Arbitrum | ✅ | ✅ | ✅ | — | 3 端点 |
| Optimism | ✅ | ✅ | ✅ | — | 3 端点 |
| Base | ✅ | ✅ | ✅ | — | 3 端点 |
| Sepolia | ✅ | ✅ | — | — | 3 端点 |

**全部 RPC 免费（$0/月）**：LlamaRPC + Ankr + PublicNode + Tenderly + Infura 免费层

---

## Public API（需 X-API-Key）

### 价格预言机
```
GET /api/v2/data/price?chain=ethereum&token=ETH          # 符号
GET /api/v2/data/price?chain=ethereum&token=0xdac1...    # 合约地址
GET /api/v2/data/price?chain=futures&token=BTC            # Binance 合约
```
降级链路：本地缓存 → Binance 合约 → OKX DEX 实时查询  
响应：`{ token, price_usd, source, updated_at, volume_24h?, market_cap?, ... }`

### 交易广播
```
POST /api/v1/relay  { chain, tx }
→ { tx_hash }
```

### 链上事件
```
GET  /api/v2/data/events              # 游标分页
POST /api/v2/data/events/batch        # 多地址批量
```

### WebSocket
```
ws://host:3000/api/v2/data/ws?chains=ethereum,bsc
→ { type: "event", data: { ... } }
```

### 市场数据
```
GET /api/v2/data/market/tokens          # DEX Token 搜索
GET /api/v2/data/market/token-history   # Token 历史价格
```

### 统计
```
GET /api/v2/data/stats        # 链级统计
GET /api/v2/data/health       # 采集器健康
GET /api/v2/data/checkpoints  # 采集进度
```

---

## Admin Panel

`http://43.156.78.59:3000/admin` | 登录: admin / pocketx123（生产环境请修改）

| 页面 | 功能 |
|------|------|
| **Dashboard** | 7 链扫描状态 + RPC 端点健康 + Binance/OKX 状态，8s 自动刷新 |
| **RPC Pool** | 实时健康状态 (🟢/🟡/🔴)，端点 CRUD，10 个 Provider 模板 |
| **Events** | 事件查询 + CSV 导出 |
| **API Keys** | 生成/管理 API Key，分发给接入方 |
| **Users** | 管理员账号 CRUD |
| **Audit Log** | 操作审计日志 |
| **OKX Accounts** | OKX Web3 API Key 多账户管理 |
| **Market Data** | DEX Token 浏览器 + 采集器健康 |
| **System** | 内存/DB 统计 |

---

## 项目结构

```
pocketx-collector/
├── src/
│   ├── index.ts              # Express 入口 + 路由注册
│   ├── config.ts             # 环境配置（已精简，57 行）
│   ├── database.ts           # PG 连接池 + 数据库迁移
│   ├── helpers.ts            # asyncHandler + apiResponse（已精简，10 行）
│   ├── logger.ts             # Winston 日志
│   ├── middleware/
│   │   ├── sessionAuth.ts    # Cookie session 验证
│   │   └── apiKeyAuth.ts     # X-API-Key 验证中间件
│   ├── routes/
│   │   ├── adminRoutes.ts    # Admin Panel API (cookie)
│   │   ├── apiKeyRoutes.ts   # API Key CRUD
│   │   ├── dataRoutes.ts     # 公开数据 API（events/batch/stats/health/checkpoints）— 已精简
│   │   ├── priceRoutes.ts    # 价格查询 + 市场数据（从 dataRoutes 拆出）
│   │   ├── relayRoutes.ts    # 交易广播
│   │   └── managementRoutes.ts # 用户/审计管理
│   └── services/
│       ├── scanner.ts        # 7 链区块扫描器
│       ├── normalizer.ts     # 事件标准化 + WS 广播
│       ├── rpcPool.ts        # RPC 连接池 + 健康检查
│       ├── rpcPoolConfig.ts  # RPC 端点配置（16 端点）
│       ├── dataWholesale.ts  # 数据查询服务（含批量查询）
│       ├── relayer.ts        # 交易广播服务
│       ├── okxChainOS.ts     # OKX DEX Token 采集 + 按需查询
│       ├── binanceFutures.ts # Binance 合约价格采集
│       ├── cleaner.ts        # 72h 数据清理
│       ├── eventBus.ts       # WebSocket 连接管理
│       └── migration.ts      # 数据库表创建
├── admin-panel/              # React SPA (Vite + TypeScript)
│   ├── src/pages/
│   │   ├── Dashboard.tsx     # 总览面板
│   │   ├── RpcPool.tsx       # RPC 池管理
│   │   ├── Events.tsx        # 事件查询
│   │   ├── ApiKeys.tsx       # API Key 管理
│   │   ├── Users.tsx         # 用户管理
│   │   ├── Audit.tsx         # 审计日志
│   │   ├── OkxAccounts.tsx   # OKX 账号管理
│   │   ├── MarketData.tsx    # 市场数据
│   │   └── System.tsx        # 系统信息
│   └── src/styles.css        # 暗色主题
├── sdk/
│   └── pocketx-sdk.ts        # TypeScript SDK（零依赖，单文件）
├── docs/
│   └── API.md                # 接入文档（11KB，10 个接口完整说明）
├── PRD.md                    # 产品需求文档
├── DEPLOY_RECORDS.md         # 部署记录
└── README.md                 # 本文件
```

---

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 运行时 | Node.js | 20.20 |
| 后端框架 | Express + TypeScript | 5.1 |
| 链交互 | ethers v6 | 6.x |
| WebSocket | ws | 8.x |
| 数据库 | PostgreSQL + TimescaleDB | 16 + 2.28 |
| 前端 | React + Vite + TypeScript | 18 + 5.x |
| 前端路由 | React Router | 6.x |
| 数据源 | 16 免费 RPC 端点 | $0/月 |
| 价格数据 | Binance WebSocket + OKX API | $0/月 |
| 部署 | pm2 + SSH | — |

---

## commit 历史

```
bfe13f98 fix: Binance WS→REST fallback + stats API pg_stat optimization + main() startup isolation
e76735fa docs: add TODO list — PRD v2.0 completion tracking
a8327b23 docs: comprehensive README update — full project structure + commit history + status
d74cc9eb refactor: delete dead code — cwallet residuals in config/helpers/errors
7e221222 refactor: code audit — extract middleware + fix layer inversion
3dc4267f docs: comprehensive rewrite — API文档 + README + SDK
18ab0574 feat: on-demand OKX DEX price lookup for uncached tokens
```

---

## 已知问题

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| 1 | OKX API Key 未配置 | DEX Token 价格数据无法采集 | ⏳ 待 Steven 添加 |
| 2 | ~~Binance futures_prices 表空~~ | — | ✅ 已修复 (REST fallback) |
| 3 | Infura 429 风暴 | polygon/arbitrum/optimism 偶尔跳过扫描 | 🟡 自动降级生效 |
| 4 | ~~events 表 370 万行~~ | — | ✅ 已修复 (pg_stat → 39ms) |

### 已解决问题
- **Binance WS 被限流** (2026-07-05): `fstream.binance.com` WSS 连上但无数据流 → 自动检测静默连接（10s）→ 降级 REST polling（60s 间隔）→ 20 symbols 正常写入
- **Stats API 慢查询** (2026-07-05): `COUNT(*) FROM events` 全表扫描 3.7M 行 → 改用 `pg_stat_user_tables` + `event_checkpoints` → 39ms
- **启动模块偶发崩溃** (2026-07-05): `main()` 中 scanner 初始化异常导致后续模块（Binance/OKX/端口监听）全部跳过 → 各模块独立 try/catch 隔离
- **migration 事务 abort** (2026-07-05): `ADD CONSTRAINT IF NOT EXISTS` PG 不支持 → SAVEPOINT + `pg_constraint` 预检

---

**完整 API 文档**: [docs/API.md](docs/API.md)  
**SDK**: [sdk/pocketx-sdk.ts](sdk/pocketx-sdk.ts)  
**PRD**: [PRD.md](PRD.md)  
**部署记录**: [DEPLOY_RECORDS.md](DEPLOY_RECORDS.md)
