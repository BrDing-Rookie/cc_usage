# 调整 Popover 展示排序

- **状态**: 已完成
- **模块**: desktop
- **创建日期**: 2026-04-18

## 目标

将 popover 的展示顺序调整为：状态栏 pinned account 相关内容优先展示，其余内容按可用百分比顺序展示。

## 涉及文件

- `apps/desktop/src/App.tsx` — 读取 pinned account 配置并传给 popover
- `apps/desktop/src/App.test.tsx` — 排序行为回归测试
- `apps/desktop/src/components/PopoverContent.tsx` — gateway 与 account 的展示排序

## 方案

- 读取 `statusBar.pinnedAccountId`
- 概览中优先展示包含 pinned account 的 gateway
- 详情中优先展示 pinned account，其余 account 按 `usagePercent` 从高到低排序，空值放最后

## 验收标准

- pinned account 所在 gateway 在概览中优先展示
- gateway 详情中 pinned account 第一，其余 account 按百分比降序展示
- `corepack pnpm --filter @vibe-monitor/desktop test -- src/App.test.tsx` 通过
