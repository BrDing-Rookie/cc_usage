# 动态窗口尺寸适配

- **状态**: 已完成
- **模块**: desktop
- **创建日期**: 2026-04-18

## 目标

让状态栏 popover 和 Settings 窗口根据内容与 account 数量动态调整高度，并在超过上限时回退为滚动。

## 涉及文件

- `apps/desktop/src/App.tsx` — popover 入口尺寸联动
- `apps/desktop/src/components/PopoverContent.tsx` — popover 内容高度变化源
- `apps/desktop/src/App.test.tsx` — popover 交互回归测试
- `apps/desktop/src/components/SettingsWindow.tsx` — settings 动态高度与保存流程保持兼容
- `apps/desktop/src/components/SettingsWindow.test.tsx` — settings 回归测试
- `apps/desktop/src/components/*.css` 或现有样式文件 — 窗口滚动与容器高度表现

## 方案

- popover 保持稳定宽度，按概览/详情内容和 account 数量动态调整高度
- Settings 保持稳定宽度，按 gateway 与 account 数量动态调整高度
- 两个窗口都设置最小高度与最大高度；超过上限时窗口内滚动
- 不改变状态栏点击打开/关闭逻辑，也不改变配置数据契约

## 验收标准

- popover 概览随内容完整显示，详情 account 变多时自动增高
- Settings 随 gateway/account 数量自动增高
- 超过上限时窗口内可滚动，不裁切内容
- `corepack pnpm --filter @vibe-monitor/desktop test` 通过
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` 通过
