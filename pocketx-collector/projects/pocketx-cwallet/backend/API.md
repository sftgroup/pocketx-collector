# PocketX v2.0 Backend — API 文档

> 版本：v2.0 | 最后更新：2026-06-29
> 基础路径：`/api/v2`
> 通用响应格式：`{ "code": 0, "message": "success", "data": {} }`

---

## 目录

1. [通用信息](#1-通用信息)
2. [认证 API](#2-认证-api-be-02)
3. [钱包 API](#3-钱包-api-be-03)
4. [交易 API](#4-交易-api-be-04)
5. [风控 API](#5-风控-api-be-05)
6. [事件 & Webhook API](#6-事件--webhook-api-be-08)
7. [Safe 多签 API](#7-safe-多签-api)
8. [错误码](#8-错误码)

---

## 1. 通用信息

### 1.1 基础路径

```
https://{host}/api/v2
```

### 1.2 认证方式

- **JWT Bearer Token**：大多数端点通过 `Authorization: Bearer <token>` 鉴权
- **API Key**：CWallet 内部回调使用 `X-API-Key` 头
- **SSE 流**：JWT 可通过查询参数 `?token=<jwt>` 传递（EventSource 限制）

### 1.3 通用响应格式

```json
// 成功
{ "code": 0, "message": "success", "data": { ... } }

// 错误
{ "code": 1001, "message": "Missing required field: phone", "data": null }
```

### 1.4 分页

列表接口统一分页：

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| page | int | 1 | 页码 |
| limit | int | 20 | 每页数量（最大 100） |

分页响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [...],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

---

## 2. 认证 API (BE-02)

### 2.1 发送验证码

```
POST /auth/send-code
Rate Limit: 1 req/60s per IP
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | 是 | 手机号，支持国际格式 (+86xxx) |

**响应 200：**

```json
{ "code": 0, "message": "Verification code sent", "data": null }
```

**错误：**
- 400 `1001` — 手机号格式错误
- 429 `1001` — 频率限制（60s 内只能发一次）

---

### 2.2 验证码登录

```
POST /auth/verify-code
Rate Limit: 5 req/60s per IP
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | 是 | 手机号 |
| code | string | 是 | 6 位验证码 |

**响应 200：**

```json
{
  "code": 0,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "userId": "uuid",
    "isNewUser": true
  }
}
```

**错误：**
- 400 `1001` — 验证码过期/错误
- 429 `1001` — 3 次错误后锁定 60s

---

### 2.3 设置支付密码

```
POST /auth/set-password
Auth: JWT required
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| password | string | 是 | 6 位数字支付密码 |

**响应 200：**

```json
{ "code": 0, "message": "Payment password set successfully", "data": null }
```

**错误：**
- 400 `1001` — 密码格式无效（非 6 位数字）

---

### 2.4 刷新 Token

```
POST /auth/refresh
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| refreshToken | string | 是 | Refresh JWT |

**响应 200：**

```json
{
  "code": 0,
  "message": "Token refreshed",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

---

## 3. 钱包 API (BE-03)

### 3.1 创建托管钱包

```
POST /wallet/create
Auth: JWT required
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chain | string | 是 | 链名称：eth/polygon/arbitrum/optimism/bsc/base |

**响应 200：**

```json
{
  "code": 0,
  "message": "Custodial wallet created",
  "data": {
    "id": "uuid",
    "address": "0x...",
    "chain": "polygon"
  }
}
```

**错误：**
- 400 `1001` — 不支持的链

---

### 3.2 导入托管钱包

```
POST /wallet/import
Auth: JWT required
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chain | string | 是 | 链名称 |
| hdPath | string | 是 | HD 钱包路径（m/44'/60'/0'/0/0） |

**响应 200：** 同上

---

### 3.3 查询余额

```
GET /wallet/balance?chain=eth
Auth: JWT required
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chain | string | 否 | 按链筛选 |

**响应 200：**

```json
{
  "code": 0,
  "message": "Success",
  "data": {
    "chainBalances": [
      {
        "chain": "polygon",
        "address": "0x...",
        "balances": [
          { "token": "MATIC", "token_address": "*", "balance": "100.5", "usd_value": "75.38" },
          { "token": "USDC", "token_address": "0x...", "balance": "5000", "usd_value": "5000.00" }
        ],
        "usdTotal": "5075.38"
      }
    ],
    "totalUsd": "5075.38"
  }
}
```

---

### 3.4 获取充值地址

```
GET /wallet/address?chain=polygon
Auth: JWT required
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chain | string | 是 | 链名称 |

**响应 200：**

```json
{
  "code": 0,
  "message": "Success",
  "data": {
    "address": "0x...",
    "chain": "polygon"
  }
}
```

---

### 3.5 交易历史

```
GET /wallet/transactions?page=1&limit=20
Auth: JWT required
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码，默认 1 |
| limit | int | 否 | 每页数量，默认 20 |

**响应 200：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "uuid",
        "wallet_id": "uuid",
        "from_address": "0x...",
        "to_address": "0x...",
        "amount": "100.000000000000000000",
        "token_address": "*",
        "gas_sponsored": true,
        "tx_hash": "0x...",
        "status": "confirmed",
        "risk_result": {},
        "signature_strategy": "auto",
        "chain": "polygon",
        "wallet_address": "0x...",
        "created_at": "2026-06-29T12:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

---

## 4. 交易 API (BE-04)

### 4.1 发送交易

```
POST /tx/send
Auth: JWT required
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| walletId | string | 是 | 钱包 ID |
| toAddress | string | 是 | 收款地址 (0x...) |
| amount | string | 是 | 金额（字符串，支持小数） |
| chain | string | 是 | 链名称 |
| paymentPassword | string | 是 | 支付密码（6 位数字） |
| tokenAddress | string | 否 | 代币合约地址，默认 `*`（原生币） |

**处理流程：**
1. ✅ 验证钱包所有权
2. ✅ 验证支付密码
3. ✅ 风控检查（单笔限额 → 日累计 → 新用户 → 黑名单）
4. ✅ 签名策略决策（自动签/确认/审批）
5. ✅ Gas 估算
6. ✅ [自动签] CWallet 签名广播
7. ✅ 记录交易

**响应 200：**

```json
{
  "code": 0,
  "message": "Transaction processed",
  "data": {
    "txId": "uuid",
    "txHash": "0x...",
    "status": "confirmed",
    "gasSponsored": true,
    "strategy": "auto"
  }
}
```

**错误：**
- 400 `2001` — 余额不足
- 403 `2002` — 风控拦截（含具体原因）
- 403 `1003` — 支付密码错误

---

### 4.2 Gas 估算

```
POST /tx/estimate-gas
Auth: JWT required
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| walletId | string | 是 | 钱包 ID |
| toAddress | string | 是 | 收款地址 |
| amount | string | 是 | 金额 |
| chain | string | 是 | 链名称 |
| tokenAddress | string | 否 | 代币地址 |

**响应 200：**

```json
{
  "code": 0,
  "message": "Gas estimated",
  "data": {
    "gas_limit": "21000",
    "gas_price": "50000000000",
    "estimated_cost": "0.00105"
  }
}
```

---

### 4.3 交易状态

```
GET /tx/status/0xabc...123
Auth: JWT required
```

**路径参数：**

| 参数 | 说明 |
|------|------|
| txHash | 交易哈希（66 字符） |

**响应 200：**

```json
{
  "code": 0,
  "message": "Success",
  "data": {
    "id": "uuid",
    "wallet_id": "uuid",
    "from_address": "0x...",
    "to_address": "0x...",
    "amount": "100.000000000000000000",
    "status": "confirmed",
    "tx_hash": "0x...",
    "chain": "polygon",
    ...
  }
}
```

---

### 4.4 批量转账

```
POST /tx/batch
Auth: JWT + Admin required
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| walletId | string | 是 | 钱包 ID |
| transfers | array | 是 | 转账列表（≤1000 笔） |
| paymentPassword | string | 是 | 支付密码 |

**transfers 元素：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| to | string | 是 | 收款地址 |
| amount | string | 是 | 金额 |

**响应 200：**

```json
{
  "code": 0,
  "message": "Batch transfer processed",
  "data": {
    "batchId": "uuid",
    "total": 50,
    "succeeded": 48,
    "failed": 2,
    "results": [
      { "index": 0, "to": "0x...", "amount": "10", "status": "success", "txHash": "0x..." },
      { "index": 1, "to": "0x...", "amount": "5", "status": "failed", "txHash": null, "error": "Insufficient balance" }
    ]
  }
}
```

---

## 5. 风控 API (BE-05)

### 5.1 查询用户限额

```
GET /risk/limits
Auth: JWT required
```

**响应 200：**

```json
{
  "code": 0,
  "message": "Success",
  "data": {
    "singleLimit": 10000,
    "dailyLimit": 50000,
    "dailyUsed": 1200.50,
    "isNewUser": false,
    "newUserLimit": 1000,
    "newUserRemaining": 1000
  }
}
```

---

### 5.2 管理黑名单

```
POST /risk/blacklist
Auth: JWT + Admin required
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| address | string | 是 | 以太坊地址（0x 开头，42 字符） |

**响应 200：**

```json
{ "code": 0, "message": "Address added to blacklist", "data": null }
```

---

## 6. 事件 & Webhook API (BE-08)

### 6.1 SSE 事件流

```
GET /events/stream
Auth: JWT (Bearer 头 或 ?token= 查询参数)
```

**说明：** 基于 Server-Sent Events 的实时推送。保持长连接。

**推送事件格式：**

```
event: deposit
data: {"type":"deposit","chain":"polygon","txHash":"0x...","from":"0x...","to":"0x...","amount":"50","token":"USDC"}
```

**事件类型：** `deposit` / `withdrawal` / `failed` / `blocked`

**保活：** 每 30s 发送 `:keepalive` 注释行

---

### 6.2 CWallet 回调

```
POST /webhooks/cwallet
Auth: X-API-Key header
```

**请求体：** CWallet 主动推送的事件负载

```json
{
  "event_type": "deposit",
  "user_id": "uuid",
  "wallet_id": "uuid",
  "chain": "polygon",
  "tx_hash": "0x...",
  "amount": "100",
  "token": "USDC"
}
```

**响应：**

```json
{ "code": 0, "message": "Webhook received", "data": null }
```

---

## 7. Safe 多签 API

### 7.1 创建 Safe

```
POST /safe/create
Auth: JWT required
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chain | string | 是 | 部署链 |
| owners | string[] | 是 | 所有者地址列表 |
| threshold | number | 是 | 阈值（1 ~ owners.length） |

**响应 200：**

```json
{
  "code": 0,
  "message": "Safe wallet created",
  "data": {
    "address": "0x...",
    "chain": "eth",
    "owners": ["0x..."],
    "threshold": 2,
    "createdBy": "user-uuid"
  }
}
```

---

### 7.2 发起多签提案

```
POST /safe/propose
Auth: JWT required
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| safeAddress | string | 是 | Safe 地址 |
| to | string | 是 | 目标地址 |
| value | string | 是 | 金额 |
| data | string | 否 | calldata |

---

### 7.3 签署/批准

```
POST /safe/approve
Auth: JWT required
```

**请求体：** `{ proposalId: string }`

---

### 7.4 执行交易

```
POST /safe/execute
Auth: JWT required
```

**请求体：** `{ proposalId: string }`

---

### 7.5 查询 Safe

```
GET /safe/0x123...abc
Auth: JWT required
```

---

## 8. 错误码

| code | HTTP | 含义 |
|------|------|------|
| 0 | 200 | 成功 |
| 1001 | 400 | 参数错误（具体信息在 message） |
| 1002 | 401 | 未登录 / Token 无效或过期 |
| 1003 | 403 | 支付密码错误 |
| 2001 | 400 | 余额不足 |
| 2002 | 403 | 风控拦截（具体原因在 message） |
| 2003 | 400 | Gas 不足 |
| 3001 | 403 | 多签未达阈值 |
| 5000 | 500 | 内部错误 |

---

## 9. 签名策略说明

| 金额范围 | 策略 | 流程 |
|----------|------|------|
| < 100 USD | auto | 自动签名广播，无需用户额外确认 |
| 100 - 10,000 USD | confirm | 用户需二次确认（前端弹出确认对话框） |
| > 10,000 USD | approval | 需管理员或多签审批通过后才广播 |
