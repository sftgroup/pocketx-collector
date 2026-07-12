# PocketX 统一支付模块 PRD v1.0

> **模块名称**: B2B2C Unified Payment  
> **版本**: v1.0 | **日期**: 2026-07-03 | **状态**: MVP 已部署

---

> ⚠️ 本文档来自飞书，完整内容请访问: https://my.feishu.cn/docx/QMfjdArHNoQT0Lxg33achBDvnvc

## 目录
1. 概述 - B2B2C 统一支付, 4 种支付方式
2. 支付方式详解 - Stripe / 钱包转账 / QR / x402
3. 数据模型 - payment_orders 表
4. API 清单 - 公开接口 + 认证接口
5. 安全设计 - 防重复/防篡改/防重放
6. 后续迭代 - v1.1 / v1.2 / v2.0
7. **Event Collector** — RPC Pool + 全量区块数据 + 72h 保留
8. **Data Wholesale** — 数据批发商业模式 + 计费模型

## 核心架构
- Event Collector: Block Scanner + Chain Listener + Centralized Fetcher → Event Normalizer → Dispatcher → PostgreSQL / Redis Pub/Sub / Webhook
- 7 链: Sepolia → Ethereum → Polygon → Arbitrum → Optimism → BSC → Base
- 数据保留: events 72h | payment_events 永久 | checkpoints 永久
- RPC 成本: ~14 免费 Key × $0 = $0/月
- 计费: Starter $9 → Pro $49 → Enterprise $199/月

## Event Collector 数据流
```
RPC Pool (免费 Key × 14)
  │ 并行拉取全量区块 (epoch 分配)
  ▼
Block Scanner → 7 条链 × 全量交易 + 事件日志
  ▼
Event Normalizer → 地址checksum | wei→decimal | ISO 8601 | 去重
  ▼
PostgreSQL (events 表, 保留 72h)
  ├── Data Wholesale API (/api/v2/data/events)
  ├── Redis Pub/Sub (6 channels)
  └── Webhook 推送
```

## 索引策略
```sql
CREATE INDEX idx_events_chain_block ON events (chain, block_number DESC);
CREATE INDEX idx_events_to_address ON events (to_address);
CREATE INDEX idx_events_contract ON events (contract_address);
CREATE INDEX idx_events_type ON events (event_type);
CREATE INDEX idx_events_to_chain_block ON events (to_address, chain, block_number DESC);
CREATE INDEX idx_events_chain_type_block ON events (chain, event_type, block_number DESC);
CREATE UNIQUE INDEX idx_events_event_id ON events (event_id);
```

## 清理机制
```sql
-- 每 1h 执行
DELETE FROM events WHERE created_at < NOW() - INTERVAL '72 hours';
```
