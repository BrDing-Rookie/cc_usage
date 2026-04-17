# 双网关多账户监控实现

- **状态**: 进行中
- **模块**: desktop, shared, usage-daemon
- **创建日期**: 2026-04-18

## 目标

将当前单网关、单 key 的监控器升级为双 gateway、多 account 模式，并允许在状态栏固定展示一个 account。

## 涉及文件

- `packages/shared/src/schema.ts` — 新的 `gateways + accounts` 契约
- `apps/desktop/src-tauri/src/usage/` — 多 account 刷新与 gateway 汇总
- `apps/desktop/src-tauri/src/tray.rs` — pinned account 状态栏逻辑
- `apps/desktop/src/components/PopoverContent.tsx` — 双 gateway 概览和详情
- `apps/desktop/src/components/SettingsWindow.tsx` — 多 account 配置与 pinned account 选择

## 方案

- 配置模型改为固定双 gateway 下的 `accounts[]`
- daemon 按 account 刷新，按 gateway 汇总
- 状态栏只显示 pinned account，其他 account 仅在 `usagePercent >= 80%` 时触发中心红色 `!`

## 验收标准

- 默认 popover 概览同时展示 `llm-gateway` 和 `vibe`
- 同一 gateway 可配置多个 account
- 现有单 gateway 配置可自动迁移到新配置格式，且旧配置在迁移后仍能正常读取与展示
- 状态栏只展示一个 pinned account
- 其他 account 仅在高占用时触发中心红色 `!`
