# PocketX Collector — TODO List（对比 PRD v2.0）

> 更新时间: 2026-07-05 02:45  
> 上次 PRD 版本: v2.0 (2026-07-05)

---

## 📊 完成度总览

| 功能 ID | 功能 | 优先级 | 状态 | 完成度 | 备注 |
|---------|------|--------|------|--------|------|
| F-001 | 多链区块事件采集 (7链) | P0 | ✅ 完成 | 95% | 7/7 链运行中，部分链有 429 降级 |
| F-002 | RPC Pool 负载均衡 + 健康检查 | P0 | ✅ 完成 | 100% | 16 端点 round-robin，三态健康 |
| F-003 | 链上事件查询 API (游标分页) | P0 | ✅ 完成 | 95% | 正常，stats API COUNT(*) 慢需优化 |
| F-004 | 批量地址查询 API | P1 | ✅ 完成 | 100% | ≤20 地址 × ≤7 链 |
| F-005 | API Key 鉴权 + 管理员 CRUD | P0 | ✅ 完成 | 100% | 含重构加固 |
| F-006 | 交易广播 API (POST /relay) | P0 | ✅ 完成 | 100% | 7 链 × 3 RPC fallback |
| F-007 | 代币价格查询 API (OKX + Binance) | P1 | ✅ 完成 | 80% | 三源降级已实现，OKX 缺 API Key 导致 source=none |
| F-008 | OKX ChainOS DEX 代币数据采集 | P1 | ⚠️ 依赖 | 60% | 采集器代码完成，需 OKX API Key 激活 |
| F-009 | Binance 合约价格采集 (WebSocket) | P1 | ⚠️ 问题 | 50% | 采集器运行中，**表数据为空**需排查 |
| F-010 | WebSocket 事件实时推送 | P1 | ✅ 完成 | 100% | ws 正常，按链过滤 |
| F-011 | TypeScript SDK 封装 | P1 | ✅ 完成 | 100% | 零依赖单文件，px.price/events/relay/ws |
| F-012 | Admin Panel 管理面板 | P0 | ✅ 完成 | 100% | 10 个页面，暗色主题 SPA |
| F-013 | 数据清理 (72h TTL) | P0 | ✅ 完成 | 100% | 自动清理 |

---

## 📋 额外完成项（PRD 之外）

| 项目 | 状态 | 说明 |
|------|------|------|
| 代码审计重构 | ✅ | 2 轮 — 6 P0/P1 修复，代码库瘦身 -207 行 |
| 死码清理 | ✅ | config.ts/helpers.ts/errors.ts 精简 76% |
| 接入文档 (API.md) | ✅ | 11KB，10 接口 + curl + SDK 双示例 |
| README 完整重写 | ✅ | 6.7KB，功能矩阵 + 项目树 + 已知问题 |
| Memory 更新 | ✅ | memory/2026-07-05.md 3.2KB |
| 文档发布 | ✅ | 全部已推送 GitHub |

---

## ⚠️ 阻塞项（需 Steven 处理）

| ID | 阻塞项 | 影响功能 | 建议 |
|----|--------|---------|------|
| BL-001 | **OKX API Key 未配置** | F-007 (价格) F-008 (DEX 数据) | Admin Panel → OKX Accounts 添加 |
| BL-002 | **Binance futures_prices 表空** | F-007 (价格降级) F-009 (合约数据) | 登服务器看 WS 连接日志排查 |
| BL-003 | Infura 429 风暴 (3 链降级) | F-001 (Polygon/Arbitrum/Optimism) | 额外 Infura key 或换备选 RPC |
| BL-004 | events COUNT(*) 慢 | F-003 (stats API) | 加 pg_cron 汇总/定期清理 |

---

## 🎯 建议优先级

| 顺序 | 任务 | 预计耗时 | 影响 |
|------|------|---------|------|
| 1 | 添加 OKX API Key | 2 min | 解锁价格预言机 + DEX Token 数据 |
| 2 | 排查 Binance 表空 | 15 min | 恢复合约价格降级链路 |
| 3 | Infura 加 key | 10 min | 恢复 3 链全速扫描 |
| 4 | stats API 优化 | 30 min | 修复超时 |

---

## 总体完成度：**85%**
