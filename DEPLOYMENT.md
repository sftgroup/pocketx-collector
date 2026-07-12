# PocketX Collector — 部署文档

> 版本：v2.0 | 最后更新：2026-07-12
> 仓库：https://github.com/sftgroup/pocketx-collector

---

## 1. 项目概述

PocketX Collector 是多链区块数据采集服务，支持 7 条 EVM 链的实时区块扫描、标准化事件存储、REST API 数据查询、WebSocket 实时推送、交易广播和代币价格预言机。

### 核心模块

| 模块 | 说明 |
|------|------|
| BlockScanner | 7 链实时区块扫描 + 标准化存储 |
| DataWholesale | 事件查询 + 批量查询 API |
| Relay | 已签名交易广播（7 链 × 3 RPC fallback） |
| Price Oracle | 代币价格三源降级（缓存 → Binance → OKX） |
| WebSocket | 实时事件流，按链过滤 |
| Admin Panel | 管理后台 SPA（Dashboard/RPC Pool/Events/API Keys） |

---

## 2. 环境要求

| 组件 | 版本/说明 |
|------|-----------|
| Node.js | ≥ 20.x |
| PostgreSQL | ≥ 14（推荐 16） |
| Redis | ≥ 6（可选，用于 WebSocket 广播） |
| PM2 | 进程管理 |
| Nginx | 反向代理（可选） |

---

## 3. 生产环境配置

### 3.1 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器 | `43.156.78.59` |
| 端口 | `3000` |
| PM2 进程名 | `pocketx-collector` |
| 数据库 | PostgreSQL `pocketx_collector` @ localhost:5432 |
| 管理员账号 | `admin` / `pocketx123` |
| 管理后台 | `http://43.156.78.59:3000/admin` |

### 3.2 环境变量（`.env`）

```bash
# ── Service ──
PORT=3000
NODE_ENV=production

# ── Database ──
DATABASE_URL=postgresql://pocketx:pocketx123@localhost:5432/pocketx_collector

# ── Admin Panel Auth ──
ADMIN_USERNAME=admin
ADMIN_PASSWORD=pocketx123

# ── JWT ──
JWT_SECRET=<your-jwt-secret>
JWT_REFRESH_SECRET=<your-refresh-secret>

# ── RPC Endpoints (7 chains) ──
SEPOLIA_RPC_URL=https://sepolia.gateway.tenderly.co
SEPOLIA_RPC_URL_2=https://ethereum-sepolia-rpc.publicnode.com
ETH_RPC_URL=https://ethereum-rpc.publicnode.com
ETH_RPC_URL_2=https://1rpc.io/eth
POLYGON_RPC_URL=https://polygon-bor-rpc.publicnode.com
POLYGON_RPC_URL_2=https://1rpc.io/matic
ARBITRUM_RPC_URL=https://arbitrum-one-rpc.publicnode.com
ARBITRUM_RPC_URL_2=https://1rpc.io/arb
OPTIMISM_RPC_URL=https://optimism-rpc.publicnode.com
OPTIMISM_RPC_URL_2=https://1rpc.io/op
BSC_RPC_URL=https://bsc-rpc.publicnode.com
BSC_RPC_URL_2=https://1rpc.io/bnb
BASE_RPC_URL=https://base-rpc.publicnode.com
BASE_RPC_URL_2=https://1rpc.io/base

# ── Logging ──
LOG_LEVEL=info

# ── CORS ──
CORS_ORIGIN=*
```

---

## 4. 部署流程

### 4.1 数据库初始化

```bash
# 创建数据库用户和库
sudo -u postgres psql <<SQL
CREATE USER pocketx WITH PASSWORD 'pocketx123';
CREATE DATABASE pocketx_collector OWNER pocketx;
GRANT ALL PRIVILEGES ON DATABASE pocketx_collector TO pocketx;
SQL
```

应用启动时会自动执行 `migrateEventCollectorTables()` 建表。

### 4.2 安装依赖

```bash
cd /home/ubuntu/pocketX/projects/pocketx-collector
npm install
```

### 4.3 编译 TypeScript

```bash
npm run build        # tsc → dist/
```

### 4.4 启动服务

```bash
# PM2 启动
pm2 start dist/index.js --name pocketx-collector --env production

# 保存 PM2 列表（重启后自动恢复）
pm2 save
pm2 startup
```

### 4.5 验证服务

```bash
# 健康检查
curl http://localhost:3000/health
# → {"status":"ok","uptime":123,"chains":7}

# 管理员后台
curl http://localhost:3000/admin
# → 200 OK (SPA)
```

---

## 5. 项目结构

```
pocketx-collector/
├── src/
│   ├── index.ts              # Express 主入口
│   ├── config.ts             # 配置加载
│   ├── database.ts           # PostgreSQL 连接池
│   ├── logger.ts             # Winston 日志
│   ├── helpers.ts            # 工具函数
│   ├── middleware/
│   │   ├── apiKeyAuth.ts     # API Key 鉴权
│   │   └── sessionAuth.ts    # Session 鉴权
│   ├── routes/
│   │   ├── adminRoutes.ts    # 管理后台 API
│   │   ├── apiKeyRoutes.ts   # API Key CRUD
│   │   ├── dataRoutes.ts     # 数据查询 API
│   │   ├── managementRoutes.ts
│   │   ├── priceRoutes.ts    # 价格查询 API
│   │   └── relayRoutes.ts    # 交易广播 API
│   └── services/
│       ├── scanner.ts        # 区块扫描器（7 链）
│       ├── rpcPool.ts        # RPC 连接池 + 健康检查
│       ├── rpcPoolConfig.ts  # RPC 端点配置（16 端点）
│       ├── dataWholesale.ts  # 数据批发 API 逻辑
│       ├── relayer.ts        # 交易广播
│       ├── normalizer.ts     # 事件标准化
│       ├── eventBus.ts       # WebSocket 事件总线
│       ├── cleaner.ts        # 72h 数据清理
│       ├── migration.ts      # 数据库迁移
│       ├── binanceFutures.ts # Binance 合约价格采集
│       └── okxChainOS.ts     # OKX DEX Token 数据
├── admin-panel/              # 管理后台 SPA（React + Vite）
│   └── src/
│       ├── App.tsx
│       ├── Login.tsx
│       ├── pages/            # Dashboard/RPC Pool/Events/API Keys 等
│       └── styles.css
├── dist/                     # TypeScript 编译产物
├── sdk/
│   └── pocketx-sdk.ts        # TypeScript SDK（零依赖单文件）
├── docs/
│   ├── API.md
│   ├── PocketX_PRD_v1.0.md
│   └── PocketX_TECH_DESIGN_v2.0.md
├── .env                      # 生产环境变量
├── tsconfig.json
└── package.json
```

---

## 6. API 接口一览

### 数据接口

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/v2/data/events` | 查询事件（游标分页） | API Key |
| POST | `/api/v2/data/events/batch` | 批量查询（多地址×多链） | API Key |
| GET | `/api/v2/data/stats` | 事件统计 | API Key |
| GET | `/api/v2/data/price` | 代币价格查询 | API Key |
| GET | `/api/v2/data/market/tokens` | OKX DEX Token 列表 | API Key |

### 交易接口

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/v1/relay` | 广播已签名交易 | API Key |

### WebSocket

| 路径 | 说明 |
|------|------|
| `ws://host:3000/api/v2/data/ws` | 实时事件流，支持 `?chain=ethereum` 过滤 |

### 管理接口

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/admin/login` | 管理员登录 | Session |
| GET | `/api/admin/status` | RPC 状态 + 扫描状态 | Session |
| GET | `/api/admin/api-keys` | API Key 列表 | Session |
| POST | `/api/admin/api-keys` | 创建 API Key | Session |
| DELETE | `/api/admin/api-keys/:id` | 删除 API Key | Session |

---

## 7. 运维命令

### PM2 管理

```bash
pm2 status                     # 查看状态
pm2 logs pocketx-collector     # 查看日志
pm2 restart pocketx-collector  # 重启
pm2 stop pocketx-collector     # 停止
pm2 monit                      # 实时监控
```

### 数据库管理

```bash
# 查看事件表行数
PGPASSWORD=pocketx123 psql -h localhost -U pocketx -d pocketx_collector \
  -c "SELECT COUNT(*) FROM events;"

# 查看事件按链分布
PGPASSWORD=pocketx123 psql -h localhost -U pocketx -d pocketx_collector \
  -c "SELECT chain, COUNT(*) FROM events GROUP BY chain;"

# 手动清理 72h 前数据
PGPASSWORD=pocketx123 psql -h localhost -U pocketx -d pocketx_collector \
  -c "DELETE FROM events WHERE collected_at < NOW() - INTERVAL '72 hours';"
```

### 健康检查

```bash
curl http://localhost:3000/health
# → {"status":"ok","uptime":3600,"scanner":{"chains":{"ethereum":{"block":25465088,...}}}}
```

---

## 8. 常见问题

### OKX 价格数据不可用
- 原因：未配置 OKX API Key
- 解决：Admin Panel → OKX Accounts 添加 Key
- 影响：价格查询降级到 Binance 或缓存

### Binance futures_prices 表为空
- 原因：WebSocket 连接断开或认证失败
- 解决：SSH 到服务器，检查 PM2 日志 `pm2 logs pocketx-collector | grep binance`
- 影响：价格预言机失去一个降级源

### Infura 429（3 链降级）
- 原因：免费 tier 请求限制
- 解决：Admin Panel → RPC Pool 添加额外 Infura key 或切换到备选 RPC
- 影响：Polygon/Arbitrum/Optimism 扫描速度下降

### 事件查询超时
- 原因：events 表 COUNT(*) 在大数据量时慢
- 临时方案：已有 72h TTL 自动清理
- 长期方案：加 pg_cron 做汇总表

---

## 9. 部署记录

| 版本 | 日期 | Commit | 说明 |
|------|------|--------|------|
| v2.0 | 2026-07-05 | `a157c57` | 7 链 RPC 集成 + Admin Panel v2 |
| v2.0 | 2026-07-04 | `d1a54133` | 初始部署 7 链 RPC 集成 |
| v1.0 | — | — | 基础区块扫描服务 |
