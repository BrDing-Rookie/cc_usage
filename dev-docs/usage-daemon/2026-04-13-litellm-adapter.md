# LiteLLM 网关适配器

**日期**: 2026-04-13
**模块**: usage-daemon, shared, desktop
**状态**: 已完成

## 目标

为 LiteLLM 网关添加用量采集支持，使系统可以监控 `vibe.deepminer.ai` 等 LiteLLM 实例的 API Key 花费与额度。

## 背景

LiteLLM 是一个代理多种 LLM 提供商的网关，提供 OpenAI 兼容 API。其 `/key/info` 端点返回 key 级别的花费和预算信息：

- `info.spend` — 已花费金额（USD）
- `info.max_budget` — 额度上限（USD）
- `info.key_alias` — key 的别名（可用于 accountLabel）
- `info.budget_reset_at` — 额度重置时间（可能为 null）

实测 API 响应（`GET /key/info` with `Authorization: Bearer <key>`）：

```json
{
  "info": {
    "spend": 368.18,
    "max_budget": 500.0,
    "key_alias": "panfeng1@mininglamp.com",
    "budget_reset_at": null,
    "budget_duration": null
  }
}
```

## 涉及文件

### 新增
- `apps/usage-daemon/src/adapters/litellm.ts` — LiteLLM 适配器
- `apps/usage-daemon/tests/litellm.test.ts` — 适配器单元测试

### 修改
- `packages/shared/src/schema.ts` — appConfigSchema 增加 litellm 配置
- `apps/usage-daemon/src/defaultAdapters.ts` — 注册 litellm 适配器
- `apps/desktop/src/components/SettingsWindow.tsx` — 设置界面增加 litellm 配置项

## 方案

### 1. Schema 扩展

在 `appConfigSchema` 中增加 `litellm` 可选配置段：

```typescript
litellm: z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
}).optional(),
```

### 2. Adapter 实现

参照 `mininglamp.ts` 的模式，创建 `litellm.ts`：

- 调用 `GET {baseUrl}/key/info`，header 携带 `Authorization: Bearer {apiKey}`
- 从响应中提取 `info.spend`、`info.max_budget`、`info.key_alias`、`info.budget_reset_at`
- 归一化为 SourceSnapshot，sourceId = 'litellm'，sourceKind = 'custom_endpoint'
- 当 `max_budget` 为 null 时，不报告绝对数值（只有 spend 无法算百分比）
- HTTP 401 映射到 `auth_invalid`，其他错误映射到 `source_broken`

### 3. 注册

在 `buildDefaultAdapters` 中检查 `config.litellm?.baseUrl && config.litellm?.apiKey`，有配置则注册。

### 4. Settings UI

将当前的单 source 表单改为多 source 表单（或 tab），增加 litellm 的 baseUrl + apiKey 输入。保存时将两个 source 的配置一起写入。验证逻辑需覆盖所有已配置 source。

## 验收标准

1. `pnpm test` 全部通过
2. litellm adapter 单元测试覆盖：正常路径、401 错误、网络超时、max_budget 为 null
3. Settings UI 可以配置 litellm 的 baseUrl 和 apiKey
4. daemon 可定时刷新 litellm 用量并输出到 materialized state
