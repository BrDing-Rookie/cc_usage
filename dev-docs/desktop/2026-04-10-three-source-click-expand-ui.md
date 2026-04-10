# 三来源点击展开监控器 UI 改造

> 模块: `desktop`
> 创建日期: 2026-04-10
> 状态: 已完成
> 关联计划: `docs/superpowers/plans/2026-04-10-three-source-click-expand-usage-monitor-implementation.md`

## 目标

把当前桌面端从通用来源列表改成固定三来源的顶部紧凑条，并通过点击展开下方详细面板。

## 涉及文件

- `.worktrees/vibe-monitor/apps/desktop/src/App.tsx` — 改 hover 为 click 展开
- `.worktrees/vibe-monitor/apps/desktop/src/App.test.tsx` — 锁定三来源与点击交互
- `.worktrees/vibe-monitor/apps/desktop/src/components/CompactStrip.tsx` — 新建顶部紧凑条
- `.worktrees/vibe-monitor/apps/desktop/src/components/ExpandedMonitor.tsx` — 新建展开面板
- `.worktrees/vibe-monitor/apps/desktop/src/components/charts/Sparkline.tsx` — 新建轻量图表组件
- `.worktrees/vibe-monitor/apps/desktop/src/components/monitorUtils.ts` — 处理美元、百分比、来源标签和历史值
- `.worktrees/vibe-monitor/apps/desktop/src/app.css` — 重写为参考图布局

## 方案

- 顶部只展示 `Claude Code`、`OpenAI Codex`、`mininglamp` 三个 tile
- 点击紧凑条展开，再次点击或点击关闭按钮收起
- 展开面板固定为 3 张卡片，不再走通用列表
- `Claude Code` 和 `OpenAI Codex` 显示历史图表
- `mininglamp` 重点显示美元额度，不显示历史图表
- 所有图表都来自 materialized history

## 验收标准

- [x] 默认态只出现 3 个来源 tile
- [x] 点击后展开详细面板
- [x] 展开视图固定显示 3 张来源卡片
- [x] `mininglamp` 以美元格式显示数值
- [x] `Claude Code` 和 `OpenAI Codex` 使用 `last_5_hours` 历史序列绘图

## 开发记录

### 2026-04-10

- 创建开发任务文档
- 添加三来源点击展开交互测试（commit: `0c4f84c`）
- 完成三来源点击展开 UI 与图表落地（commit: `8ca0edb`）
