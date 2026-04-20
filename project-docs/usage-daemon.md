# Usage Daemon

## 功能概述

usage daemon 是本地协调进程，负责刷新 account 级用量、归一化原始响应、保留 last-good 状态，并输出 `gateways + accounts` materialized state 供 desktop 消费。

## 核心能力

- **刷新调度**：每 5 分钟执行一轮采集
- **按 account 刷新**：每个启用 account 独立采集与保留 last-good 状态
- **按 gateway 汇总**：从 account snapshots 生成固定双 gateway 概览
- **配置文件**：从 `{runtimeDir}/config.json` 读取 `statusBar + gateways[].accounts[]` 配置
- **物化输出**：写出固定双 gateway 的 materialized state，供 desktop renderer 直接消费

## 使用方式

daemon 是以下内容的事实来源：

- current account snapshots
- gateway summaries
- refresh health

当前已支持来源：

- `llm-gateway` (custom endpoint, USD quota/usage)
- `vibe` (custom endpoint, USD spend/budget via `/key/info` API)

来源凭证通过 Settings UI 配置，存储在 `config.json`：

```json
{
  "statusBar": {
    "pinnedAccountId": "vibe:main"
  },
  "gateways": [
    {
      "gatewayId": "llm-gateway",
      "accounts": [
        {
          "accountId": "prod",
          "label": "Prod",
          "apiKey": "sk-xxxxx",
          "enabled": true
        }
      ]
    },
    {
      "gatewayId": "vibe",
      "accounts": [
        {
          "accountId": "main",
          "label": "Main",
          "apiKey": "sk-yyyyy",
          "enabled": true
        }
      ]
    }
  ]
}
```

## 当前限制

- 并不是所有 provider 都能提供精确绝对值

## 相关模块

- 依赖：`shared`
- 被依赖：`desktop`
