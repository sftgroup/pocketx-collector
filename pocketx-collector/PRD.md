# PocketX Collector — PRD

> 版本: v2.0 | 日期: 2026-07-05 | 作者: Steven Wang

---

## 1. 产品概述

PocketX Collector 是 PocketX 生态的**多链数据基础设施**，为内部中心化平台和外部合作伙伴提供统一的链上数据访问和交易广播能力。

### 核心定位

- **数据采集**：7 条 EVM 链的实时区块事件 + DEX 代币数据 + CEX 合约价格
- **数据服务**：REST API + WebSocket，标准化输出，API Key 鉴权
- **交易广播**：多链 RPC relayer，托管签名后的交易广播
- **价格预言机**：单次查询任意代币价格，OKX DEX + Binance 双源降级

### 目标用户

| 角色 | 使用场景 |
|------|---------|
| 中心化平台后端 | 查用户链上交易记录、代币余额变化 |
| 内部数据产品 | 市场看板、代币价格展示 |
| 合作伙伴 | 接入 PocketX 数据 API 做二次开发 |

---

## 2. 功能清单

| 功能 ID | 功能名称 | 涉及端 | 优先级 |
|---------|---------|--------|--------|
| F-001 | 多链区块事件采集 (7链) | 后端 | P0 |
| F-002 | RPC Pool 负载均衡 + 健康检查 | 后端 | P0 |
| F-003 | 链上事件查询 API (游标分页) | 后端 | P0 |
| F-004 | 批量地址查询 API | 后端 | P1 |
| F-005 | API Key 鉴权 + 管理员 CRUD | 后端+前端 | P0 |
| F-006 | 交易广播 API (POST /relay) | 后端 | P0 |
| F-007 | 代币价格查询 API (OKX + Binance) | 后端 | P1 |
| F-008 | OKX ChainOS DEX 代币数据采集 | 后端 | P1 |
| F-009 | Binance 合约价格采集 (WebSocket) | 后端 | P1 |
| F-010 | WebSocket 事件实时推送 | 后端 | P1 |
| F-011 | TypeScript SDK 封装 | SDK | P1 |
| F-012 | Admin Panel 管理面板 | 前端 | P0 |
| F-013 | 数据清理 (72h TTL) | 后端 | P0 |

---

## 3. 系统架构

```
                         ┌──────────────────┐
                         │   接入方 (SDK)    │
                         │ PocketX(URL,key) │
                         └────────┬─────────┘
                                  │ X-API-Key
                    ┌─────────────┼───────────────┐
                    │             │               │
              ┌─────▼──────┐ ┌───▼──────┐ ┌──────▼──────┐
              │ Price API  │ │Event API │ │Relayer API  │
              │ /price     │ │ /events  │ │ /relay      │
              └─────┬──────┘ └───┬──────┘ └──────┬──────┘
                    │            │                │
         ┌──────────┼────────────┼────────────────┤
         ▼          ▼            ▼                ▼
   ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐
   │ OKX DEX │ │ Binance │ │Events DB │ │ RPC Pool     │
   │Tokens   │ │Futures  │ │(TSDB)    │ │ (7链×3RPC)   │
   └─────────┘ └─────────┘ └──────────┘ └──────────────┘
```

---

## 4. API 接口列表

### 公开 API (需要 X-API-Key)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v2/data/price` | 代币价格查询 |
| GET | `/api/v2/data/events` | 链上事件查询 |
| POST | `/api/v2/data/events/batch` | 批量地址查询 |
| GET | `/api/v2/data/market/tokens` | DEX Token 搜索 |
| GET | `/api/v2/data/market/token-history` | Token 历史价格 |
| GET | `/api/v2/data/stats` | 链级统计 |
| GET | `/api/v2/data/health` | 采集器健康 |
| GET | `/api/v2/data/checkpoints` | 采集进度 |
| WS | `/api/v2/data/ws` | 实时事件流 |
| POST | `/api/v1/relay` | 交易广播 |

### Admin API (cookie 认证)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v2/admin/login` | 管理员登录 |
| POST | `/api/v2/admin/logout` | 注销 |
| GET | `/api/v2/admin/dashboard` | Dashboard 数据 |
| GET/POST/PATCH/DELETE | `/api/v2/admin/api-keys` | API Key 管理 |
| GET/POST/PATCH/DELETE | `/api/v2/admin/okx-accounts` | OKX 账户管理 |
| GET/POST/PUT/DELETE | `/api/v2/admin/users` | 用户管理 |
| GET | `/api/v2/admin/audit` | 审计日志 |
| GET | `/api/v2/admin/system` | 系统状态 |
| GET | `/api/v2/admin/rpc-endpoints` | RPC 端点管理 |
| GET | `/api/v2/admin/rpc-health` | RPC 健康状态 |

---

## 5. 数据模型

### events (TimescaleDB hypertable)
- chain, block_number, tx_hash, event_type
- from_address, to_address, contract_address, token_address
- amount, amount_raw, collected_at (partition key)

### binance_futures_prices (TimescaleDB hypertable)
- symbol, bucket (partition key)
- open_price, high_price, low_price, close_price, mark_price
- funding_rate, next_funding_time, tick_count

### okx_token_snapshots
- chain, token_address, token_symbol, token_name
- price_usd, volume_24h, market_cap, liquidity_usd
- holder_count, price_change_24h, dex_name, collected_at

### api_keys
- label, api_key (pkx_xxx), rate_limit, enabled
- created_by, last_used_at, request_count

### admin_okx_accounts
- label, api_key, api_secret, api_passphrase
- enabled, is_default, status, last_used_at

---

## 6. 定价模型

| 层级 | 价格 | 说明 |
|------|------|------|
| Free Tier | $0 | 100 req/min，适合开发测试 |
| Standard | TBD | 1000 req/min + 优先支持 |
| Enterprise | TBD | 定制限流 + SLA |

---

## 7. 非功能需求

| 类别 | 需求 |
|------|------|
| 可用性 | 99.5% uptime，pm2 auto-restart |
| 延迟 | API 响应 < 500ms (缓存命中) |
| 安全 | API Key 鉴权 + HTTPS (生产) |
| 扩展性 | PostgreSQL connection pooling (max 20) |
| 成本 | 数据源全部免费，服务端 ~$15/月 |

---

## 附录

- **完整 API 文档**: docs/API.md
- **SDK**: sdk/pocketx-sdk.ts
- **部署**: DEPLOY_RECORDS.md
