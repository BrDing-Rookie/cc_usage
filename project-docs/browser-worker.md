# Browser Worker

## 功能概述

browser worker 负责那些需要真实浏览器会话、持久 cookies，或 provider UI 本身没有稳定 API 契约的采集流程。

## 核心能力

- **浏览器隔离**：把自动化会话状态与 daemon 隔离
- **兜底采集**：为必须走浏览器的来源提供抓取能力
- **故障隔离**：避免浏览器问题拖垮整个刷新流程

## 使用方式

当某些 provider 需要浏览器型状态时，例如 `codex-official`，对应 adapter 会通过该模块完成采集。

当前支持的 job：

- `codex-chatgpt-usage`: 使用持久 profile 导航到 `https://chatgpt.com/codex/cloud/settings/usage` 并提取用量信息

持久 profile 目录约定为：

- `${VIBE_MONITOR_RUNTIME_DIR}/browser-profiles/codex-official`

## 当前限制

- 浏览器型采集通常比 API 型采集更慢，也更脆弱

## 相关模块

- 依赖：`shared`
- 被依赖：`usage-daemon`
