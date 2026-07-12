# PocketX Collector — 数据接入文档

> 版本：v1.0 | 最后更新：2026-07-05
> 服务地址：http://43.156.78.59:3000

## 1. 概览

PocketX Collector 是多链区块数据采集服务，实时采集 EVM（Ethereum/Sepolia/BSC/Base）和 Solana 的链上 transfer 事件，提供 REST API + WebSocket 双通道数据输出，同时支持交易广播和实时价格查询。

### 产品特性

- **5 链实时采集**：每链 ~10s 出块周期，Solana ~400ms slot
- **REST + WebSocket 双通道**：查历史走 REST，实时推送走 WS
- **交易广播**：EVM + Solana 原生交易发送
- **实时价格**：OKX DEX → Binance Futures 三级 fallback
- **统一数据格式**：NormalizedEvent 跨链一致 schema

## 2. 鉴权

所有 `/api/v2/data/*` 和 `/api/v1/*` 接口需要 API Key。

在请求头中携带：
```
x-api-key: pkx_YOUR_API_KEY
```

联系管理员获取 API Key。当前测试 Key：`pkx_6f535dfb3318150f38911708fa5bef1abe50774e6d49d2b6`

## 3. 数据接口 — 事件查询

### 基础 schema — NormalizedEvent

```typescript
interface NormalizedEvent {
  event_id:       string;   // 唯一 ID（txHash_token_address）
  event_type:     string;   // "transfer"
  chain:          string;   // ethereum | bsc | base | sepolia | solana
  block_number:   number;   // 区块号
  tx_hash:        string;   // 交易哈希
  from_address:   string;   // 发起方地址
  to_address:     string;   // 接收方地址
  contract_address: string; // 合约/程序地址（无时为空）
  token_address:   string;  // Token 合约地址（Solana 为 SPL mint）
  token_symbol:    string;  // 代币符号（SOL, USDC, WETH...）
  amount:          string;  // decimal 字符串
  collected_at:    string;  // 采集时间（ISO 8601）
}
```

### 3.1 查询事件

```
GET /api/v2/data/events
```

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `chain` | string | 否 | 链名：ethereum, bsc, base, sepolia, solana |
| `address` | string | 否 | 过滤 from_address 或 to_address |
| `contract` | string | 否 | 过滤合约地址 |
| `event_type` | string | 否 | 事件类型，默认 transfer |
| `from_block` | number | 否 | 区块号起始 |
| `to_block` | number | 否 | 区块号结束 |
| `page_size` | number | 否 | 每页条数（默认 100，最大 500）|
| `page_token` | string | 否 | 翻页游标 |

**示例：**

```bash
# 查询某地址在 Ethereum 最近 100 条 transfer
curl -s "http://43.156.78.59:3000/api/v2/data/events?chain=ethereum&address=0xdAC17F958D2ee523a2206206994597C13D831ec7&page_size=20" \
  -H "x-api-key: pkx_6f535dfb3318150f38911708fa5bef1abe50774e6d49d2b6"
```

**响应：**
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "events": [
      {
        "event_id": "0x7a3f..._0xdAC17F...",
        "event_type": "transfer",
        "chain": "ethereum",
        "block_number": 25465088,
        "tx_hash": "0x7a3f...",
        "from_address": "0x...",
        "to_address": "0x...",
        "contract_address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "token_address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "token_symbol": "USDT",
        "amount": "3482000000",
        "collected_at": "2026-07-05T08:19:46.000Z"
      }
    ],
    "next_page_token": "eyJsYXN0..."
  }
}
```

### 3.2 批量查询

```
POST /api/v2/data/events/batch
```

**Body（格式 1 — 多地址各自指定链）：**

```json
{
  "addresses": [
    {"address": "0xdAC17F...", "chain": "ethereum"},
    {"address": "EPjFWdd5...",  "chain": "solana"}
  ],
  "event_type": "transfer",
  "per_address": 20
}
```

**Body（格式 2 — 相同链多地址）：**

```json
{
  "addresses": ["0xAddr1", "0xAddr2"],
  "chains": ["ethereum", "bsc"],
  "per_address": 50
}
```

> 限制：最多 20 个地址，每种格式 7 条链

**示例：**
```bash
curl -s -X POST "http://43.156.78.59:3000/api/v2/data/events/batch" \
  -H "Content-Type: application/json" \
  -H "x-api-key: pkx_6f535dfb3318150f38911708fa5bef1abe50774e6d49d2b6" \
  -d '{
    "addresses": [
      {"address": "0xdAC17F958D2ee523a2206206994597C13D831ec7", "chain": "ethereum"},
      {"address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "chain": "solana"}
    ],
    "per_address": 10
  }'
```

### 3.3 事件统计

```
GET /api/v2/data/stats
```

返回各链事件总数 + 存储统计。

### 3.4 健康检查

```
GET /api/v2/data/health
```

返回采集器状态、端点数量、存储大小、各链 checkpoint。

### 3.5 采集器状态

```
GET /api/v2/data/checkpoints
```

返回各链当前采集区块号、运行状态、最近采集时间。

## 4. 实时推送 — WebSocket

```
ws://43.156.78.59:3000/api/v2/data/ws?chains=ethereum,bsc,base,sepolia,solana
```

`chains` 参数指定要订阅的链（逗号分隔），留空订阅全部。

**连接后接收消息格式：**

```json
// 连接确认
{"type":"connected","message":"Subscribed to event stream","chains":["ethereum","solana"]}

// 事件推送
{"type":"event","data": {
  "event_id": "5p4N6...",
  "event_type": "transfer",
  "chain": "solana",
  "block_number": 430909600,
  "tx_hash": "5p4N6Kh...",
  "from_address": "94muBNsF...",
  "to_address": "5Z7b...",
  "token_address": "EPjFWdd5...",
  "token_symbol": "USDC",
  "amount": "150000000",
  "collected_at": "2026-07-05T08:19:50.000Z"
}}
```

**运行频率：**

| 链 | 出块间隔 | 每批次 events |
|----|---------|-------------|
| Solana | ~400ms（批 6 slots） | ~3,500 |
| Ethereum | ~12s | ~900 |
| BSC | ~3s | ~1,000/6 块 |
| Base | ~2s | ~900/6 块 |
| Sepolia | ~12s | ~500 |

## 5. 交易广播

```
POST /api/v1/relay
```

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `chain` | string | 链名 |
| `tx` | string | 已签名交易 |

**EVM 链（ETH/SEP/BSC/Base）：**
- `tx` 格式：0x 前缀的 hex 字符串（RLP 编码的签名交易）
- 返回：`tx_hash`（0x...）

**Solana：**
- `tx` 格式：base58 或 base64 编码的签名交易（自动识别编码，无需 0x 前缀）
- 返回：`signature`（base58）

**示例：**

```bash
# EVM
curl -s -X POST "http://43.156.78.59:3000/api/v1/relay" \
  -H "Content-Type: application/json" \
  -H "x-api-key: pkx_6f535dfb3318150f38911708fa5bef1abe50774e6d49d2b6" \
  -d '{"chain":"sepolia","tx":"0x02f86f83aa36a7..."}'

# Solana
curl -s -X POST "http://43.156.78.59:3000/api/v1/relay" \
  -H "Content-Type: application/json" \
  -H "x-api-key: pkx_6f535dfb3318150f38911708fa5bef1abe50774e6d49d2b6" \
  -d '{"chain":"solana","tx":"4U3VrdN5s..."}'

# 成功返回
{"code":0,"message":"ok","data":{"tx_hash":"0x..."}}
```

> 每条链 3+ 个 RPC 端点自动 failover

## 6. 实时价格

```
GET /api/v2/data/price?chain={chain}&token={token}
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `chain` | string | 链名 |
| `token` | string | 代币符号（USDC, WETH）或合约地址（0x...） |

三级 fallback：OKX DEX 快照 → Binance Futures → OKX 实时查询

**示例：**
```bash
curl -s "http://43.156.78.59:3000/api/v2/data/price?chain=ethereum&token=USDC" \
  -H "x-api-key: pkx_6f535dfb3318150f38911708fa5bef1abe50774e6d49d2b6"
```

更多市场接口：`/api/v2/data/market/tokens` 搜索 token，`/api/v2/data/market/token-history` 历史价格。

## 7. 性能与限制

| 指标 | 值 |
|------|-----|
| 查询延迟 | <100ms（事件查询，有索引） |
| 批量查询 | 最多 20 地址 × 每地址 100 条 |
| 每日数据量 | ~120 万条事件 |
| 数据保留 | 72 小时 |
| WebSocket | 每连接订阅链级过滤 |
| 鉴权 | x-api-key header |
| 跨域 | CORS 开放 |

## 8. Admin Dashboard

浏览器访问 `http://43.156.78.59:3000/admin`，登录后可：
- 查看各链实时采集状态
- 管理 RPC 端点（添加/删除/启停）
- 监控存储使用量
- 导出事件 CSV
- 管理 API Key

## 9. 链标识

请求和返回中使用的链名：

| chain | 网络 | 类型 |
|-------|------|------|
| `ethereum` | Ethereum Mainnet | EVM |
| `bsc` | BNB Smart Chain | EVM |
| `base` | Base Mainnet | EVM |
| `sepolia` | Sepolia Testnet | EVM |
| `solana` | Solana Mainnet | Solana |

## 10. Solana 注意事项

1. **地址格式**：base58（非 0x hex），地址 32-44 字符
2. **区块号**：Solana 用 slot 号（非 EVM block number），目前 ~4.3 亿
3. **Token 格式**：SPL token mint 地址（如 USDC 是 `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`）
4. **交易广播**：发 base58 或 base64 签名交易，自动识别格式
5. **事件频率**：每 400ms 一个 slot，每批采集 6 个 slot，约 3,500 events/批

## 11. 常见问题

**Q: 为什么查不到某些事件？**
数据保留 72 小时，超过自动清理。

**Q: 支持其他链吗？**
当前仅 5 链。需要新链联系管理员扩展。

**Q: 如何获取更大页数？**
单页最大 500 条。使用 `page_token` 翻页，或走 WebSocket 实时推送。

**Q: Solana 地址为什么和 EVM 不一样？**
Solana 用 base58（如 `94muBNsF...`），EVM 用 hex（如 `0xdAC17F...`）。地址长度和字段尺寸都已适配。

**Q: 费率限制？**
API 无硬限制，但建议批量查询 <10 req/s。WebSocket 无限制。

---

**技术支持**：联系管理员 / 查看 Admin Dashboard
