# Vibe Usage Monitor 开发文档

## 开发目标

这个目录用于在真正编码前记录有意义的代码任务。所有非微小改动都应先创建模块级任务文档，并在索引中登记。

## 索引

- [BACKLOG.md](./BACKLOG.md) — 进行中与待开发任务
- [DONE.md](./DONE.md) — 已完成任务

## 模块目录

| 模块 | 目录 | 涉及范围 |
|------|------|------|
| desktop | [desktop/](./desktop/) | `apps/desktop/`、renderer、shell UI |
| usage-daemon | [usage-daemon/](./usage-daemon/) | `apps/usage-daemon/`、adapters、storage、refresh loop |
| browser-worker | [browser-worker/](./browser-worker/) | `apps/browser-worker/`、浏览器型采集器 |
| shared | [shared/](./shared/) | `packages/shared/`、schema 与类型 |
