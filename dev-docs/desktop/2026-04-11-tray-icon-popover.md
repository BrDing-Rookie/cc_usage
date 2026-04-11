# macOS 状态栏 Tray Icon + Popover 轻量化改造

**模块**: desktop
**创建日期**: 2026-04-11
**状态**: 已完成

## 目标

将 desktop 应用从 320x140 悬浮窗改造为 macOS 状态栏 tray icon + popover 弹窗，仅展示 mininglamp 渠道用量。

## 涉及文件

### Rust 后端
- `apps/desktop/src-tauri/Cargo.toml` — 添加 image 依赖、tray-icon/image-png features
- `apps/desktop/src-tauri/tauri.conf.json` — 移除静态窗口、添加 LSUIElement
- `apps/desktop/src-tauri/capabilities/default.json` — 添加 tray 权限
- `apps/desktop/src-tauri/src/ring_icon.rs` — 新增，圆环图标 PNG 生成器
- `apps/desktop/src-tauri/src/tray.rs` — 新增，tray 管理核心
- `apps/desktop/src-tauri/src/lib.rs` — 添加模块和 setup hook

### React 前端
- `apps/desktop/src/App.tsx` — 精简为 popover UI
- `apps/desktop/src/components/PopoverContent.tsx` — 新增
- `apps/desktop/src/app.css` — 添加 popover 样式

### 删除
- CompactStrip.tsx, ExpandedMonitor.tsx, Sparkline.tsx, ExpandedPanel.tsx, CalmPanel.tsx, AlertStrip.tsx

## 方案

1. Tauri 2 内置 system tray API，动态生成 44x44 彩色圆环图标
2. 圆环默认蓝色，用量 >80% 变红色
3. 悬浮即展示 popover，点击常驻，失焦关闭
4. LSUIElement=true 隐藏 Dock 图标

## 验收标准

- 状态栏出现圆环图标，颜色随用量变化
- 悬浮/点击/失焦交互正常
- popover 展示百分比、已用金额、配额
- 应用不出现在 Dock 中
- cargo build 通过
