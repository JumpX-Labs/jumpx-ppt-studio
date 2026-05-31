# RUN.md · 怎么本地启动

> 本地跑通 AI Slides WebApp 脚手架（阶段 2：hello-world deep agent + 官方 UI）。
> 架构：`deep-agents-ui`(前端) → `langgraph dev`(后端 LangGraph server) → `deepagents` agent → 火山引擎方舟 model。

---

## 0. 一次性准备

**环境要求**：Python ≥3.11（实测 3.12.13）、Node ≥20（实测 22 可用）、yarn 1.x。

**密钥**：`backend/.env` 已配火山引擎方舟（Ark，OpenAI 兼容）。`.env` 已被 `.gitignore` 拦截，勿提交。
```
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3
ARK_API_KEY=ark-...        # 真实 key 在 .env，模板见 .env.example
ARK_MODEL=ark-code-latest
```

---

## 1. 后端（LangGraph server）

```bash
cd backend
python3 -m venv .venv                      # 首次
.venv/bin/pip install -r requirements.txt  # 首次
.venv/bin/langgraph dev --no-browser --port 2024
```
- 起在 **http://127.0.0.1:2024**（健康检查 `curl http://127.0.0.1:2024/ok` → `{"ok":true}`）。
- graph id = **`slides_agent`**（见 `langgraph.json`），即前端要填的 Assistant ID。
- API 文档：http://127.0.0.1:2024/docs

## 2. 前端（deep-agents-ui）

```bash
cd ui
yarn install        # 首次
yarn dev            # 默认 :3000；被占用会自动跳 :3002
```
- 打开浏览器 → http://localhost:3000（或终端提示的实际端口）。
- **首次会弹 Configuration 框，填**：
  - **Deployment URL**：`http://127.0.0.1:2024`
  - **Assistant ID**：`slides_agent`
  - **LangSmith API Key**：留空（本地不需要）
  - 点 **Save**。配置存浏览器 localStorage（key: `deep-agent-config`），下次免填。

## 3. 用法：做一份 slides（阶段 3）

在输入框发一个主题，例如：
> 帮我做一份 4 页的分享 slides，主题：远程工作的三个高效习惯，受众是刚开始远程办公的同事。

会看到：
1. agent 用 `write_todos` 列计划，`read_file` 读挂载的 ai-slide-producer skill（SKILL.md/references/schema）。
2. 跑到**交互点①「选模板」**：弹出审批面板（`choose_template`，附推荐 preset + 理由）。
   - 点 **Approve** = 接受默认 `teaching-clean`；或在消息框输入选择（如 `editorial-magazine`）后发送（respond）。
3. skill 的对话式 gate（如确认大纲）会以普通消息停下，回复"OK，继续"即可推进。
4. 跑到**交互点②「出图 / HTML」**：弹出审批面板（`choose_render_mode`）。Approve = 默认 HTML。
5. agent 调 `build_slides_html` 生成 deck，给出路径 `/runs/<slug>/index.html`。

**产物位置**（真实磁盘）：`backend/workspace/runs/<slug>/`
- `source/`：project_brief.md、context_pack.md、outline.md、slide_plan.json、style_lock.json 等中间产物。
- `index.html`：可直接在浏览器打开的幻灯片（16:9，键盘 ←→ 翻页）。

打开成品：`open backend/workspace/runs/<slug>/index.html`

### 架构速记（为什么不用 shell）
LangGraph 后端本身是 Python：skill 作为**纯知识/资产**挂载（`FilesystemBackend` + `skills=`），
而"生成 HTML / 调出图 API"等执行职责上移为 web 层工具（`backend/slide_tools.py`），
进程内运行、不让 agent shell out、密钥只留后端。详见 [`PROGRESS.md`](./PROGRESS.md) 阶段 3。

## 3b. 纯 hello-world 冒烟（可选，验证底座）
把 `backend/langgraph.json` 的 graph 指回一个最小 agent 即可；当前 `agent.py` 已是 slides agent。

---

## 常见问题

- **端口 3000 被占**：UI 自动跳到 3002/3003 等，以终端输出为准，连接配置不变。
- **UI 连不上后端**：确认后端在 2024、Deployment URL 填的是 `http://127.0.0.1:2024`（不是 8123）。
- **重启丢历史**：`langgraph dev` 是内存型 runtime，重启后 thread 清空（本地开发正常）。
- **改了 agent.py**：`langgraph dev` 自带热重载，存盘即生效。

---

## 不依赖 UI 的纯后端验证（脚本）

```bash
cd backend
.venv/bin/python - <<'PY'
from langgraph_sdk import get_sync_client
c = get_sync_client(url='http://127.0.0.1:2024')
th = c.threads.create()
for ch in c.runs.stream(th['thread_id'], 'slides_agent',
        input={'messages':[{'role':'user','content':'用一句话介绍杭州'}]},
        stream_mode=['updates','messages']):
    print(ch.event)
PY
```
能看到 `messages/partial`（token 流）、`updates`（含 todos）即正常。
