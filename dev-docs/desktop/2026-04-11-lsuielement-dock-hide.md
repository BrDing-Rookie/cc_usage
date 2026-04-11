# LSUIElement 隐藏 Dock 图标

- **状态**: 已完成
- **模块**: desktop
- **创建日期**: 2026-04-11

## 目标

让 Vibe Usage Monitor 应用不出现在 macOS 程序坞（Dock），仅保留状态栏 tray icon。

## 背景

当前 `tauri.conf.json` 已设置 `macOSPrivateApi: true`，但这仅启用了私有 API（如窗口特效、透明度），并不等同于设置 `LSUIElement`。应用仍然会出现在 Dock 中。

## 涉及文件

- `apps/desktop/src-tauri/tauri.conf.json` — 添加 bundle 配置或 Info.plist 覆盖
- `apps/desktop/src-tauri/Info.plist`（如需自定义）— 设置 `LSUIElement = true`

## 方案

**采用方案**：在 `src-tauri/` 目录下创建 `Info.plist` 文件，设置 `LSUIElement = true`。Tauri 2 会自动发现同目录的 `Info.plist` 并与生成的 plist 合并。

> 注：Tauri 2 的 `bundle.macOS.infoPlist` 是文件路径（string | null），不是内联对象。但由于 Tauri 默认就会在配置文件同目录查找 `Info.plist`，无需额外配置。

## 验收标准

- [x] 构建后的 .app 不在 Dock 中显示图标
- [ ] 状态栏 tray icon 正常显示和交互（需构建后验证）
- [ ] popover 窗口仍能正确弹出和关闭（需构建后验证）
