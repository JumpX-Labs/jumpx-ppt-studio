# PROGRESS.md · AI Slides WebApp 脚手架

> 每阶段更新。记录已做 / 卡点 / 下一步。任务宪法见 [`IMPLEMENTATION_TASK.md`](./IMPLEMENTATION_TASK.md)。

---

## 当前状态：阶段 1 ✅ ｜ 阶段 2 ✅ ｜ 阶段 3 ✅（本轮 DoD 达成）

最后更新：2026-05-31

> **本轮 Definition of Done 已在浏览器里闭环**：UI 输入主题 → agent 规划(todo)+流式 →
> 在「选模板」「出图/HTML」两处停下询问（真实 UI 审批面板，Approve 续跑）→ 产出可见
> HTML slides（teaching-clean，可翻页）。RESEARCH / RUN / PROGRESS 三份文档齐全。

### 📚 文档总览（2026-05-31 · v2 规格已定稿，下一步是产品化实施，今日不实施）
- **产品**：[`PRD_v2.md`](./PRD_v2.md)（配方进 MVP、单机无账号、配方=skill=zip、可改边界、验证硬门；继承 v1 生成内核）
- **交互/设计**：[`UX_DESIGN.md`](./UX_DESIGN.md)、[`SKILL_CONTROLLER.md`](./SKILL_CONTROLLER.md)、[`CLAUDE_DESIGN_体验拆解.md`](./CLAUDE_DESIGN_体验拆解.md)
- **技术验证**：[`TECH_SPIKES.md`](./TECH_SPIKES.md)（开发前 6 个 spike，S4 导入配方安全最高优先）
- **实施步骤**：[`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)（写给未来的我：基于 LangGraph/deepagents 一步步实现整份 PRD）
- **调研/启动**：[`RESEARCH.md`](./RESEARCH.md)、[`RUN.md`](./RUN.md)
- **可点原型**：`docs/ClaudeDesign/Jumpx Slides/原型/prototype.html` · 线上 https://jumpx-slides-demo.deeptoai.workers.dev

---

## 阶段 1 · 调研 — 完成 ✅

**产出**：[`RESEARCH.md`](./RESEARCH.md)（每条都有确切做法 + 出处 + 与本项目对应）。

**关键结论**：
- 引擎 `deepagents 0.6.7`（Python ≥3.11）：`create_deep_agent(model=, tools=, system_prompt=, skills=["/skills/"], interrupt_on=, checkpointer=)`。
- 跑后端：`langgraph.json`（graphs 映射）→ `langgraph dev`，默认 **:2024**；graph_id 即前端 assistant id。
- 前端 `deep-agents-ui`：yarn + Node 20，**:3000**；连接靠 **UI 设置弹框**填 `http://127.0.0.1:2024` + assistant id（**不是 .env**），LangSmith key 本地可留空。
- 两个交互点：用 `interrupt_on` + 「询问型 tool」(`respond` 决策)，主 agent 层触发；前端复用 `ToolApprovalInterrupt`，**不用自写中断 UI**。
- 流式：token 走 `messages`，todo/状态走 `updates`。
- state key 天然匹配：deepagents 默认 `messages`/`todos`/`files` 正是 UI 渲染所需。

**已识别卡点（阶段 3 要解决）**：
- ⚠️ **backend 选型**：我们的 skill 带 Python 脚本（`build_html.py` 等），`StateBackend` **不能跑 shell**；需 `LocalShellBackend` 或沙箱后端，`execute` 工具才能执行脚本。
- ⚠️ `interrupt_on` 在 subagent 层有 edit/reject bug（Issue #554）→ 两个选择点放主 agent 层、用 `respond`。
- ⚠️ `interrupt()` resume 会整段重跑 node → 出图/渲染等副作用必须放 resume 之后。

---

## 阶段 2 · clone + 本地跑通 — 完成 ✅

**model 决策**：用户提供火山引擎方舟（Volcengine Ark），OpenAI 兼容协议 → 用 `langchain-openai` 的 `ChatOpenAI(base_url=...)`。已验证对话 + tool calling 正常。

**已做**：
1. 目录结构：`backend/`（agent.py / langgraph.json / requirements.txt / .env(已 gitignore)）、`ui/`（clone 官方 deep-agents-ui）、`vendor/`（空，参考用）。
2. backend venv 装 deepagents 0.6.7 + langgraph-cli 0.4.27 + langchain-openai 1.2.2。
3. `agent.py`：最小 hello-world deep agent（一个 `get_weather` 工具 + write_todos 引导），model 走 Ark。
4. `langgraph dev` 起后端 :2024，graph `slides_agent` 注册成功。
5. UI `yarn dev`（3000 被占→自动 :3002），设置框填 `http://127.0.0.1:2024` + `slides_agent` 连上。

**验收**（全部达成）：
- [x] LangGraph server 本地起得来（**:2024**）。
- [x] deep-agents-ui 起得来（**:3002**，3000 被占自动跳）并连上后端。
- [x] **浏览器实测**：对话 → `write_todos` 计划 + `get_weather`×2 工具调用 + "All tasks completed" + 流式渲染答案。
- [x] 后端脚本侧验证：`updates`（含 todos）+ `messages/partial`（67 token chunk）流式均正常。
- [x] 启动步骤/端口/env 写入 [`RUN.md`](./RUN.md)。

---

## 阶段 3 · 脚手架 + 接入 skill — 完成 ✅

**架构决策（采纳用户意见：把 skill 的代码依赖解耦到 web 层）**：
- LangGraph 后端本身是 Python 进程 → **不让 agent shell out**，绕开 `StateBackend` 不能跑 shell 的难题。
- skill = **纯知识/资产**，用 `FilesystemBackend(root_dir=workspace, virtual_mode=True)` + `skills=["/skills/ai-slide-producer"]` 挂载；agent 读 SKILL.md/references/schemas 知道"怎么做"。
- skill 原本靠 shell 脚本承担的"执行/调 API"职责，上移为 **web 层工具**（[`slide_tools.py`](backend/slide_tools.py)）：
  - `build_slides_html` → 进程内 import 调用 skill 的 `build_html.build()`（替代 `build_html.py` 脚本）。
  - `generate_image` → 出图 API 职责的 web 层落点（替代 `generate_images.py`；密钥只留后端，本轮默认 HTML 未配 key 时显式返回不可用）。
  - `choose_template` / `choose_render_mode` → 两个交互点，配 `interrupt_on`（allowed_decisions: approve/respond）。
- system_prompt 显式**覆盖** skill 里"用 shell 跑脚本"的指令，改为"用上述工具"。

**文件**：
- [`backend/agent.py`](backend/agent.py) — create_deep_agent + FilesystemBackend + skills + interrupt_on + system_prompt。
- [`backend/slide_tools.py`](backend/slide_tools.py) — 四个 web 层工具。
- [`backend/setup_workspace.py`](backend/setup_workspace.py) — 把只读 skill 幂等复制进 `workspace/skills/`（不改原件）。
- workspace 布局：`workspace/skills/ai-slide-producer/`（挂载的 skill）、`workspace/runs/<slug>/`（各任务产物：source/*.md、source/slide_plan.json、source/style_lock.json、index.html）。

**验收**（全部达成，含浏览器实测）：
- [x] 我们自己的 agent 能加载并驱动 ai-slide-producer skill —— 实测 agent read_file 读 SKILL.md/references/schema，按九步管线跑（写出 project_brief/context_pack/outline/review/slide_plan/style_lock）。
- [x] 两个 interrupt 交互点"停—问—续" —— `choose_template` 与 `choose_render_mode` 均在**真实 UI 审批面板**里挂起、Approve 后续跑（SDK 侧也验证了 respond 路径）。
- [x] 端到端产出可见 slides —— 两份 deck（llm-intro 5 页、remote-work-habits 4 页）HTML 渲染正常、可键盘翻页。

**已知行为 / 缺口（交接给下一轮）**：
- skill 自身还有**对话式 BLOCKING gate**（Gate 1 Brief、Gate 2 Outline、Gate 4 Style）。agent 会忠实地以普通消息停下等"OK"，所以一次完整生产除了两个 interrupt，还会有 1-2 次对话式确认。本轮按 scaffold 接受；若要更顺，可在 system_prompt 收敛或把这些 gate 也并入 interrupt。
- `generate_image` 仅 stub（默认 HTML 路径）。真实出图需用户提供图片 backend key 并接入实际 API 调用。
- ⚠️ `FilesystemBackend` 官方提示不宜用于公网 web server（直接磁盘访问）。本地 langgraph dev 没问题；**部署上线时**需换 `StoreBackend`/沙箱后端并重新设计 skill 文件注入。
- 中间产物里 review/qa 等 gate 偶尔走对话式而非工具，slug 由 agent 自取（如 llm-intro / remote-work-habits）。

---

## 待用户确认

- [x] **model**：火山引擎方舟 Ark（OpenAI 兼容），已配。
- [x] **UI**：本轮直接用官方 `deep-agents-ui`（已采用）。
- [ ] **两个交互点默认值**（阶段 3 需要）：无人选时默认哪套模板（7 选 1，建议 `teaching-clean`）／默认出图还是 HTML（建议先 HTML，免图片 backend key 也能端到端）。
- [ ] **图片生成 backend key**（仅"出图"路径需要）：OpenAI / Gemini Image / NanoBanana 之一。若默认走 HTML，本轮可不提供。

---

## 前端 UI（专属界面，via Claude Design）

- **UX 设计**：[`UX_DESIGN.md`](./UX_DESIGN.md)（4 触点 + 画布为主 + 逐页流式，基于 12+ 产品调研）。
- **建站工具调研**：选用 **Claude Design**（Anthropic 2026-04 产品）出原型 → handoff 给 Claude Code 落地。操作手册见 [`CLAUDE_DESIGN_PLAYBOOK.md`](./CLAUDE_DESIGN_PLAYBOOK.md)。
- **设计系统（已定，源自 Claude Design handoff）**：纸感工作室暖白 `#FAF8F2` + 墨绿强调 `#2C5E48`（刻意避开内容用的蓝 `#2563EB`，形成主-客对比）+ 思源黑体/Space Grotesk/Space Mono。布局 = B 舞台优先 + 副驾 A 克制。设计源留档于 [`frontend/design-source/`](./frontend/design-source/)。
- **已实现**：主工作台 [`frontend/workbench.html`](./frontend/workbench.html) —— 忠实复刻 Claude Design 定稿（渲染中状态：阶段进度 / 裱框舞台 / 三态待办 / 实时活动流 / 底部胶片轨 / 快捷 chip），铺满视口，已用 1440×900 预览验证通过。**当前为静态 mock**。
- **下一步**：① 从 Claude Design 取剩余 4 屏（输入页/大纲编辑器/选模板网格/选输出卡片）② 把这些 port 成 React 组件接进前端、连 LangGraph 流（todos/files/activity 来自 stream；`choose_template`/`choose_render_mode` 的 interrupt payload → 模板网格/输出卡片，替掉 JSON 审批面板）。
- **本地预览**：`.claude/launch.json` 的 `static` 配置（`python3 -m http.server 4180`）→ `http://localhost:4180/frontend/workbench.html`。
- **完整可点击流程原型（via Claude Design handoff + Claude Code 补齐）**：`docs/ClaudeDesign/Jumpx Slides/原型/`。Claude Design 产出 `proto.css`（全量样式/明暗/cqw 模板主题）+ `proto-data.js`（12 页样例/7 模板/活动流文案）；Claude Code 按其文件计划补齐 `proto-slide.jsx`（幻灯片渲染器+缩略图，按 data-tpl 主题）/`proto-screens.jsx`（输入·大纲·选模板·输出 四屏）/`proto-workbench.jsx`（渲染高光动画+完成态）/`proto-app.jsx`（状态机+阶段条+路由+明暗+挂载）/`prototype.html`（React+Babel standalone 组装）。
  - **已端到端验证通过**（1440×900 浏览器实跑）：输入→规划过渡→大纲故事板→选模板(7 套封面实时套用+换肤)→输出同页两版→**渲染逐页点亮高光**(缩略图骨架→填充+三态待办+实时活动流)→完成态(toast+活动流自动收起+导出启用)→导出菜单(含 PPTX)→明暗切换(外壳暗/内容亮 主客对比)。
  - 踩坑修复：Babel standalone 并行 fetch、src 脚本执行顺序不保证 → 跨文件依赖移进组件体 + 轮询等依赖就位再挂载。
  - 预览：`http://localhost:4180/docs/ClaudeDesign/Jumpx%20Slides/原型/prototype.html`（须经 http，Babel 用 XHR 取 jsx）。
  - bug 修复：选模板/选输出两处预览幻灯片继承了工作台 `.mat .slide{min(60vw,820px)}` 导致溢出 → 在 `.pv-big`/`.vframe` 内限定 `width:100%`；proto.css 链接加时间戳根治开发期缓存。

- **「配方 / Skills 控制器」设计 + 原型（用户可控的 PPT 生成器方向）**：
  - 设计文档 [`SKILL_CONTROLLER.md`](./SKILL_CONTROLLER.md)：三层模型（素材/配方/契约）、为什么"重载很轻"（FilesystemBackend live 读 + progressive disclosure，改 references 下次生成即生效；仅 frontmatter/增删 skill 才需图重载）、可改 vs 锁定边界、保存前契约校验门、改"配方"vs 改"这一份"、多用户副本 + prompt 注入安全、落地 P0/P1/P2。
  - 原型 [`proto-skills.jsx`](docs/ClaudeDesign/Jumpx%20Slides/原型/proto-skills.jsx)：顶栏「配方」入口 → 控制器面板（skill 文件树，可改配方 references vs 🔒锁定契约/机制；右侧 Markdown 编辑/只读；底部 恢复默认/上传/校验/保存并重新加载，模拟"契约体检"成功态 + scope 提示）。已浏览器验证：开面板 / 编辑 / 重载成功 / 锁定文件只读说明。

- **交互原型已发布（Cloudflare，给学员看）**：**https://jumpx-slides-demo.deeptoai.workers.dev**
  - 部署方式：Workers 静态资源（`wrangler deploy`，账号 foreveryh@gmail.com）。配置 [`wrangler.toml`](./wrangler.toml)。
  - 发布版做了**生产化处理**：用 esbuild 把 5 个 jsx 预编译为单个 `bundle.js`（去掉运行时 Babel + XHR，只剩 React 走 CDN），秒开、不依赖 Babel standalone。构建产物在 `demo-dist/`（已 gitignore）。
  - **重新部署**（改了原型后）：
    ```bash
    cd ai-ppt-webapp
    SRC="docs/ClaudeDesign/Jumpx Slides/原型"; rm -rf demo-dist && mkdir demo-dist
    : > demo-dist/bundle.js
    for f in proto-slide proto-screens proto-workbench proto-skills proto-recipe proto-app; do npx esbuild "$SRC/$f.jsx" --jsx=transform >> demo-dist/bundle.js; printf "\n;\n" >> demo-dist/bundle.js; done
    cp "$SRC/proto.css" "$SRC/proto-data.js" demo-dist/   # 注意：index.html 由 demo-dist 内维护
    wrangler deploy
    ```

- **「配方=领域×风格的人格」产品叙事页 + 配方编辑器（已上线）**：顶栏「配方」入口 → [`proto-recipe.jsx`](docs/ClaudeDesign/Jumpx%20Slides/原型/proto-recipe.jsx)。
  - **叙事页(画廊)**：hero「一个配方=一个会写某类 deck 的脑子」+ 公式(领域背景×叙事风格×厚薄)+ 人格卡片(素白/投资复盘风/教学递进/宋代美学,带 选用/编辑/fork/下载)+ 上传配方(.zip)/新建。
  - **编辑器**：简洁旋钮(配方名/背景知识/叙事结构/写作语气/素材吸收/厚薄滑块)+ 进阶 Markdown(复用 SKILL_FILES 文件树,可改 references vs 🔒锁定契约)。
  - **可改边界(已拍板)**：① 叙事 ② 写作语气/风格 ③ 素材吸收 ④ 背景知识(配方自带领域脑子,新增 `references/background.md`)⑤ 厚薄；其余锁定。
  - 已重打包并 `wrangler deploy` 上线(含 proto-skills + proto-recipe),浏览器线上验证通过。
  - 注：开发期 bundle.js 会被浏览器缓存,验证线上请硬刷新或 curl `/bundle.js` 核对。

## 全量实施（git 已 init；branch: feat/phase1-generation-kernel）

- **Phase 1 · 生成内核产品化 — 完成 ✅**
  - `backend/agent.py`:重构出 **`build_agent(recipe_dir, *, checkpointer)` 工厂**(每次生成 fresh 实例化,实测 ~0.02s)+ **`make_local_agent()`**(单机嵌入式,本地 SQLite checkpointer);`agent` 仍给 langgraph dev 用(不传 checkpointer)。
  - 新增 **`confirm_outline` 交互点**(大纲门禁,interrupt_on respond);三交互点 = confirm_outline / choose_template / choose_render_mode。
  - **验证**:嵌入式真模型跑通到 `confirm_outline` 中断(70s/22 msg)、SQLite 落盘;跨进程 resume 见 TECH_SPIKES S2;整本 deck 见阶段3。
  - 小修待办(实施期):校验门按 `validate_slide_plan` 输出判定(补 exit code);workspace root 收窄到"仅 active 配方 + 本次 run"。
- **Phase 2 · 配方系统后端 — 完成 ✅**(commit 89d6aa5)
  - `backend/recipes.py`:配方=skill 目录;`workspace/recipes/` 库 + `_active` + manifest(含 contract_version)。
  - 可改层白名单(02/03/05 + background.md + 12)；`absorb()` 上传**只吸收可改层、锁定层用我们基座、回告被忽略改动**;fork/export_zip/import_zip/validate_recipe/revalidate_all。
  - 验证(无 LLM):导入篡改包→可改层吸收、锁定篡改被忽略+回告;坏配方被 validate 挡下;build_agent 挂 active。
- **Phase 3a · 配方 HTTP API — 完成 ✅**(commit f1995e7)
  - `backend/recipe_api.py`(Starlette,无新依赖):列表/active/单配方 GET-PUT(只写可改层,锁定拒绝并回告)/fork/import(原始 zip 字节)/export/revalidate。
  - 验证(TestClient,无 LLM):全路由通;PUT 写锁定层被拒、可改层写入、契约校验跟跑。
- **Phase 3b-1 · 真 Vite+React 前端 — 完成 ✅**(commit 45a685f)
  - `frontend/app`:Vite+React;原型 `proto-*.jsx` → `src/` ES 模块(Slide/screens/Workbench/Recipe/App + data.js),去 Babel standalone/window 全局。
  - 验证:vite build 干净(36 模块);浏览器实跑 输入页 + 配方页(hero+4卡)渲染正常(:5180)。
- **下一步 · Phase 3b-2/3 · 前端接后端**:① 配方页接 `recipe_api`(list/active/fork/编辑保存,无 LLM 可验);② 生成流接 LangGraph server(messages/updates/files/interrupt → 主舞台模板网格/同页两版/大纲编辑器)。然后 Phase 4 导出(PPTX)/Phase 5 打包。

## 护栏自检
- [x] 未 git commit / push。
- [x] 未硬编码任何 key。
- [x] 未改动 `../jumpx-ppt-slides-skill`（只读引用）。
- [x] 阶段 1 结束已更新本文件，并在决策点停下问用户。
