# Shared

## 功能概述

shared 模块定义了整个项目使用的统一数据契约，为 renderer、daemon 和测试层提供一致的 schema 与 TypeScript 类型。

## 核心能力

- **Schema 校验**：用 Zod 定义 snapshot 与 materialized state 契约
- **类型共享**：对运行时层和测试层导出推导类型

## 使用方式

当前核心源文件：

- [packages/shared/src/schema.ts](/Users/brding/projects/LLMProjects/cc_usage/packages/shared/src/schema.ts)
- [packages/shared/src/index.ts](/Users/brding/projects/LLMProjects/cc_usage/packages/shared/src/index.ts)

## 当前限制

- JSON Schema 还没有导出到 `schemas/`
- 契约扩展需要兼顾各运行时层的兼容性

## 相关模块

- 依赖：无
- 被依赖：`desktop`、`usage-daemon`、`browser-worker`
