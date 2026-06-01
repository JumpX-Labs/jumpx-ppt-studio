# 工程文档 · 按授课模块组织

> 这套文档不只是开发笔记 —— 它按 **JumpX AI 实战营 · Week04「Vibe Coding」** 的授课链路组织：
> **设计 → PRD → 实施 → Agent 控制 → 调研**。
> 想看一个真实 AI 产品「从原型到上线」是怎么一步步被想清楚、做出来的，顺着读下去就是一节完整的课。
>
> 产品本体见仓库根 [`README.md`](../README.md)；幻灯 skill 见 [`jumpx-ppt-forge`](https://github.com/JumpX-Labs/jumpx-ppt-forge)。

---

## 01 · 设计（Design）
怎么用 Claude 从零上下文做出可点原型、再定下交互体验。
- [`UX_DESIGN.md`](./01-design/UX_DESIGN.md) — AI Slides WebApp 专属交互设计方案
- [`CLAUDE_DESIGN_PLAYBOOK.md`](./01-design/CLAUDE_DESIGN_PLAYBOOK.md) — Claude Design 操作手册：从零上下文到产出生产代码
- [`CLAUDE_DESIGN_体验拆解.md`](./01-design/CLAUDE_DESIGN_体验拆解.md) — 制作原型的交互体验拆解
- [`prototype/`](./01-design/prototype/) — 可点的高保真原型（HTML / JSX）与截图

## 02 · PRD（Product）
把一个想法收敛成可执行的产品需求。
- [`PRD_v2.md`](./02-prd/PRD_v2.md) — 可掌控配方的 AI 幻灯片生成器（v2）

## 03 · 实施（Implementation）
用 deepagents / LangGraph 把 PRD 落成可跑的系统。
- [`IMPLEMENTATION_PLAN.md`](./03-implementation/IMPLEMENTATION_PLAN.md) — 一步步实现 PRD 的计划
- [`IMPLEMENTATION_TASK.md`](./03-implementation/IMPLEMENTATION_TASK.md) — 脚手架阶段的实施任务书
- [`TECH_SPIKES.md`](./03-implementation/TECH_SPIKES.md) — 全量开发前的技术验证清单
- [`PROGRESS.md`](./03-implementation/PROGRESS.md) — 逐阶段进展记录（真实的踩坑与修正留痕）

## 04 · Agent 控制（Agent Control）
怎么把"配方 / skill"做成用户可看、可改、可换的一等资产。
- [`SKILL_CONTROLLER.md`](./04-agent-control/SKILL_CONTROLLER.md) — 用户可控的「配方 / Skills 控制器」设计

## 05 · 调研（Research）
做选型决策前的真实调研。
- [`RESEARCH.md`](./05-research/RESEARCH.md) — deepagents 生态调研
- [`EXPORT_RESEARCH.md`](./05-research/EXPORT_RESEARCH.md) — 导出方案（PDF/PNG/PPTX）选型
- [`PARSE_STYLE_RESEARCH.md`](./05-research/PARSE_STYLE_RESEARCH.md) — 文件解析 + 风格导入调研

---

_本项目与文档出自 [JumpX Labs](https://github.com/JumpX-Labs) 的 AI 实战营课程。_
