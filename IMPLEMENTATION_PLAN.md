# IMPLEMENTATION_PLAN.md · 一步步用 LangGraph/deepagents 实现 PRD v2

> 写给**未来接手的我**(一个全新上下文的编码 agent)。读完这份 + [`PRD_v2.md`](./PRD_v2.md) + [`TECH_SPIKES.md`](./TECH_SPIKES.md),你应能从现状直接续做,不必重新调研。
> **现状**:阶段 1-3 已完成(调研→本地跑通→接 skill 端到端产 HTML);交互原型 + 配方系统已在 `docs/ClaudeDesign/Jumpx Slides/原型/` 做出并部署。现在要把它**产品化**成 PRD v2。

---

## 0. 先读这些(orientation)

- **真相来源**:[`PROGRESS.md`](./PROGRESS.md)(进度/已做/卡点)、[`RESEARCH.md`](./RESEARCH.md)(deepagents/LangGraph 确切做法+出处)。
- **已跑通的后端脚手架**:`backend/agent.py`(create_deep_agent + ChatOpenAI[火山方舟] + FilesystemBackend + skills + interrupt_on)、`backend/slide_tools.py`(4 个 web 层工具)、`backend/setup_workspace.py`(把 skill 复制进 workspace)、`backend/langgraph.json`。
- **skill 资产**(只读引用,勿改原件):`../jumpx-ppt-slides-skill/skills/ai-slide-producer/`(SKILL.md + references + schemas + scripts:`build_html.py`/`validate_slide_plan.py`/…)。
- **前端原型(目标形态)**:`docs/ClaudeDesign/Jumpx Slides/原型/`(proto-*.jsx)——React 组件 + proto.css 设计系统;已是要 port 的蓝本。线上:https://jumpx-slides-demo.deeptoai.workers.dev
- **环境**:Python 3.12 venv 在 `backend/.venv`;model 走火山方舟(OpenAI 兼容,key 在 `backend/.env`,已 gitignore);Node 22 + yarn。

---

## 1. 底座回顾(deepagents on LangGraph)

- `create_deep_agent(model, tools, system_prompt, backend, skills, interrupt_on, checkpointer, …)` → 一个 CompiledStateGraph。内核是 **ReAct 式 tool-calling 循环**,跑在 **LangGraph 图**上(图给:持久化 / interrupt / 流式 / 可组合)。
- **skills**:`skills=["/skills/ai-slide-producer"]`,从 backend root 相对路径加载;progressive disclosure(启动只读 frontmatter,运行时按需 read_file)。
- **FilesystemBackend(root_dir=WORKSPACE, virtual_mode=True)**:agent 文件读写落真实磁盘、限定在 root 内;**references 改动 live 读、下次生成生效**。
- **interrupt_on**:`{"tool": {"allowed_decisions": ["respond"/"approve"…]}}` → agent 调该工具前暂停;`Command(resume={"decisions":[{"type":"respond","message":"…"}]})` 恢复。**这是两个交互点的机制。**
- **流式**:`messages`(token)/`updates`(todos/state)。前端 useStream 消费。
- **checkpointer**:`langgraph dev` 自动提供(内存);**生产单机用 SQLite saver**(见 S2)。
- **坑(务必记住)**:① `interrupt()` resume 会从 node 头重跑 → 副作用(出图/渲染)放 resume **之后**;② subagent 内 interrupt_on 的 edit/reject 有 bug(#554)→ 交互点放主 agent、用 respond/approve;③ langgraph dev 内存态重启即丢。

---

## 2. PRD → 技术组件映射

| PRD | 技术落点 |
|---|---|
| 生成主流程 + 2 交互点 | deepagents 主 agent + `choose_template`/`choose_render_mode`(interrupt_on respond) |
| 大纲确认 | `confirm_outline` 工具(interrupt)或保留对话式 gate,前端渲染左树/右预览 |
| 渲染产 HTML | `build_slides_html`(进程内 import skill 的 `build_html.build()`) |
| 出图 | `generate_image`(web 层,key 在后端;无 key 返回不可用→走 HTML) |
| 配方=skill=zip | 配方 = 一个 skill 目录;库 = 目录集合;active 配方 = 生成时 fresh 挂载 |
| 配方可改层 | `references/{02,03,05}.md` + `background.md` + density 参数 |
| 配方校验 | 验证 skill/流程(lint + 干跑 + validate_slide_plan) |
| 状态可恢复 | SQLite checkpointer |
| 前端画布为主 + 配方页 | port `proto-*.jsx` → Next/React,连 LangGraph 流 |
| 导出 PPTX | 新增导出器(skill Phase3 规划里有 PPTX) |

---

## 3. 实施阶段(按序)

### Phase 0 · 技术验证(先做,见 TECH_SPIKES）
跑 S1–S4(+S5),全过再进 Phase 1。用现有 `backend/` 改最小代码验证,不要先铺全量。

### Phase 1 · 生成内核产品化
1. **agent 工厂**:把 `backend/agent.py` 重构出 `build_agent(recipe_dir, *, checkpointer=None)`,**每次生成按 active 配方实例化**(S1)。`langgraph.json` 的 graph 指向一个能按 active 配方构建的入口。
2. **SQLite 持久化**(S2):非 dev 运行时用 `langgraph.checkpoint.sqlite.SqliteSaver`(本地文件)。
3. **两个交互点**:`slide_tools.py` 已有 `choose_template`/`choose_render_mode` + interrupt_on(respond)。确认 resume 后 build/出图在 resume 之后执行(坑①)。
4. **大纲确认**:决定用 `confirm_outline` 工具(payload 带大纲结构,前端渲染编辑器)还是对话式;推荐工具化,交互更可控。
5. **门禁**:沿用 skill 的九步 + 在 system_prompt 收敛对话式 gate(避免过多停顿)。
6. **验证**:经 LangGraph server 端到端跑通(已验证模式见 PROGRESS 阶段 3),产 HTML。

### Phase 2 · 配方系统(后端)
1. **目录布局**:`workspace/recipes/<recipe-id>/`(每个 = 一个 skill 副本);`workspace/recipes/_active`(指针);内置配方种子。
2. **可改层定义**:固定为 §PRD 12.1 的文件/参数;写一个 `recipe_schema`(manifest:id/name/version/author/contract_version/editable)。
3. **吸收/合并(S5)**:`absorb_recipe(uploaded_zip)` → 解包 → 抽可改层 → 并到当前锁定基座副本 → 回告被忽略的锁定改动。
4. **验证 skill / 流程(S3)**:`validate_recipe(recipe_dir)` → lint + 安全审查 + 干跑(1–2 页)+ `validate_slide_plan`。不过 → 不可用。
5. **导入/导出**:zip 进出;导出标注 editable/locked。
6. **schema 升级钩子**:`revalidate_all_recipes()`,失败者标 invalid。
7. **安全(S4)**:确认工具面最小 + FilesystemBackend 沙箱 + system_prompt 压顶。
8. **(可选)廉价预览**(S6):`preview_recipe(recipe_dir, mode="outline|one-page")`。

### Phase 3 · 前端(port 原型 → 真 React + 连后端)
1. 选栈:Next.js(沿用 deep-agents-ui 的 `@langchain/langgraph-sdk` useStream)或在 `ui/` 基础上改。把 `proto-*.jsx` 的组件/proto.css 迁入(它们已是 React 组件,去掉 Babel standalone、改构建版)。
2. **连流**:`messages`→打字机;`updates`→todos/活动流;`files`→产物;`stream.interrupt`→交互点。
3. **交互点渲染在主舞台覆盖层**(不弹聊天):`choose_template`→模板网格(套你封面);`choose_render_mode`→同页两版;`confirm_outline`→左树/右预览编辑器。resume 用 `command:{resume:{decisions:[…]}}`。
4. **渲染高光**:按 slide_plan 先放骨架缩略图,渲染完逐页替换(逐页点亮)。
5. **配方页 + 编辑器**(port `proto-recipe.jsx`):叙事页 + 人格画廊 + 简洁旋钮 + 进阶 Markdown,接 Phase 2 的 recipe API(列表/读/写/校验/上传/下载/选用)。
6. **模板名 ↔ 后端 preset 对齐**:原型里 7 个中文模板名(素白/学术绿/…)要映射到 skill 真实 preset(teaching-clean/…)或给 preset 加中文 display_name。**别让 UI 选了后端没有的 preset。**

### Phase 4 · 渲染与导出
- HTML:`build_slides_html` 已通。
- **PPTX**(中文用户刚需):新增导出器(从 slide_plan/HTML → pptx;评估 python-pptx 或 skill Phase3 规划)。PDF/图片:HTML→打印/截图或图片路径。

### Phase 5 · 打包成单机应用
- 形态:本地 Web(用户起后端 + 前端)或 Electron/Tauri 壳。无账号、状态本地 SQLite、配方库本地目录。
- 部署原型给人看用 Cloudflare Workers 静态(见 PROGRESS;纯前端 mock)。

---

## 4. 关键决策(已拍板,别再推翻)
- 生成大流程**固定**;用户只改可改层(叙事/语气/素材吸收/背景知识/厚薄),其余锁定。
- 配方=skill=zip;上传**只吸收可改层**、不碰锁定层(→ 无陈旧 fork + 堵注入)。
- 单机无账号;无共享市场(MVP);分享走带外(导出 zip)。
- 改配方**只影响下一份**;每次生成 fresh 实例化 agent。
- 安全靠**工具面收紧 + workspace 沙箱 + 系统提示压顶**,验证 skill 仅辅助。

## 5. 踩过的坑(省得再踩)
- deepagents `interrupt()` resume 整段重跑 node → 副作用后置。
- subagent interrupt_on edit/reject bug → 交互点放主 agent、用 respond/approve。
- langgraph dev 内存态;生产换 SQLite saver。
- `StateBackend` 不能跑 shell;我们已把执行上移成 web 层工具,用 FilesystemBackend(本地)/未来生产评估 StoreBackend/沙箱。
- 前端若再用 Babel standalone:多 script 执行顺序不保证 → 跨文件依赖移进组件体 + 轮询挂载(真 React 构建版无此问题)。
- 静态预览开发期 CSS/bundle 会被浏览器缓存 → 链接加时间戳或验证用 curl。
- 模板名要对齐后端真实 preset。

## 6. 验证习惯
每阶段:经 LangGraph server 端到端跑、前端浏览器实跑(预览工具截图)、更新 PROGRESS。优先用本仓库已有 `validate_*.py` 做产物校验。
