# PocketX Collector — API 接入文档

> **服务地址**: `http://43.156.78.59:3000`  
> **版本**: v2  
> **更新时间**: 2026-07-05  
> **管理员**: Steven Wang

---

## 快速开始（30 秒接入）

### 第 1 步：获取 API Key

联系管理员获取，或在 Admin Panel 自助生成：
`http://43.156.78.59:3000/admin/api-keys`

API Key 格式：`pkx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 第 2 步：请求时携带 API Key

所有数据 API 需要在 HTTP Header 中传入：

```http
X-API-Key: pkx_xxxxxxxxxxxx
```

### 第 3 步：调用 API

```bash
# 查代币价格
curl -H "X-API-Key: pkx_xxx" \
  "http://43.156.78.59:3000/api/v2/data/price?chain=ethereum&token=0xdac17f958d2ee523a2206206994597c13d831ec7"

# 查链上事件
curl -H "X-API-Key: pkx_xxx" \
  "http://43.156.78.59:3000/api/v2/data/events?chain=ethereum&page_size=50"
```

**更推荐使用 TypeScript SDK**（零依赖，复制即用）：

```ts
import { PocketX } from './pocketx-sdk';
const px = new PocketX('http://43.156.78.59:3000', 'pkx_xxx');

const price = await px.price('ethereum', '0xdac17f958d2ee523a2206206994597c13d831ec7');
const events = await px.events.query({ chain: 'ethereum', page_size: 50 });
const { tx_hash } = await px.relay('ethereum', '0x02f8...');
```

---

## 认证

| 方式 | 适用接口 | 说明 |
|------|---------|------|
| `X-API-Key` header | `/api/v2/data/*` `/api/v1/*` | 所有数据 API，在 Admin Panel 管理 |
| Cookie session | `/api/v2/admin/*` | Admin Panel 登录，不对外公开 |

---

## API 总览

| 分类 | 方法 | 路径 | 说明 |
|------|------|------|------|
| **价格** | GET | `/api/v2/data/price` | 代币价格查询（符号/地址） |
| **事件** | GET | `/api/v2/data/events` | 链上事件查询（游标分页） |
|  | POST | `/api/v2/data/events/batch` | 批量地址查询 |
| **广播** | POST | `/api/v1/relay` | 交易广播（7链） |
| **市场** | GET | `/api/v2/data/market/tokens` | DEX Token 搜索 |
|  | GET | `/api/v2/data/market/token-history` | Token 历史价格 |
| **统计** | GET | `/api/v2/data/stats` | 链级统计 |
|  | GET | `/api/v2/data/health` | 采集器健康状态 |
|  | GET | `/api/v2/data/checkpoints` | 采集进度 |
| **实时** | WS | `/api/v2/data/ws` | WebSocket 事件流 |

---

## 响应格式

所有接口返回统一 JSON 结构：

```json
{
  "code": 0,
  "message": "ok",
  "data": { ... }
}
```

| code | 含义 |
|------|------|
| 0 | 成功 |
| -1 | 失败（检查 `message` 字段） |

---

## 1. 代币价格查询 （预言机）

```http
GET /api/v2/data/price
```

查询任意代币的实时价格。支持按**代币符号**或**合约地址**查询。

**查询链路（自动降级）**：
1. 本地 DB 缓存（OKX DEX 定时采集 + 按需查询缓存）
2. Binance 合约价格（20 个主流 USDT 交易对）
3. OKX DEX API 实时查询（仅限合约地址查询，首次查询自动缓存）

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `chain` | string | **是** | 链名 或 `futures`（查 Binance 合约价） |
| `token` | string | **是** | 代币符号（如 `USDT`）或合约地址（0x 开头） |

**响应**：

```json
{
  "code": 0,
  "data": {
    "chain": "ethereum",
    "token": "USDT",
    "address": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "token_name": "Tether USD",
    "price_usd": 1.0002,
    "volume_24h": 18500000000,
    "market_cap": 143000000000,
    "liquidity_usd": 520000000,
    "holder_count": 6540000,
    "price_change_24h": 0.01,
    "dex_name": "Uniswap V3",
    "updated_at": "2026-07-05T01:30:00.000Z",
    "source": "okx_dex"
  }
}
```

**source 字段说明**：

| source | 含义 |
|--------|------|
| `okx_dex` | 来自 OKX DEX 定期采集的缓存数据 |
| `okx_on_demand` | 实时查询 OKX DEX API（首次查该地址） |
| `binance_futures` | 来自 Binance 永续合约实时价格 |
| `none` | 暂无该代币数据 |

**请求示例**：

```bash
# 用符号查（主流币走 Binance）
curl -H "X-API-Key: pkx_xxx" \
  "http://43.156.78.59:3000/api/v2/data/price?chain=futures&token=***

# 用地址查（自动走 OKX DEX）
curl -H "X-API-Key: pkx_xxx" \
  "http://43.156.78.59:3000/api/v2/data/price?chain=ethereum&token=***

# 用符号查 DEX 数据
curl -H "X-API-Key: pkx_xxx" \
  "http://43.156.78.59:3000/api/v2/data/price?chain=ethereum&token=***
```

**SDK 方式**：

```ts
// 用地址查任意代币
const usdt = await px.price('ethereum', '0xdac17f958d2ee523a2206206994597c13d831ec7');
// 用符号查
const eth = await px.price('futures', 'ETH');
// 判断数据来源
if (usdt.source === 'okx_on_demand') {
  console.log('实时查询成功，数据已缓存');
}
```

---

## 2. 交易广播

```http
POST /api/v1/relay
```

将已签名的原始交易广播到目标链。支持 7 条 EVM 链，每条链有 3 个 RPC 节点自动容错。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `chain` | string | **是** | ethereum, bsc, polygon, arbitrum, optimism, base, sepolia |
| `tx` | string | **是** | 0x 前缀的已签名原始交易（RLP 编码） |

**响应**：

```json
{
  "code": 0,
  "data": {
    "tx_hash": "0x9fc76417374aa880d4449a1f7f31ec597f00b1f6f3dd2d66f4c4589a8278b7f0"
  }
}
```

**支持的链与 RPC 节点**：

| 链 | RPC 节点 |
|----|---------|
| ethereum | LlamaRPC → Ankr → PublicNode |
| bsc | LlamaRPC → Ankr → PublicNode |
| polygon | LlamaRPC → Ankr → PublicNode |
| arbitrum | 官方 RPC → Ankr → PublicNode |
| optimism | 官方 RPC → Ankr → PublicNode |
| base | 官方 RPC → LlamaRPC → PublicNode |
| sepolia | PublicNode → sepolia.org → Tenderly |

**请求示例**：

```bash
curl -X POST -H "X-API-Key: pkx_xxx" -H "Content-Type: application/json" \
  -d '{"chain":"ethereum","tx":"0x02f8..."}' \
  "http://43.156.78.59:3000/api/v1/relay"
```

**SDK 方式**：

```ts
// 广播交易（传入已签名的 raw tx）
const { tx_hash } = await px.relay('ethereum', signedTxHex);
console.log('Broadcast:', tx_hash);
```

---

## 3. 链上事件查询

```http
GET /api/v2/data/events
```

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `chain` | string | 否 | 链名称 |
| `address` | string | 否 | 地址过滤（匹配 from 或 to） |
| `contract` | string | 否 | 合约地址过滤 |
| `event_type` | string | 否 | 事件类型：`transfer` `approval` |
| `from_block` | number | 否 | 起始区块号 |
| `to_block` | number | 否 | 截止区块号 |
| `page_size` | number | 否 | 每页条数（默认 100，最大 500） |
| `page_token` | string | 否 | 分页游标（取下一页用） |

**响应**：

```json
{
  "code": 0,
  "data": {
    "data": [
      {
        "event_id": "0xabc...",
        "event_type": "transfer",
        "chain": "ethereum",
        "block_number": 21500000,
        "tx_hash": "0xdef...",
        "from_address": "0x...",
        "to_address": "0x...",
        "contract_address": "0x...",
        "token_address": "0xdac17f958d2ee523a2206206994597c13d831ec7",
        "token_symbol": "USDT",
        "amount": "1000.50",
        "amount_raw": "1000500000",
        "confirmations": 12345,
        "collected_at": "2026-07-05T00:00:00.000Z"
      }
    ],
    "next_page_token": "eyJibG9ja19udW1iZXIiOjIxNTAwMDAwfQ=="
  }
}
```

**分页说明**：
- 使用**游标分页**，适合大数据量遍历
- `next_page_token` 不为 null 则表示有下一页
- 将 `next_page_token` 作为 `page_token` 请求下一页

```ts
// 自动遍历所有分页
const allEvents = await px.events.fetchAll({ chain: 'ethereum', address: '0x...' });
```

**请求示例**：

```bash
# 查以太坊最近转账
curl -H "X-API-Key: pkx_xxx" \
  "http://43.156.78.59:3000/api/v2/data/events?chain=ethereum&event_type=transfer&page_size=50"

# 查某地址相关事件
curl -H "X-API-Key: pkx_xxx" \
  "http://43.156.78.59:3000/api/v2/data/events?address=0xdac17f958d2ee523a2206206994597c13d831ec7&page_size=20"
```

---

## 4. 批量地址查询

```http
POST /api/v2/data/events/batch
```

一次请求查询多个地址在多条链上的事件。

**请求体**：

```json
{
  "chains": ["ethereum", "bsc"],
  "addresses": ["0x1111...", "0x2222..."],
  "event_type": "transfer",
  "per_address": 50
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `chains` | string[] | 链名列表（最大 7） |
| `addresses` | string[] | 地址列表（最大 20） |
| `event_type` | string | 可选事件类型过滤 |
| `per_address` | number | 每地址最大返回数（默认 50，最大 100） |

**响应**：

```json
{
  "code": 0,
  "data": {
    "total": 156,
    "results": {
      "ethereum:0x1111...": [...events],
      "bsc:0x1111...": [...events]
    },
    "address_summary": {
      "ethereum:0x1111...": {
        "chain": "ethereum",
        "address": "0x1111...",
        "count": 87,
        "latest_block": 21500000,
        "latest_tx_time": "2026-07-05T01:30:00.000Z"
      }
    }
  }
}
```

**SDK 方式**：

```ts
const batch = await px.events.batch({
  chains: ['ethereum', 'bsc'],
  addresses: ['0x1111...', '0x2222...'],
});
// batch.results["ethereum:0x1111..."] → 该地址在以太坊上的事件
// batch.address_summary → 每个地址的统计数据
```

---

## 5. WebSocket 实时事件流

```
ws://43.156.78.59:3000/api/v2/data/ws
```

连接到实时事件流，新区块解析出的事件自动推送到客户端。

**参数**（URL 查询参数，可选）：

| 参数 | 说明 |
|------|------|
| `chains` | 过滤链，逗号分隔，如 `?chains=ethereum,bsc` |

**消息格式**：

```json
// 连接成功
{"type":"connected","message":"Subscribed to event stream","chains":["ethereum"]}

// 新事件推送
{"type":"event","data":{...EventData...}}
```

**SDK 方式**：

```ts
const ws = px.ws(['ethereum', 'bsc'], (event) => {
  console.log('New event:', event.event_type, event.chain);
});
// 断开: ws.close()
```

---

## 6. 市场数据（OKX DEX Token）

```http
GET /api/v2/data/market/tokens
GET /api/v2/data/market/token-history
```

OKX ChainOS 采集的跨链 DEX Token 快照数据。

**Token 搜索**：

```bash
curl -H "X-API-Key: pkx_xxx" \
  "http://43.156.78.59:3000/api/v2/data/market/tokens?chain=ethereum&symbol=***

curl -H "X-API-Key: pkx_xxx" \
  "http://43.156.78.59:3000/api/v2/data/market/tokens?address=0xdac17f958d2ee523a2206206994597c13d831ec7"
```

**Token 历史**：

```bash
curl -H "X-API-Key: pkx_xxx" \
  "http://43.156.78.59:3000/api/v2/data/market/token-history?chain=ethereum&address=0xdac1...&hours=6&limit=50"
```

---

## 7. 统计与监控

```bash
# 链级统计
curl -H "X-API-Key: pkx_xxx" "http://43.156.78.59:3000/api/v2/data/stats"

# 采集器健康
curl -H "X-API-Key: pkx_xxx" "http://43.156.78.59:3000/api/v2/data/health"

# 采集进度
curl -H "X-API-Key: pkx_xxx" "http://43.156.78.59:3000/api/v2/data/checkpoints"
```

---

## 支持的多链

| 链 ID | 名称 | 事件查询 | 交易广播 | OKX DEX | Binance |
|-------|------|---------|---------|---------|---------|
| `ethereum` | Ethereum | 🟢 | 🟢 | 🟢 | 🟢 |
| `bsc` | BNB Chain | 🟢 | 🟢 | 🟢 | 🟢 |
| `polygon` | Polygon | 🟢 | 🟢 | 🟢 | — |
| `arbitrum` | Arbitrum | 🟢 | 🟢 | 🟢 | — |
| `optimism` | Optimism | 🟢 | 🟢 | 🟢 | — |
| `base` | Base | 🟢 | 🟢 | 🟢 | — |
| `sepolia` | Sepolia | 🟢 | 🟢 | — | — |
| `futures` | Binance 合约 | — | — | — | 🟢 |

---

## 错误处理

| HTTP Status | 含义 | 处理建议 |
|-------------|------|---------|
| 200 | 正常 | 检查 `code` 字段 |
| 400 | 参数错误 | 检查必填参数 |
| 401 | 未认证 | 检查 `X-API-Key` header |
| 403 | API Key 已禁用 | 联系管理员 |
| 502 | 上游错误 | 重试，或检查 `message` |
| 500 | 服务端错误 | 联系管理员 |

---

## TypeScript SDK

见 [sdk/pocketx-sdk.ts](sdk/pocketx-sdk.ts)，零依赖单文件，复制即用。

### 完整示例

```ts
import { PocketX } from './pocketx-sdk';

const px = new PocketX('http://43.156.78.59:3000', 'pkx_xxx');

// 1. 查代币价格
const price = await px.price('ethereum', '0xdac17f958d2ee523a2206206994597c13d831ec7');
console.log(`${price.token}: $${price.price_usd} (${price.source})`);

// 2. 查链上事件
const res = await px.events.query({ chain: 'ethereum', event_type: 'transfer', page_size: 10 });
for (const e of res.data) {
  console.log(`${e.block_number}: ${e.from_address} → ${e.to_address} ${e.amount} ${e.token_symbol}`);
}

// 3. 批量查多地址
const batch = await px.events.batch({ chains: ['ethereum'], addresses: ['0x1111...', '0x2222...'] });
for (const [key, summary] of Object.entries(batch.address_summary)) {
  console.log(`${key}: ${summary.count} events, latest block ${summary.latest_block}`);
}

// 4. 广播交易
const { tx_hash } = await px.relay('sepolia', '0x02f8...');
console.log('TX:', tx_hash);

// 5. 实时事件流
const ws = px.ws(['ethereum'], (event) => {
  console.log('🔔', event.event_type, event.chain, event.block_number);
});
```

---

## 速率限制

| 层级 | 限制 | 说明 |
|------|------|------|
| 默认 | 100 req/min | 通过 Admin Panel 调整 |

---

## 联系方式

- **管理员**：Steven Wang
- **Admin Panel**：`http://43.156.78.59:3000/admin`
- **SDK 源码**：`sdk/pocketx-sdk.ts`
- **完整 API**：`docs/API.md`
