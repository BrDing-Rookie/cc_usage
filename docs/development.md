# 开发说明

## 工作区

- 包管理器：`pnpm`
- 语言：`TypeScript`
- 测试框架：`Vitest`
- Schema 校验：`Zod`

## 基础设置

安装依赖：

```bash
corepack pnpm install
```

运行当前可用测试：

```bash
corepack pnpm test
```

## 工程规则

- 搜索优先使用 `rg`
- 产品逻辑里不要估算缺失额度值
- 不要把 provider 抓取逻辑放进 renderer
- 架构或模块行为发生变化时，同步更新文档

## 文档驱动开发

代码变更前：

1. 在 `dev-docs/` 下确定受影响模块
2. 在 `dev-docs/<module>/YYYY-MM-DD-<slug>.md` 创建任务文档
3. 将该任务登记到 [dev-docs/BACKLOG.md](/Users/brding/projects/LLMProjects/cc_usage/dev-docs/BACKLOG.md)

完成后：

1. 将任务文档状态改为已完成
2. 把索引条目从 backlog 移到 done
3. 更新 `project-docs/` 下对应的模块文档

## 当前文档入口

- 标准文档树：[DOCS-INDEX.md](/Users/brding/projects/LLMProjects/cc_usage/DOCS-INDEX.md)
- 历史规划资料：[docs/archive/README.md](/Users/brding/projects/LLMProjects/cc_usage/docs/archive/README.md)
