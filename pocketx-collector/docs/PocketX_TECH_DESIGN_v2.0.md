# PocketX v2.0 技术方案 TECH_DESIGN

> **版本**: v2.0 | **日期**: 2026-07-04 | **编制**: Team6 架构师  
> **GitHub**: https://github.com/sftgroup/pocketX  
> **测试服**: http://101.33.109.117:6200

---

> ⚠️ 本文档来自飞书，完整内容请访问: https://my.feishu.cn/docx/ZZ5bdwgIroHpWexIxuvcxR2JnHc

## 目录
1. 系统架构 - C端/B端/服务层/基础设施
2. 模块拆解 - 前端10 + 后端13 + 合约1
3. API 设计 - C端认证/钱包/交易 + Safe多签 + SaaS WaaS
4. 数据模型 - 23 张 PostgreSQL 表
5. 接口协议 - 通用响应格式 + SaaS API 鉴权 + Webhook
6. 测试场景清单 - CT/AT/FT
7. 开发顺序 - 并行开发 + 集成审查
8. 部署配置 - 测试/生产
9. 新增模块实现要点
10. **RPC 集成服务 (Event Collector + Data Wholesale)** 🆕

## 第10章: RPC 集成服务

### 定位
PocketX RPC 集成服务是所有模块共享的独立基础设施层。从 RPC Pool 全量拉取链上区块数据 → 标准化入库 → 做好索引 → 下游（所有 DEX/DApp/钱包/交易所）按需查询。

### 核心理念
10 个项目各养一套 RPC 是浪费。PocketX 全量扫一次，数据卖给所有需要链上数据的项目。

### 数据全量存储策略
- **全量保存**: 整条链所有区块的全部交易和事件日志
- **保留时间**: 区块数据 72 小时
- **payment_events**: 永久
- **event_checkpoints**: 永久

### 清理机制
```sql
DELETE FROM events WHERE created_at < NOW() - INTERVAL '72 hours';
```
每 1h 执行一次。

### RPC Pool 覆盖
| 链 | 优先 RPC | 备用 | 免费 Key |
|---|---------|------|---------|
| Ethereum | Infura+Alchemy | Blast API+QuickNode | 3 |
| Polygon | Infura+Polygon RPC | Alchemy | 2 |
| Arbitrum | Infura+Arbitrum RPC | Alchemy | 2 |
| Base | Coinbase RPC+Infura | QuickNode | 2 |
| BSC | QuickNode+NodeReal | ANKR | 2 |
| Optimism | Infura+Alchemy | QuickNode | 2 |
| Sepolia | Infura+Alchemy | Public RPC | 1 |

**总计**: 7 条链 × ~14 RPC Token, $0/月

### Data Wholesale API
```
GET /api/v2/data/events
  ?chain=ethereum
  &address=0x...
  &contract=0x...
  &event_type=transfer
  &from_block=18000000
  &page_size=100
```

### 计费模型
| 套餐 | 月费 | 查询量 | 延迟 | Webhook |
|------|------|--------|------|---------|
| Starter | $9 | 10K | ~15s | ❌ |
| Pro | $49 | 100K | ~3s | ✅ |
| Enterprise | $199 | 1M | ~2s | ✅+定制 |

### 盈利模型
```
RPC 成本: 14 免费 Key = $0/月
服务器: 1 VPS = $50/月
盈亏平衡点: 2 Pro 客户
10 Pro 客户: $490 收入 - $50 成本 = $440 净利
```
