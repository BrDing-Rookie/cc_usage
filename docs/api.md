# 接口与数据契约

## 契约来源

当前 schema 的事实来源是：

- [packages/shared/src/schema.ts](/Users/brding/projects/LLMProjects/cc_usage/packages/shared/src/schema.ts)
- [packages/shared/src/index.ts](/Users/brding/projects/LLMProjects/cc_usage/packages/shared/src/index.ts)

## Materialized State

项目会把 provider 的原始响应归一化为 renderer 可消费的 materialized state。

关键实体包括：

- `SourceSnapshot`
- `QuotaWindow`
- `MaterializedState`

当前高层字段覆盖：

- source identity
- vendor family
- source kind
- account and plan labels
- percent and absolute quota values when available
- reset information
- refresh health
- alert state

## 来源分类

项目当前使用 4 类来源：

- `official_api`
- `official_cli_or_local_state`
- `custom_endpoint`
- `browser_automation`

## 当前重点 provider 契约

### Claude Code Official

- 类别：`official_api`
- 主要展示契约：基于百分比的窗口信息

### OpenAI Codex

- 类别：`browser_automation`
- 主要展示契约：以百分比优先的用量状态

### mininglamp

- 类别：`custom_endpoint`
- 凭证：
  - `MININGLAMP_BASE_URL`
  - `MININGLAMP_API_KEY`
- 接口：
  - `/dashboard/billing/subscription`
  - `/dashboard/billing/usage`
- 映射：
  - `hard_limit_usd` -> total quota
  - `total_usage / 100` -> used USD

## CLI 与脚本入口

当前根目录可见脚本：

```bash
corepack pnpm test
corepack pnpm test:desktop
corepack pnpm test:daemon
corepack pnpm test:browser-worker
```

即使某个分支只包含部分实现，这些脚本也说明了预期的包边界。
