# 实施任务文档 · AI Slides WebApp 脚手架

> 给执行的 Claude Code。**目标：把 deepagents 生态调研清楚 → clone → 本地跑通 → 在本目录搭好脚手架并接入我们已有的 ai-slide-producer skill。** 这一轮只到"脚手架能跑 + skill 接上"，不要求完整产品功能。
> 工作目录：`Jumpxai/Github/ai-ppt-webapp/`（即本目录）。

---

## 0. 我们到底要做什么（背景，先读懂再动手）

我们已有一套能生成幻灯片的 skill（`ai-slide-producer`，**3 套模板 + 真实图片生成均已测试通过**）。skill 是"会做事的说明书"，但它不会自主规划、不会在岔路口主动问用户。

本 WebApp ＝ **用 deepagents（一个像 Claude Code 的自主 agent harness）驱动这份 skill**，并补上 skill 给不到的**交互层**：
- 关键交互点 ①：**选哪套模板**（3 选 1）
- 关键交互点 ②：**出图 还是 HTML**

最终形态：网页里输入主题 → agent 自主规划(todo)、流式跑 → 到岔路口停下问用户 → 产出可见 slides → 部署上线。
完整需求见产品 PRD（`../../01_Camps/.../Week04_Vibe_Coding/课件2_AI_Slides_WebApp完整PRD.md`）。本文件只覆盖**脚手架阶段**。

---

## 1. 技术底座（已选型，勿推翻）

- **引擎**：`deepagents`（LangGraph 之上的 agent harness；自带 planning / 虚拟文件系统 / 子 agent / human-in-the-loop 中断 / skills）。
- **不要**改成裸 LangGraph 手工连图，也不要换 OpenAI Agents SDK——选型理由见 `deepagents_调研_v1.md`。
- **交互层**靠 deepagents 的中断（human-in-the-loop / `ask_clarification` 式）实现，参考 DeerFlow 范式（`../../07_Research/DeerFlow借鉴调研_AI_PPT产品_v1.md`）。

---

## 2. 相关仓库（先调研，再按需 clone）

> 以下为调研起点；**以各 repo 当前 README 为准**，版本可能已更新。

| 用途 | 仓库 | 备注 |
|------|------|------|
| **引擎 / Agent loop（必用）** | `langchain-ai/deepagents`（Python SDK） | `create_deep_agent(...)`，跑成 LangGraph server | 
| **UI（必用）** | `langchain-ai/deep-agents-ui` | Next.js，:3000，连 LangGraph server（默认 :8123，部分版本 :2024） |
| **理解 Agent loop（调研）** | `langchain-ai/deep-agents-from-scratch` | 教学向，看清 loop / planning / 子 agent 怎么搭起来 |
| 参考（可选） | `langchain-ai/deepagents-quickstarts`、`langchain-ai/deepagentsjs` | 示例 + UI 集成；JS 版备选 |

如果某仓库已废弃/改名/合并，记录在 `PROGRESS.md` 并选当前官方等价物。

---

## 3. 阶段与验收标准

### 阶段 1 · 调研（产出 `RESEARCH.md`）
**做什么**：读 `deepagents`、`deep-agents-ui`、`deep-agents-from-scratch` 的 README/docs，搞清楚：
- deepagents 怎么 `create_deep_agent`、怎么挂 tools、怎么挂 **skills**（我们要挂自己的 skill）。
- 怎么把 agent 跑成 **LangGraph server**（`langgraph dev` / langgraph.json 配置）。
- deep-agents-ui 怎么连后端、env 怎么配、端口是多少。
- **human-in-the-loop 中断**怎么实现（这是我们两个交互点的关键）。
- 流式协议（UI 怎么显示 plan/todo 和增量输出）。

**验收**：`RESEARCH.md` 写清以上每条的**确切做法 + 出处**，并标注与本项目需求的对应关系。不确定的明确写"未验证"。

### 阶段 2 · clone + 本地跑通（产出可运行的 hello-world）
**做什么**：
- 在本目录建合理结构（见 §4），按需 clone 仓库（建议放 `vendor/` 或作为依赖安装）。
- 安装依赖，**先跑官方最简示例**：起一个最小 deep agent 的 LangGraph server，再起 deep-agents-ui，**浏览器里能和一个 hello-world deep agent 对话、能看到流式输出**。

**验收**：
- [ ] LangGraph server 本地起得来（记录端口）。
- [ ] deep-agents-ui 起得来（:3000）并连上后端。
- [ ] 浏览器里能对话、能看到 agent 的 plan/todo 与流式输出。
- [ ] 把跑起来的步骤、端口、env 写进 `PROGRESS.md` 和一份 `RUN.md`（怎么启动）。

### 阶段 3 · 搭脚手架 + 接入我们的 skill（本轮终点）
**做什么**：
- 建一个我们自己的 deep agent（不是官方 demo agent），**把 `ai-slide-producer` skill 挂进它的虚拟文件系统**。skill 源在 `../jumpx-ppt-slides-skill/`（含 `skills/ai-slide-producer.zip` 与 SKILL.md / references）。先确认 skill 能被 agent 识别、加载。
- **stub 出两个交互点**（先打通"会停下来问"的机制即可，不必做满）：
  - ①「选模板」：agent 跑到该步用中断问用户、用户选了能继续。
  - ②「出图 / HTML」：同上。
- 跑一次端到端：UI 输入一个主题 → agent 规划 → 在两个岔路口停下问 → 产出一份（最小可见）slides。**图片路径与 HTML 路径至少各跑通一条**（skill 侧已测通，重点是 agent 能正确驱动它）。

**验收**：
- [ ] 我们自己的 agent 能加载并调用 ai-slide-producer skill。
- [ ] 两个 ask_clarification 交互点能"停—问—续"。
- [ ] 端到端能产出一份可见 slides（HTML 或图片）。
- [ ] 目录结构、启动方式、已知缺口写进 `PROGRESS.md`。

> 部署上线（拿真实网址）属于**下一轮**，本轮不要求；但 `RESEARCH.md` 里顺带记录"deepagents/LangGraph server 怎么部署"的调研结论，供后续用。

---

## 4. 建议目录结构（可按调研结论调整）

```
ai-ppt-webapp/
├── CLAUDE.md                ← 入口（已存在）
├── IMPLEMENTATION_TASK.md   ← 本文件
├── RESEARCH.md              ← 阶段1产出
├── RUN.md                   ← 怎么本地启动
├── PROGRESS.md              ← 每阶段进度/卡点/下一步
├── backend/                 ← deepagents agent + 我们的 agent 定义 + skill 挂载
│   ├── agent.py             ← create_deep_agent + 挂 ai-slide-producer skill
│   ├── langgraph.json       ← LangGraph server 配置
│   └── skills/              ← 放/链接 ai-slide-producer（从 ../jumpx-ppt-slides-skill 取）
├── ui/                      ← deep-agents-ui（clone 或作为子项目，env 指向 backend）
└── vendor/ (可选)           ← clone 的参考仓库（from-scratch 等，只读参考)
```

---

## 5. 待用户确认 / 需提供（遇到先停下来问，别自己定）

1. **跑 deepagents 用哪个 model**（Claude / GPT / Gemini）→ 决定用哪个 `langchain-*` 包和 API key。
2. **API keys**：model key + 图片生成 backend key（出图路径需要）。让用户提供，勿硬编码、勿提交。
3. 两个交互点的**默认值**（无人选时默认哪套模板 / 默认出图还是 HTML）。
4. UI 用官方 `deep-agents-ui` 直接接，还是需要裁剪——本轮建议**直接用官方 UI**跑通，定制留后续。

---

## 6. 护栏（务必遵守）

- **不 `git commit` / `git push`**，除非用户明确要求。
- **scaffold 优先，别过度开发**：本轮只到"脚手架能跑 + skill 接上 + 两个交互点能停—问—续"，不要去做 7 套风格、局部重生、成本监控等完整功能。
- **每阶段结束更新 `PROGRESS.md`**，遇到决策点停下问用户。
- 不要把 `node_modules/`、大体积依赖、密钥写进会被同步的地方；env 用 `.env`（加 `.gitignore`）。
- 现有 skill（`../jumpx-ppt-slides-skill`）是已验证资产，**只读引用，不要改它**。

---

## 7. 本轮完成的定义（Definition of Done）

> 浏览器打开 UI → 输入一个主题 → 看到 agent 规划与流式 → 在"选模板"和"出图/HTML"两处被询问并能继续 → 最终产出一份可见 slides。并且 `RESEARCH.md` / `RUN.md` / `PROGRESS.md` 三份文档齐全，下一个人能照着继续。

参考资料：
- 产品 PRD：`../../01_Camps/ai_camp/202605_Cohort01/02_Weeks/Week04_Vibe_Coding/课件2_AI_Slides_WebApp完整PRD.md`
- PRD 拆解（步骤/调研/确认/风险）：`../../01_Camps/.../Week04_Vibe_Coding/课件3_PRD拆解_实施步骤与风险.md`
- deepagents 调研：`../../01_Camps/.../Week04_Vibe_Coding/deepagents_调研_v1.md`
- DeerFlow 借鉴（交互层/UX 范式）：`../../07_Research/DeerFlow借鉴调研_AI_PPT产品_v1.md`
- 现有 skill：`../jumpx-ppt-slides-skill/`
