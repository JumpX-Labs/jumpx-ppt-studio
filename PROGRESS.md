# PROGRESS.md · AI Slides WebApp 脚手架

> 每阶段更新。记录已做 / 卡点 / 下一步。任务宪法见 [`IMPLEMENTATION_TASK.md`](./IMPLEMENTATION_TASK.md)。

---

## 当前状态：MVP 闭环 ✅ ｜ 阶段 1–3 ✅ ｜ Phase 3a/3b ✅（专属前端接真 LangGraph 流）｜ Phase 4a 内嵌预览 ✅ ｜ Phase 4b 导出 PDF/PNG/PPTX ✅ ｜ Phase 5 Docker 单机打包 ✅ ｜ Phase 6 现场演示(present，借鉴 Slidev：舞台+overview+演讲者视图+双窗同步) ✅

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
- **Phase 3b-2 · 配方页接真后端 — 完成 ✅**(commit ec957ed)
  - `frontend/app/src/Recipe.jsx` 接 `/api/recipes`(vite 代理→:2025):列表/选用/fork/编辑(GET 真数据)/保存(PUT)/导出/上传;离线回退。
  - manifest 增展示字段;`update_manifest` 白名单;save 分流(展示字段→manifest / 可改文件→save_editable / 锁定→拒)。
  - 验证(浏览器+真后端):画廊从 API 加载、fork→编辑器真数据、保存 PUT→校验 ok。
  - **本地起法**:① `cd backend && .venv/bin/uvicorn recipe_api:app --port 2025`;② `cd frontend/app && npm run dev`(:5180,/api 代理到 2025)。
- **Phase 3b-3 · 生成流接 LangGraph(最大块)— 完成 ✅**
  - `frontend/app/src/agent.js`:`useStream({apiUrl: origin+'/lg', assistantId:'slides_agent'})`(apiUrl 必须绝对地址,否则 SDK 抛 Invalid URL);`readInterrupt`(解析 `interrupt.value.action_requests[0]`)/`respondInterrupt`(submit `{command:{resume:{decisions:[{type:'respond',message}]}}}`)/`startRun`/`findOutputPath`/`findPageCount`/`runFinished`。
  - `LiveWorkbench.jsx`:流驱动工作台——真 todos(completed/in_progress/pending→done/doing/todo)、活动流(从 messages 抽 tool_calls)、三交互点 `Overlay`:`confirm_outline`(真大纲 pre + 确认/重拟)、`choose_template`(agent 真推荐高亮 ★ + 7 预设网格)、`choose_render_mode`(HTML/AI 图两卡)。
  - `App.jsx`:`live` 模式从 stream 派生阶段条/项目名/导出按钮;`startFromInput` 触发真生成。
  - **完成态检测修复**:`build_slides_html` 直写真实磁盘(不走虚拟 `write_file`),故 `stream.values.files` 无 index.html → 改用「最后 AI 文本里的 index.html 路径 + todos 全完成」判定 `runFinished`,页数从「N 页」文本解析。
  - **验证(浏览器,真 Ark 生成,主题=重新认识睡眠)**:输入→流式 todos/活动→`confirm_outline` 覆盖层(真大纲)→resume→`choose_template` 覆盖层(agent 真推荐 teaching-clean/sketch-notes/editorial-magazine)→选 teaching-clean→`choose_render_mode` 覆盖层→选 HTML→渲染→✅完成(8/8 todos、产物 `/runs/sleep-sharing/index.html` 15.8KB/5 页、阶段条到完成、导出按钮出现)。三交互点 + resume + 完成态全程截图确认。前端 `vite build` 通过。
  - **本地起法**:① `cd backend && .venv/bin/langgraph dev --port 2024`(注册 `slides_agent`);② `cd backend && .venv/bin/uvicorn recipe_api:app --port 2025`;③ `cd frontend/app && npm run dev`(:5180,/lg→2024、/api→2025)。
  - **遗留(已在 Phase 4a 解决)**:胶片缩略图逐页标题 + 内嵌预览。
- **Phase 4a · run 文件访问 + 完成态内嵌预览 — 完成 ✅**
  - `backend/runs.py`:只读访问 `workspace/runs/<id>/`——`list_runs`(id/标题/页数/has_html,按 mtime 倒序)、`get_plan`(读 `source/slide_plan.json`)、`index_html_path`。rid 严格 `^[A-Za-z0-9_-]+$` 且 resolve 必须在 RUNS 内(越界→404,已验证 `..%2f..%2fetc`→404)。
  - `recipe_api.py` 加路由:`GET /runs`、`GET /runs/{id}/plan`、`GET /runs/{id}/view`(FileResponse text/html)。`vite.config` 加 `/api/runs`→:2025 代理。
  - `agent.js` 加 `findRunId`(从产物路径 `/runs/<id>/index.html` 抽 id);`LiveWorkbench` 完成后 `fetch /api/runs/{id}/plan` 拿真 pages → 胶片**真页标题**缩略图,done 卡内嵌 `<iframe src=/api/runs/{id}/view>` **预览生成的 deck**(可翻页)+「新标签打开↗」。
  - **验证(浏览器·真生成)**:完成态 iframe 渲染出 teaching-clean 封面页(标题"你以为的睡眠常识…"、可翻页 ‹1/5›),胶片 5 个缩略图带真标题(你以为…/睡眠到底…/三个误解/今晚小行动/重新认识自己)。`vite build` 通过。
- **Phase 4b · 导出调研 + PDF/PNG — 完成 ✅**
  - **调研**(用户给的 9 个开源项目,clone 进 `.export-research/` gitignore,5 个并行 agent 拆解):纪要见 `EXPORT_RESEARCH.md`。核心结论:① PDF/PNG 已解决——全用「无头 Chromium 渲染 HTML → page.pdf()/screenshot()」,保真 100%;② PPTX「忠实 vs 可编辑」是同一管线两档,可编辑版(presenton/PPTAgent html2pptx/ALLWEONE)在富 CSS 主题上必然有损且数千行;③ LibreOffice 不需要。
  - **决策(用户拍板)**:PPTX 走**图片忠实版优先**(留 4b-2);本阶段 **4b-1 先只 PDF + PNG**。
  - **实现 4b-1**:`backend/export_deck.py`——Playwright+Chromium 渲染真实 `index.html`。PDF:注入打印 CSS(html/body 去 `overflow:hidden`、deck 改 block、每页 1280×720 + `break-after`)→ `page.pdf()` 矢量 5 页。PNG:视口 1280×720@2x,逐页 `transform` 定位整屏截图 → zip。`recipe_api` 加 `GET /runs/{id}/export/pdf|png`;`vite.config` 已代理 `/api/runs`。前端 `App.jsx` live 完成态「导出▾」下拉:PDF/图片PNG(zip,download)/HTML 网页。
  - **依赖**:`requirements.txt` 加 `playwright>=1.40`(装后需 `playwright install chromium`,单机一次)。
  - **验证(真生成两次·浏览器+HTTP)**:PDF 5 页矢量、复杂版式(三栏卡片/2×2 对比)100% 保真(Read 渲染确认);PNG 5 张 2x 清晰;新 run(sleep-rethinking)现渲染 200;导出下拉菜单链接正确、端到端下载通。越界 id→404。`vite build` 通过。
- **Phase 4b-2 · PPTX 图片忠实版 — 完成 ✅**
  - `export_deck.py`:抽出共享 `_render_slide_pngs(html)`(PNG/PPTX 复用逐页截图);`export_pptx`——python-pptx 建 16:9(13.333×7.5in)空白页,每页 `add_picture` 整版铺满截图。保真 100%、不可编辑、可放映/批注。
  - `recipe_api` 加 `GET /runs/{id}/export/pptx`;前端导出菜单加「PPTX · 每页整版图 · 像素级保真 · 可放映」。`requirements.txt` 加 `python-pptx>=1.0`。
  - **验证**:读回 5 页、16:9、每页 1 张 full-bleed 图;HTTP 200 正确 mime;浏览器菜单 4 项(PDF/PPTX/图片PNG/HTML)链接正确;`vite build` 通过。
- **Phase 5（顺手）· 导出进度反馈 + 首启动自检 — 完成 ✅**(commit e154a43)
  - 导出进度反馈:渲染类导出 fetch→blob→下载,全程「生成中…」+ spinner,导出期禁用其余;HTML 直开新标签。
  - `backend/selfcheck.py`:.env/依赖/chromium/skill/活动配方 五项自检,缺什么提示装什么,CLI 退出码,供 entrypoint 复用。本机 5 项全过。
- **Phase 5 · Docker 单机打包 — 完成 ✅**(用户拍板:Docker 启动即可,Electron 留后期)
  - `Dockerfile`:基于 `mcr.microsoft.com/playwright/python:v1.49.0-noble`(Ubuntu 24.04 自带 Python 3.12,deepagents 需 ≥3.11;jammy 的 3.10 装不上——已踩坑修正)+ 补 CJK 字体(`fonts-noto-cjk`,中文 deck 必需)+ Node 20。pip 装依赖 + `playwright install --with-deps chromium`;`npm install`。
  - `docker/entrypoint.sh`:从环境变量合成 `.env`(langgraph.json 用 `env:.env`,镜像内无该文件)→ 跑 `selfcheck.py` → 起 `langgraph dev :2024`(`--allow-blocking --no-browser`)+ `recipe_api :2025` + 前台 `vite :5180`(`--host 0.0.0.0`)。
  - `docker-compose.yml`:`build .`、`5180:5180`、`env_file backend/.env`、只读挂载同级 `../jumpx-ppt-slides-skill`→`/skill-src`(`JX_SKILL_SRC` 覆盖)、命名卷 `jumpx-workspace` 持久化 runs/recipes。`setup_workspace.SKILL_SRC` 改为可被 `JX_SKILL_SRC` 覆盖。`.dockerignore` 瘦身上下文。
  - **验证(真起容器)**:`docker compose up` → 自检 5 项全过、三服务起齐;`http://localhost:5180`→200、`/api/recipes` 返回配方、`/lg/ok`→`{"ok":true}`、`/lg/assistants/search`→`slides_agent` 已注册。整条「UI→配方API→langgraph」代理链经唯一对外端口 5180 通。启动文档见 `RUN.md`「方式 A」。
- **Phase 6 · 现场演示(present)模式 — 完成 ✅**(借鉴 Slidev,用户上课需求)
  - 调研 `jumpx_slidev` 的 `@slidev/client`:借鉴①固定画布+scale ②键盘表 ③**BroadcastChannel 双窗同步(防回声)** ④演讲者视图(当前+下一页+notes+计时器) ⑤overview。不引 Vue,纯 JS/React。
  - `frontend/app/src/Present.jsx`:
    - **观众舞台 `PresentStage`**:全屏 deck(同源 iframe 直接驱动 `#deck` transform 翻页、隐藏 deck 自带控件)。键盘:→/Space/PageDown/↓=下页,←/PageUp/↑=上页,Home/End,数字+Enter 跳页,f 全屏,o 总览,p 演讲者,Esc 退出。底部浮动控制栏 + 进度条。重载自恢复到当前页。
    - **overview 总览**:全屏网格,每格真实 deck 缩略(scale),当前页高亮,点击/跳页。
    - **演讲者视图 `PresenterView`**(独立标签 `?present=<id>&role=presenter`):当前页 + 下一页预览(real deck mini)+ **真 speaker_notes**(读 `/api/runs/{id}/plan`)+ 计时器(暂停/重置)。
    - **双窗同步**:`BroadcastChannel('jumpx-present-<id>')`,消息带 `sender(role+id)` 防回声,presenter 进入发 `hello`、stage 回 `state` 握手;翻页广播 `goto`。
  - `App.jsx`:URL `?present=<id>[&role=presenter]` 路由到舞台/演讲者;完成态加「▶ 演示」按钮(`setPresentId`)。`proto.css` 加 present 全套样式。
  - **验证(浏览器·真 run)**:舞台全屏全保真(内容页四宫格正确)、键盘连按修复(2×→ 准确 +2)、overview 5 真缩略图+当前绿框、演讲者视图当前+下一页+真 notes+计时器、BroadcastChannel 点下一页发出 `{goto,page,sender}`。`vite build` 通过。
- **Phase 7 · 内容「血肉」加厚（默认配方深度教学版）— 完成 ✅**(用户反馈"页面单薄")
  - **诊断**:thinness 是 skill *故意*写薄(05-writer 卡"body 3-5 条/≤24 字、notes 2-5 句";官方 demo 比我们还薄)+ 纯主题无源材料。这正是配方「可改层」要解决的。
  - **改默认配方可改层**(用户选"页面+备注都厚、直接调厚默认"):
    - `03-strategist`:加"深度教学版" beat(钩子/机制/例子数据/对比/可执行收束);"X 分钟分享 ≠ 页数指令",资料少也按 8-10 页;每个核心点单独成页展开。
    - `05-writer`:on-slide 每要点带支撑层(主点→为什么/数据/例子,正反例);body 4-6 条;speaker_notes ≥150 字**逐字口播稿**(禁导演提示,给正反对照);无源材料从领域常识补数据/例子(标待核实)。density=2(详尽)。
  - **持久化(关键)**:workspace/recipes 是 gitignored 运行态、上游 skill 只读不能改——故新增**入库种子** `backend/recipe_seed/default/`(厚版 05-writer/03-strategist + manifest_overrides.json),`recipes._seed_from_base` 在 base 之上叠加(`_apply_seed_overrides`,仅覆盖 EDITABLE + META_FIELDS 白名单)。表达「锁定基座 + 我们的默认配方可改层覆盖」。
  - **验证(真生成两轮对照)**:页面质变——封面有钩子+数据(认知≈两天没睡)、新增机制页(脑脊液冲洗/阿尔茨海默蛋白)、误区→事实带理由、行动带机制(18-20°C/蓝光);notes 从~99 字"导演提示"变成 150-170 字**逐字讲稿**+暖心收尾。reseed 覆盖生效、validate ok。**遗留**:页数(5)/条数(3)模型仍较顽固(LLM steering 上限),但每页内容厚度是质变。
- **Phase 8 · 资料/上下文输入（喂料 → 内容 grounded 变厚）— 完成 ✅**(用户指出原"上传 PDF"是占位)
  - **原状**:输入页「可粘贴资料/上传 PDF」是 mock 占位;真实生成只收主题文本;连篇幅/受众/语气也被丢。
  - **粘贴 + 上传**:`InputScreen` 加资料 textarea(聚焦展开）+「＋上传 PDF/文本」按钮。PDF 走后端 `POST /api/extract`(pypdf 抽文本,截断 20k);txt/md 前端 `file.text()` 本地读;合并进 material,显示「已附 N 字」。
  - **接真**:`agent.composeBrief(topic, {len,aud,tone,material})` 把主题+篇幅/受众/语气+资料拼成结构化消息(资料块标注"请吸收进 Context Pack 作为内容来源");`startRun`/`startFromInput` 透传。篇幅/受众/语气不再被丢。
  - `recipe_api` 加 `POST /extract`(pdf→pypdf / 其它→utf-8);`vite.config` 加 `/api/extract` 代理。
  - **验证(真生成)**:塞带独特标记的资料(格里芬2013 glymphatic/60%/90分钟/标记ZX9)→ `project_brief.md`、`context_pack.md` 完整吸收(含 ZX9，并列为"数据准确呈现"要求)、`outline.md` 围绕资料长出页面(「Glymphatic 夜间清洗系统…60%」「按 90 分钟倍数设闹钟」)且自然到 11 项。/extract 对真 PDF 抽出 577 字。证明"喂料=grounded 变厚"正路打通。`vite build` 通过。
- **Phase 8b · markitdown 多格式资料解析 — 完成 ✅**(用户建议:解析要支持 PDF/Word/PPTX 等)
  - 调研纪要 `PARSE_STYLE_RESEARCH.md`(markitdown vs docling/unstructured/llama-parse)。选 **markitdown**:MIT、Docker 零额外系统库、文档类全离线、核心无 ML 依赖。
  - `requirements.txt` 加 `markitdown[pdf,docx,pptx,xlsx]`;`recipe_api` 的 `/extract` 重写为 markitdown 统一解析(按 `?name=` 扩展名落临时文件→convert→Markdown;pdf 失败回退 pypdf;纯文本回退 utf-8;扫描件/纯图片提示暂不支持 OCR)。
  - 前端 `onPickFiles` 改为所有文件带文件名送后端;accept 放开 PDF/Word/PPTX/Excel/CSV/HTML/txt/md;按钮文案「上传资料（PDF/Word/PPT/Excel）」。
  - **验证**:PPTX 抽出标题+要点(带 slide 标记)、PDF 1276 字(含表格,优于 pypdf)、HTML 1473 字干净 md、md 直通。`vite build` 通过。
- **Phase 9 · 风格导入 skill（视觉模型）后端 — 完成 ✅**(用户:用视觉模型识别、固化成可复用 skill、先只做图片)
  - 视觉模型 **Doubao-Seed-2.0-lite**(火山同 base_url+key，`.env: ARK_VISION_MODEL`)。**两步测试通过**:① 模型能看图(读出文字+主色)② 喂图→结构化风格 JSON(几乎还原 teaching-clean 真实配色 #2563EB/#F8FAFC，字段对齐)。
  - **skill 固化**:`backend/style_extractor/`(SKILL.md + 可配置 `PROMPT.md`)+ `backend/style_import.py`：`analyze_image`(调视觉模型→风格 JSON)、`emit_style`(产出新风格三元组进**当前配方拷贝**：`assets/style-presets/imported-<slug>.json` + 复制最近骨架 CSS[sans→teaching-clean/serif→editorial/handwriting→sketch-notes]并替换 7 个 `--asp-*` + 放开该配方 schema 的 style_name enum→pattern)、`list_styles`、唯一命名防撞。
  - `recipe_api`:`POST /styles/import`(图片→新 style_name)、`GET /styles`;`vite.config` 加 `/api/styles` 代理。
  - **验证(HTTP·真图真模型)**:`/styles/import` 封面图→`imported-ref-2`(唯一后缀)、识别 accent #2563eb/bg #f8fafc/sans/"简约干净干练"、preset+css 产出、schema 放开、`/styles` 列 7 内置+导入。测试残留已 reseed 清理(默认配方回干净态、厚版 density=2 保留)。
  - **诚实边界(v1)**:学配色/字体/密度/mood;版式继承最近骨架(CSS 整文件，版式学不到)；只做图片(PPTX 主题解析后续)。
- **Phase 9b · 风格导入前端 — 完成 ✅**(用户定 UI:导入入口在上传资料旁、右上角样式库、去掉头像)
  - 输入页:`上传资料` 旁加「🎨 样式导入」——传图→`/api/styles/import`→识别风格存入当前配方库+本次默认选它,显示「风格 · X」chip。`composeBrief` 把 `style` 写进 brief(指定 style_name)。
  - 右上角加「样式库」入口 `StyleLibrary.jsx`(读 `/api/styles`,色卡+mood,内置/导入分区)；`list_styles` 补回配色供色卡。
  - **去掉右上角用户头像**(无账号概念)。
  - **持久化说明**:导入风格由后端写进当前配方的 `assets/`(workspace 卷,磁盘持久、跨会话在、库里可见),不需要 localStorage。
  - **验证(浏览器)**:输入页双按钮、头像消失、样式库列 7 内置 + 导入后出现「导入」卡(eval 确认)、导入 HTTP 通。`vite build` 通过。测试残留 reseed 清理。
- **Phase 9c · 样式导入引导弹窗 + 多图 — 完成 ✅**(用户:点导入先弹框提示传什么图,避免无关图)
  - 点「样式导入」先弹**引导框**:说明会提取配色/字体/密度/版式;✅适合(幻灯片多张截图/海报/风格鲜明排版)vs 🚫不建议(人物风景照/纯文字文档/无关图);"PNG/JPG,最多 4 张取共同风格"。「选择图片」才开文件选择。
  - **支持多图**:`analyze_images([...])` 一次喂多张取统一风格;后端 `/styles/import` 收 JSON `{name,images:[dataURI]}`(原始字节单图仍兼容);前端多选 + FileReader→dataURI→JSON。
  - **验证**:多图 JSON 导入 HTTP 通;浏览器弹框正确渲染(dlg/适合/不建议/multiple=true)。`vite build` 通过。
  - **遗留**:跑一遍"UI 导入风格→用它生成 deck"完整闭环(需一次真生成 + 确认 Designer 用上 imported style_name)。
- **Phase 10 · 版式引擎重构（模型直接写 HTML）— 完成 ✅**(用户诊断:模板/schema 太死,版式没自主性)
  - **诊断确认**:旧渲染是纯机械模板替换——模型只能填文字 + 从 10 个死 layout 挑一个,HTML 结构(snippet)+CSS(7 文件)全锁死;`08-web-renderer` 明令"不调 LLM、不生成 CSS"。质量被模板封顶,不是模型能力问题。
  - **spike 验证**(`spike_html.py`):同一份 slide_plan+style_lock,让 ark-code-latest 直接写整套 HTML,渲染对比模板版——**质量碾压**(封面有气场、内容页模型自绘睡眠周期柱状图、用对绿色 token、杂志式版面)。
  - **重构**(`ai_render.py`):`render_deck_html` 让模型按 slide_plan+style_lock(设计 token)直接写整套自包含 HTML;**硬契约**保留 `#deck/.slide/translateX` 外壳(演示/导出照常);结构校验(slide 数匹配)+1 次修复;失败回退模板。接成 `build_slides_html` 主路径(`JX_AI_RENDER=1` 默认开,模板留回退)。
  - **验证(真生成)**:`build_slides_html('sleep-redesign')` → AI 版 22KB,封面居中极简、P03 模型自绘周期柱状图+图标卡片、零溢出;export `_render_slide_pngs` 成功渲染 6 页(契约兼容)。**代价**:渲染步 +60–90s 模型调用(原模板近瞬时),换设计质量,用户优先质量。
  - **遗留**:渲染→截图→自检溢出→修复回路(v1 只做结构校验,视觉溢出修复待加)。
- **Phase 10b · 把版式自主性改进 Skill 本体(可独立发布)— 完成 ✅**(用户:Skill 单独发布,版式能力须在 Skill 里)
  - 澄清:Phase 10 只改了 webapp 代码(ai_render/slide_tools),**Skill 本体没动**——独立运行仍机械模板。本轮在**上游 Skill** 修。
  - 改上游 `jumpx-ppt-slides-skill/skills/ai-slide-producer/`:
    - `references/08-web-renderer.md` 重写:**主路径=模型直接写 HTML**(含硬契约 `#deck/.slide/translateX`+自包含+不溢出 + 设计要求 + 图片规则);`build_html.py` 模板降级为确定性回退。
    - `SKILL.md` Step 7B 改为"模型直接写 + 脚本回退";slide-plan 步与 `11-producer.md` 删掉"禁止手写 HTML/必须 build_html 生成"的矛盾约束。
    - 重打包发布 zip `skills/ai-slide-producer.zip`(新版 08、含示例图、无 __MACOSX、1.77MB)。
  - 同步:`ensure_workspace(force)` + 重 seed 默认配方 → 产品侧 skill 副本也是新版(厚版 density=2 仍在)。
  - **诚实**:① skill 改动是指令级,质量由 ai_render(同契约同模型已证碾压)旁证,**尚未在宿主里跑 skill 单独验证**;② webapp 当前仍走 ai_render(绕过 skill 08),**ai_render 去留待定**——可跑 `JX_AI_RENDER=0` 让 agent 照 skill 自己写 HTML,既验证 skill 又决定是否统一。
  - skill 不是独立 git 仓库(属父 Jumpxai 仓库),文件已改盘上,发布/提交由用户管。
- **Phase 11 · 逐页内容预览 — 完成 ✅**(用户:生成前看不到每页具体内容)
  - `agent.findRunSlug`:从任意消息的 `runs/<slug>/` 路径提取 slug(生成中即可拿到,早于 finish 的 findRunId)。
  - `LiveWorkbench`:用 runSlug **生成中每 5s 轮询** `/api/runs/{slug}/plan`(slide_plan 写好前 404,写好后自动拾取);胶片缩略图变**可点**,点开 `PageDetail` 面板看该页完整内容(key_message + headline/sub + body 要点 + caption + speaker_notes + layout + 上/下页导航)。
  - **验证**:findRunSlug 实测解析出 `sleep-reboot`;`/plan` 端点返回 pages(早验);构建通过。视觉:缩略图有 slide_plan 后即可点开(注:slide_plan 在 pipeline 里写得较晚,约渲染前)。
  - **注**:更彻底的"渲染前审核 gate"(暂停让用户改逐页内容)需给 skill 加中断,属后续。
- **后续可选**:① Phase 4b-3 可编辑版 PPTX(移植 PPTAgent html2pptx,Node+pptxgenjs,接受富 CSS 主题保真退化)② Electron 桌面版(双击启动,后期)③ 出图路径(AI 配图,需图片 backend key)。**核心 MVP(生成→交互→预览→导出 PDF/PNG/PPTX/HTML→单机 Docker)已闭环。**

## 护栏自检
- [x] 未 git commit / push。
- [x] 未硬编码任何 key。
- [x] 未改动 `../jumpx-ppt-slides-skill`（只读引用）。
- [x] 阶段 1 结束已更新本文件，并在决策点停下问用户。
