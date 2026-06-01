# jumpx-ppt-studio · Claude Code 入口

> **Jumpx PPT Studio** —— [`jumpx-ppt-forge`](https://github.com/JumpX-Labs/jumpx-ppt-forge) 这套幻灯 skill 的 Web 操作台（deepagents on LangGraph 驱动 skill，带人在环 HITL 门禁）。
> 先读 [`README.md`](./README.md) 了解定位；工程文档按课程模块组织在 [`docs/`](./docs/)。

> 📚 本项目源自 **JumpX AI 实战营 · Week04 Vibe Coding** 课程。`docs/` 下的设计 / PRD / 实施 / Agent 控制 / 调研，就是这门课带学员走过的完整链路。

## 这是什么
一个把 AI 幻灯 skill 装进 Web 工作台的单机应用：主题/资料进 → 确认大纲 → 选模板/形态 → 模型直写 HTML → 在线预览 / 导出 / 演示。Studio 不重新实现生成逻辑，逻辑都来自 forge skill。

## 文档导航（按授课模块）
- **设计**：[`docs/01-design/`](./docs/01-design/) —— 交互设计方案、Claude Design 操作手册与体验拆解、可点原型
- **PRD**：[`docs/02-prd/`](./docs/02-prd/) —— 产品需求 v2
- **实施**：[`docs/03-implementation/`](./docs/03-implementation/) —— 实施计划 / 任务 / 技术验证 / 进展记录
- **Agent 控制**：[`docs/04-agent-control/`](./docs/04-agent-control/) —— 用户可控的「配方 / Skill 控制器」设计
- **调研**：[`docs/05-research/`](./docs/05-research/) —— deepagents 生态、导出方案、解析与风格导入

## 护栏（硬规则）
- **不 `git commit` / `git push`**，除非用户明确要求。
- 遇到**需要拍板的决策点**，先停下问用户，不要自己替我们决定。
- 需要 API key / model 选择等密钥与配置，**列出来让用户提供**，不要硬编码、不要瞎填。
- 本地路径 / 联系方式等私有信息放在 gitignored 的 `_local/`，不要写进会上传的文档。
