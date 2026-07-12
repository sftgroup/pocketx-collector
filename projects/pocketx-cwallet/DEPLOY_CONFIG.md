## Phase 2 Part 3: MPC清理 + 非托管展示层 (2026-06-30 06:08)

### 清理
- NonCustodialWallet.tsx → WalletPage.tsx（后端驱动,零硬编码）
- App.tsx: 移除 NonCustodial mock 连接逻辑

### 新增API
- GET /wallet/:chainId (HD wallet + tokens)

### 验证
- Wallet endpoint returns address ✅
- Tx history endpoint ✅
- Browser renders complete wallet page ✅
- No hardcoded data anywhere ✅

---

## Phase 2 Part 2: 机构多签 (2026-06-30 05:52)

### 部署内容
| 服务 | 测试服务器 | 状态 |
|------|-----------|------|
| Backend | 101.33.109.117:6100 | ✅ Running |
| Frontend | 101.33.109.117:6102 | ✅ Running |

### 新增文件
| 文件 | 说明 |
|------|------|
| `src/services/multiSigService.ts` | 完整多签生命周期: Safe CREATE2预测/交易提议/签名/执行/Owner管理 |

### 重写文件
| 文件 | 变更 |
|------|------|
| `src/routes/safeRoutes.ts` | 从mock升级→对接multiSigService 7个端点 |
| `models/database.ts` | safe_wallets/safe_transactions/safe_signatures 三表+索引 |

### API 端点
| 方法 | 端点 | 功能 |
|------|------|------|
| POST | /api/v2/safe/create | 创建Safe (F-027) |
| POST | /api/v2/safe/propose | 提议交易 (F-028) |
| POST | /api/v2/safe/confirm | 签名确认 (F-029) |
| POST | /api/v2/safe/execute | 执行交易 (F-030) |
| GET | /api/v2/safe/list | Safe列表 (F-031) |
| GET | /api/v2/safe/:addr | Safe详情+交易 (F-031) |
| PUT | /api/v2/safe/:addr/owners | Owner管理 (F-032) |

### 验证
- Safe创建: 2-of-3 CREATE2预测地址 ✅
- 交易提议: safeTxHash EIP-712计算 ✅
- 签名确认: sigCount/threshold追踪 ✅
- Safe列表: 3个 ✅
- 交易详情: status=pending ✅
- 编译: npx tsc --noEmit ✅
- Browser: Safe模式切换 ✅

---

## CWallet 源码对齐升级 (2026-06-30 05:39)

### 部署内容
| 服务 | 测试服务器 | 状态 |
|------|-----------|------|
| Backend | 101.33.109.117:6100 | ✅ Running |
| Frontend | 101.33.109.117:6102 | ✅ Running |

### 新增文件
| 文件 | 说明 |
|------|------|
| `src/services/hdWalletService.ts` | BIP44 HD钱包派生 (对标CWallet wallet.py) |
| `src/services/feeService.ts` | 费用引擎 (对标CWallet FeeConfig) |
| `src/services/encryptionService.ts` | AES-256-GCM私钥加密 (对标CWallet encryption.py) |

### 修改文件
| 文件 | 变更 |
|------|------|
| `config/index.ts` | HD_WALLET_SEED, WALLET_ENCRYPTION_KEY, MASTER_WALLET_ADDRESSES等 |
| `models/database.ts` | tokens/fee_configs/chains表+列迁移 |
| `services/saasService.ts` | BIP44派生+费用计算+CWallet对齐 |
| `services/walletService.ts` | BIP44派生+私钥加密存储 |

### 验证
- HD钱包真派生: `0x2369BA7289d6567ee435DDAB1C167a9Eb44DB900` ✅
- 确定性: 同用户同链=相同地址 ✅
- 多链支持: Sepolia + BSC ✅
- 费用引擎: fee_configs表+计算 ✅
- 私钥加密: AES-256-GCM ✅
- 编译: npx tsc --noEmit ✅
- 健康检查: /health OK ✅

---

## Phase 1 P0 修复部署 (2026-06-30 03:07)

| 项目 | 值 |
|------|-----|
| 阶段 | Phase 1 P0 修复 |
| P0-1 前端 Sepolia | ✅ env.ts 默认 SUPPORTED_CHAINS 加 sepolia，.env.production 创建 |
| P0-2 CWallet API | ✅ walletService 加 RPC fallback，config 加 rpcUrl |
| P0-3 send-code | ✅ nginx /api/ proxy 已配置，.env.production API_BASE_URL=/api/v2 |
| P0-4 对比度 1:1 | ✅ ModeSwitcher modeBgs 0.1→0.15，modeBorders 0.2→0.35 |
| P0-5 锚点链接 | ✅ 服务器上 section id 均已存在，无需修复 |
| 额外修复 | 删除 stale authService.ts，errors.ts 加 invalidInput，webhookService.ts 加 Errors import |
| 后端 PID | 重启后新进程 (端口 6100) |
| 反向 rsync | ✅ 2026-06-30 03:07 |

---

## Phase 1 延后问题修复部署 (2026-06-30 04:20)

| 项目 | 值 |
|------|-----|
| 阶段 | 延后的 High/Medium 问题修复 |
| 架构师 | team6 (自己写所有代码) |

### 修复清单

| # | 问题 | 严重度 | 修复 | 验证 |
|---|------|--------|------|:--:|
| 1 | 交易流程无 DB 事务 | High | txService sendTransaction 包装在 BEGIN/COMMIT/ROLLBACK 中，FOR UPDATE 防双花 | ✅ |
| 2 | JWT 无吊销机制 | Medium | 新增 token_blacklist 表 + SHA-256 hash 存储 + refresh 轮转撤销 + login 检查 + logout 端点 | ✅ 旧 token 二次使用返回 "Token has been revoked" |
| 3 | verificationCodes Map 内存泄漏 | Minor | 60s 定期清理过期 code + 已锁定入口 | ✅ |
| 4 | Internal API Key 静态 | Medium | 新增 api_keys DB 表支持多 key 轮转 + requireApiKey 查 DB 优先 + fallback config | ✅ |
| 5 | SSE JWT URL 泄漏 | Medium | 新增 /events/token 端点生成 5min 一次性 token + EventSource 用此 token + 用完即删 | ✅ SSE token API 正常 |

### 涉及文件

| 文件 | 变更类型 |
|------|----------|
| backend/src/services/txService.ts | 事务包装 + FOR UPDATE |
| backend/src/services/authService.ts | JWT 吊销 + 内存清理 + refresh 黑名单检查 |
| backend/src/middleware/auth.ts | authenticate 异步 + 黑名单检查 + requireApiKey DB 查询 |
| backend/src/routes/authRoutes.ts | 新增 POST /logout |
| backend/src/routes/eventRoutes.ts | SSE token 机制 (+POST /token, 修改 GET /stream) |
| backend/src/models/database.ts | token_blacklist + api_keys 表 |
| backend/src/utils/errors.ts | 新增 Errors.invalidInput |
| backend/src/services/webhookService.ts | 补充 Errors import |
| backend/src/index.ts | token_blacklist 定期清理 |
| frontend/src/env.ts | 新增 SSE_TOKEN_URL |
| frontend/src/services/sse.ts | SSE 改用一次性 token |
| frontend/src/services/api.ts | verifyCode 响应字段映射 + 语法修复 |

### 版本指纹 (本地 ⇄ 线上一致)
```
txService.ts:     dcd2e81b6649c760f2b634279cafff10 ✅
authService.ts:   6fcc7966003d08edb985ff7cfb368c26 ✅
auth.ts:          57d8a101568b4d95d14fa6da0547d9c4 ✅
webhookService.ts: e7ba0d6191f623d3f122be6397a9efb4 ✅
eventRoutes.ts:   9214f04657248aae98b68399a5a7b863 ✅
authRoutes.ts:    53eedb7c80d02b42014dfc5926a2d62b ✅
errors.ts:        b73c343ed374103b6b3ff0a6afeaa55a ✅
database.ts:      221bab0b6f7abd00fe408c0ceca0ba9e ✅
```

### 测试服务器状态
| 项 | 值 |
|----|-----|
| 前端入口 | http://101.33.109.117:6102/ (200 OK) |
| 后端 API | http://101.33.109.117:6100/ (health OK) |
| 后端 PID | 1653908 (ts-node, fresh) |
| 反向 rsync | ✅ 2026-06-30 04:20 |

### API 端到端验证
- send-code → ✅ `{"code":0}`
- verify-code → ✅ accessToken + refreshToken
- SSE token (new) → ✅ 5min one-time token
- refresh → ✅ 旧 token 吊销
- logout → ✅ `{"code":0,"message":"Logged out successfully"}`
- Browser E2E → ✅ 登录→仪表盘→Logout→返回登录页 全流程正常
