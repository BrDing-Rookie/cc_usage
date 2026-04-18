# 修复状态栏 Popover 展示不全

- **状态**: 已完成
- **模块**: desktop
- **创建日期**: 2026-04-18

## 目标

修复状态栏 popover 在双 gateway 概览和 gateway 详情模式下展示不全的问题，确保内容不会被固定窗口尺寸裁剪。

## 涉及文件

- `apps/desktop/src-tauri/src/tray.rs` — 调整 popover 原生窗口尺寸与定位常量
- `apps/desktop/src/app.css` — 调整 popover 滚动和容器高度行为

## 方案

- 将 popover 原生窗口尺寸从旧的单卡片尺寸提升到适配双 gateway 布局的尺寸
- 为 popover 内容启用滚动回退，避免 account 数量增加后再次被裁剪
- 保持状态栏点击打开/关闭行为不变

## 验收标准

- 默认双 gateway 概览完整显示
- gateway 详情完整显示，必要时可滚动
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` 通过
- `corepack pnpm --filter @vibe-monitor/desktop test` 通过
