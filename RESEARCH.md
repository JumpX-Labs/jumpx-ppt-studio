# RESEARCH.md · deepagents 生态调研（阶段 1 产出）

> 日期：2026-05-31。目标：把 `deepagents` / `deep-agents-ui` / human-in-the-loop / 流式 的**确切做法 + 出处**查清，标注与本项目（AI Slides WebApp）需求的对应关系。
> 标注约定：**[已验证]** = 来自官方 docs / 官方仓库源码；**[推测]** = 二手源或推断，落地需复核。
> 版本基线：**deepagents 0.6.7**（2026-05-30 PyPI 最新）。

---

## 0. 一句话结论（给后续的人）

我们要的形态——「网页输入主题 → agent 自主规划(todo)、流式跑 → 在两个岔路口停下问用户 → 产出可见 slides」——**deepagents + deep-agents-ui 开箱即可支撑，几乎不用自己写中断 UI**：

- agent loop / planning(todo) / 虚拟文件系统 / skills / 子 agent → `create_deep_agent(...)` 全自带。
- 两个交互点（选模板 / 出图vsHTML）→ 用 deepagents 的 `interrupt_on` +「询问型 tool」实现，前端复用 deep-agents-ui 现成的 `ToolApprovalInterrupt` 审批面板。
- 跑成后端 → `langgraph dev`（默认 **:2024**）；前端 deep-agents-ui（**:3000**，yarn，Node 20）在 UI 设置框里填 `http://127.0.0.1:2024` + assistant id 即可连上。

**唯一真实落地卡点**：我们的 skill 带 Python 脚本（`build_html.py` 等），需要一个**能跑 shell 的 backend**（`LocalShellBackend` / 沙箱），`StateBackend` 不能执行脚本。见 §3.3 与「卡点清单」。

---

## 1. create_deep_agent / 挂 tools / 挂 skills（阶段 3 核心）

### 1.1 创建 agent — `create_deep_agent(...)` [已验证]

函数名**未改名**，定义在 `deepagents/graph.py`。真实签名（节选关键参数）：

```python
def create_deep_agent(
    model: str | BaseChatModel | None = None,
    tools: Sequence[BaseTool | Callable | dict] | None = None,
    *,
    system_prompt: str | SystemMessage | None = None,   # ← 旧版叫 instructions，已改名
    middleware: Sequence[AgentMiddleware] = (),
    subagents: Sequence[SubAgent | ...] | None = None,
    skills: list[str] | None = None,                    # ← skill 源路径列表
    memory: list[str] | None = None,
    backend: BackendProtocol | BackendFactory | None = None,
    interrupt_on: dict[str, bool | InterruptOnConfig] | None = None,  # ← HITL
    checkpointer: Checkpointer | None = None,           # ← interrupt 必需
    state_schema: type[DeepAgentState] | None = None,
    ...
) -> CompiledStateGraph: ...
```

最小示例：
```python
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",   # provider:model 字符串
    tools=[my_tool],
    system_prompt="You are a slide production agent.",
)
```

**关键注意**：
- 参数是 `system_prompt`（不是旧的 `instructions`）。
- `model=None` 默认值自 0.5.3 起**已废弃**，1.0.0 会移除 → **始终显式传 model**。
- 默认自带工具：`write_todos`、`ls/read_file/write_file/edit_file/glob/grep`、`execute`（shell，需 backend 支持）、`task`（调 subagent）。
- 出处：`graph.py` 源码 · https://docs.langchain.com/oss/python/deepagents/overview

### 1.2 挂自定义 tools [已验证]

`tools` 接受普通 Python 函数（docstring 即工具描述）或 LangChain `@tool`，也接受 MCP tool dict：
```python
def get_weather(city: str) -> str:
    """Get weather for a given city."""   # docstring 必写，是工具描述
    return f"Sunny in {city}"

agent = create_deep_agent(model="anthropic:claude-sonnet-4-6", tools=[get_weather])
```
需要更细控制（尤其配 HITL）时用 `@tool`。

### 1.3 挂 skills（我们要挂 ai-slide-producer）[已验证]

机制叫 **progressive disclosure（渐进披露）**：启动时只读各 SKILL.md frontmatter（`name`+`description`）注入 system prompt；用户 prompt 匹配某 skill description 时，agent 才 `read_file` 读完整 SKILL.md，再按指引访问脚本/资产。

- **SKILL.md frontmatter**：必填 `name` + `description`（≤1024 字符，写清"何时用"，是唯一匹配依据，无 embedding）。可选 `license` / `metadata` / `allowed-tools` / `module`。
  → 我们现有 `ai-slide-producer/SKILL.md` 的 frontmatter 已满足（`name` + 含触发词的 `description`）。✅
- **目录布局**：`skills/<skill-name>/SKILL.md` + 附带 scripts/assets。**硬要求：任何附带资源必须在 SKILL.md 里被引用并说明用法**，否则 agent 不会发现。
  → 我们的 SKILL.md 已逐个引用 references/schemas/scripts/assets，符合。✅
- **怎么传给 agent**：`skills: list[str]` 接收 **skill 根目录路径列表**（相对 backend root，正斜杠）。skill 文件要先放进 backend 文件系统。官方示例（StateBackend + 把文件塞进 `files`）：
  ```python
  from deepagents.backends import StateBackend
  from deepagents.backends.utils import create_file_data

  backend = StateBackend()
  skills_files = {
      "/skills/ai-slide-producer/SKILL.md": create_file_data(skill_md),
      "/skills/ai-slide-producer/scripts/build_html.py": create_file_data(script),
      # ... 把整个 skill 目录注入
  }
  agent = create_deep_agent(
      model="anthropic:claude-sonnet-4-6",
      backend=backend,
      skills=["/skills/"],            # 指向 skills 根
      checkpointer=MemorySaver(),
  )
  agent.invoke({"messages": [...], "files": skills_files},
               config={"configurable": {"thread_id": "..."}})
  ```
- **deepagents-cli 约定**（备选）：从磁盘目录自动加载 skill，按优先级合并 `~/.deepagents/agent/skills/`、`.deepagents/skills/`、`.agents/skills/` 等五处。我们做 WebApp 用核心 `deepagents` 即可，CLI 仅作加载约定参考。
- 出处：https://docs.langchain.com/oss/python/deepagents/skills · 真实示例 https://github.com/langchain-ai/deepagents/tree/main/libs/cli/examples/skills

> **⚠️ 与本项目对应（关键卡点）**：我们的 skill 要跑 Python 脚本（`build_html.py` / `validate_*.py` / `probe_image_backend.py` / 出图脚本）。`StateBackend` **不能执行 shell**；需要 `LocalShellBackend`（本地无限制 shell）或沙箱后端，`execute` 工具才能跑脚本。阶段 3 必须解决 backend 选型。

---

## 2. 跑成 LangGraph server + model 选型

### 2.1 langgraph.json + 启动 [已验证 / 端口部分推测]

```json
{
  "dependencies": ["."],
  "graphs": {
    "slides_agent": "./agent.py:agent"
  },
  "env": ".env"
}
```
- `"<graph_id>": "./<file>:<variable>"` 指向 `create_deep_agent(...)` 返回的变量。
- 启动：`pip install "langgraph-cli[inmem]"` → `langgraph dev`。
- **默认端口 :2024** [推测但通行]：`langgraph dev`（in-memory 开发模式）默认 2024；8123 是 Docker 容器（`langgraph up`）对外口。**以终端实际输出为准**。
- `graph_id`（这里 `slides_agent`）就是前端要填的 **assistant id**。
- 出处：https://docs.langchain.com/oss/python/deepagents/going-to-production

### 2.2 model 包 + 环境变量 [已验证]

| Provider | 安装包 | model 字符串 | 环境变量 |
|---|---|---|---|
| **Anthropic (Claude)** | `langchain-anthropic`（deepagents 已自带） | `anthropic:claude-sonnet-4-6` | `ANTHROPIC_API_KEY` |
| OpenAI (GPT) | `langchain-openai`（需另装） | `openai:gpt-5.5` | `OPENAI_API_KEY` |
| Google (Gemini) | `langchain-google-genai`（deepagents 已自带） | `google_genai:gemini-3.5-flash` | `GOOGLE_API_KEY` |

- **deepagents 核心依赖已自带 `langchain-anthropic` 和 `langchain-google-genai`** → 用 Claude / Gemini 开箱即用；用 OpenAI 才需另装。
- 出处：https://docs.langchain.com/oss/python/deepagents/overview · pyproject.toml

### 2.3 版本 / 依赖要求 [已验证]
- deepagents **0.6.7**；Python **>=3.11,<4.0**（3.11–3.14）。
- 核心 pin：`langchain-core>=1.4.0`、`langchain>=1.3.2`、`langchain-anthropic>=1.4.3`、`langchain-google-genai>=4.2.2`、`langsmith>=0.8.3`。
- langgraph 经 `langchain` 传递引入；要直接用 `Command`/`interrupt`/checkpointer 可显式 `pip install langgraph`。
- 出处：https://github.com/langchain-ai/deepagents/blob/main/libs/deepagents/pyproject.toml

---

## 3. deep-agents-ui（前端，阶段 2 必用）[已验证]

### 3.1 装 + 跑
```bash
git clone https://github.com/langchain-ai/deep-agents-ui.git
cd deep-agents-ui
nvm use 20          # .nvmrc = 20
yarn install        # packageManager 锁 yarn@1.22.22（Yarn Classic）
yarn dev            # next dev --turbopack → http://localhost:3000
```
- 栈：Next.js ^16、React 19、`@langchain/langgraph-sdk ^1.0.3`。
- 默认端口 **3000**（README 明示）。

### 3.2 怎么连后端（重要：不是用 .env！）
- **没有 `.env.example`，也没有 URL/assistant 的 env 变量**。连接配置在 **UI 设置弹框**里填，存 `localStorage["deep-agent-config"]`：
  - **Deployment URL**：`http://127.0.0.1:2024`（langgraph dev 地址）
  - **Assistant ID**：`langgraph.json` 里的 graph key（我们用 `slides_agent`）
  - **LangSmith API Key**：本地纯跑**可留空**；仅连云端部署时需要。
- 全代码库唯一 env 变量是 `NEXT_PUBLIC_LANGSMITH_API_KEY`（可选）。
- 后端默认连 **:2024**（不是 8123）。
- **[推测]** 要无人值守/脚本化预填，需自己预置 `localStorage` 或给 UI 加 env 预填——本轮不需要，手动填即可。

### 3.3 它怎么渲染 plan/todo 与流式
- 用官方 `useStream` React hook（`@langchain/langgraph-sdk/react`），**不自造协议**。直接读 graph state 顶层 key：
  - `todos`（来自 deepagents `write_todos`，`{id, content, status}`）→ 渲染计划/todo 侧栏。
  - `files`（`Record<path,content>` 虚拟文件系统）→ 文件侧栏，可点开看。
  - `messages` → 聊天 + 流式 token。
  - `stream.interrupt` → 中断；`ToolApprovalInterrupt.tsx` 渲染审批面板。
- **后端 graph state 必须暴露这些 key 才能正确渲染**——deepagents 默认 state 正好是 `messages` / `todos` / `files`，天然匹配，所以官方说直接连 deepagents 例子即可。
- 出处：`src/app/hooks/useChat.ts`、`src/lib/config.ts`、`src/providers/ClientProvider.tsx`、README。

### 3.4 仓库状态
- **活跃**，未改名未被合并；最后 push 2026-05-14。独立的官方 "Custom UI for Deep Agents"。

---

## 4. Human-in-the-loop 中断（两个交互点的关键）

### 4.1 底座：LangGraph `interrupt()` + `Command(resume=...)` [已验证]
- node/tool 内 `interrupt(payload)` → 图暂停、payload 落持久层、控制权交还；输出里有 `__interrupt__`。
- `Command(resume=value)` 重新 invoke **同一 thread_id** → `value` 成为 `interrupt()` 返回值，从该 node 继续。`resume` 可传任意 JSON（dict/list）。
- **关键坑：resume 会从 node 开头整段重跑**，不是从 `interrupt()` 那行续。→ **`interrupt()` 之前不要放非幂等副作用**（别在问"出图还是HTML"前就调了出图/渲染 API）。
- 出处：https://docs.langchain.com/oss/python/langgraph/interrupts

### 4.2 deepagents 高层封装：`interrupt_on`（推荐用这个）[已验证]
```python
agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    tools=[choose_template, choose_render_mode],
    interrupt_on={
        "choose_template":     {"allowed_decisions": ["respond"]},
        "choose_render_mode":  {"allowed_decisions": ["respond"]},
    },
    checkpointer=checkpointer,   # 必需
)
```
- 每个 tool 取值：`True`（4 决策全开）/ `False`（自动执行）/ `{"allowed_decisions":[...]}`。
- 4 种决策：`approve`（原参执行）/ `edit`（改参再执行）/ `reject`（跳过）/ **`respond`（把人话当 tool 结果返回，不执行——最适合"问用户"型 tool）**。
- resume payload：`Command(resume={"decisions": [{"type":"respond","args":...}, ...]})`，多中断打包，`decisions` **顺序对齐** action_requests。
- **已知 bug（Issue #554）**：subagent 内用 `interrupt_on` 时 `edit`/`reject` 可能失效，`approve`/`respond` 可靠 → 两个选择点建议在**主 agent 层**触发，且用 `respond`。
- 出处：https://docs.langchain.com/oss/python/deepagents/human-in-the-loop · Issue #554

### 4.3 前端怎么接（deep-agents-ui 已做好）[已验证]
- 链路：agent interrupt → `useChat` → `ToolApprovalInterrupt` UI → 用户决策 → `resumeInterrupt()`（`command.resume`）→ stream 继续。
- **直接用 deepagents 的 `interrupt_on`，deep-agents-ui 这套审批 UI 开箱即用**，本轮可不写自定义中断 UI。
- 出处：https://deepwiki.com/langchain-ai/deep-agents-ui · https://docs.langchain.com/langgraph-platform/use-stream-react

---

## 5. 流式协议 [已验证]

LangGraph SDK `stream_mode` 与 UI 三件事的对应：

| mode | 推什么 | 用途 |
|---|---|---|
| `values` | 每 node 跑完的完整 state 快照 | 调试 |
| **`updates`** | node 名 + state 增量 | **todo 更新 / 状态推进 / tool 调用** |
| **`messages`** | LLM token 级输出 | **聊天打字机增量** |
| `custom` | stream writer 自定义事件 | 长任务进度 |
| `debug` | 全量 trace | 仅开发 |

- 增量 token → `messages`；todo/状态/tool → `updates`。deep-agents-ui 经 `useStream` 同时消费两者。
- 新代码建议 `version="v2"`（统一 chunk 格式，按 `chunk["type"]` 过滤）。
- 出处：https://docs.langchain.com/oss/python/langgraph/streaming

---

## 6. checkpointer / 持久化 [已验证]
- **interrupt 的前提**：必须有 checkpointer，否则无法暂停/恢复。
- **`langgraph dev` 自动提供** checkpointer（平台托管）——此时**不要**自己传 `checkpointer=`，否则报错"persistence is handled automatically … please remove"。
- 限制：`langgraph dev` 本地 runtime 是**内存型**，server 重启 thread 状态全丢（Issue #5790）。本地开发够用；要跨重启需 `POSTGRES_URI`。
- **两种写法别混**：脚本/嵌入式 `graph.compile(checkpointer=InMemorySaver())` 自己 invoke → 自己传；`langgraph dev` 托管 → 不传。
- 出处：https://docs.langchain.com/oss/python/langgraph/persistence · langgraph#5790

---

## 7. 部署调研（供下一轮，本轮不做）
- 本地：`langgraph dev`（内存，单机，:2024）。
- 生产：`langgraph.json` 同一份；走 LangGraph Platform / 自托管（Docker `langgraph up`，:8123），需持久 checkpointer（`POSTGRES_URI`）。
- 前端 deep-agents-ui 可部署 Next.js（Vercel 等），Deployment URL 指向部署后的 LangGraph endpoint，并需 LangSmith key 走认证。
- 详细部署流程留下一轮验证。出处：https://docs.langchain.com/oss/python/deepagents/going-to-production

---

## 8. 我们两个交互点的推荐实现路径

**路径 A（推荐，最省力）**：deepagents `interrupt_on` + 「询问型 tool」
1. 定义两个轻量 tool：`choose_template(options)`、`choose_render_mode(options)`，本身不干活，只承载"问用户"。
2. `interrupt_on={"choose_template":{"allowed_decisions":["respond"]}, "choose_render_mode":{"allowed_decisions":["respond"]}}`。
3. agent 跑到该步调 tool → 自动中断 → deep-agents-ui `ToolApprovalInterrupt` 弹面板 → 用户选 → `respond` 回灌 → 继续。
4. 在**主 agent 层**触发，避开 subagent edit/reject bug。

**路径 B（更可控，本轮不必）**：自定义 node 内裸 `interrupt()` + `Command(goto=...)` 路由到出图/HTML 分支，前端按 `interrupt.value.kind` 自渲染。中断 UI 要自己写。

> 本轮按 **路径 A** 跑通；遇到 A 的局限再退 B。

---

## 9. 待用户确认（§5 决策点，已在 PROGRESS 记录，阶段 2 前需拍板）
1. **model**：Claude / GPT / Gemini？（决定包与 key）
2. **API keys**：model key + 图片生成 backend key（出图路径需要）。
3. 两个交互点**默认值**（无人选时默认哪套模板 / 默认出图还是 HTML）。
4. UI 直接用官方 deep-agents-ui（本轮建议直接用）。

---

## 来源汇总
**deepagents**：
- https://docs.langchain.com/oss/python/deepagents/overview
- https://docs.langchain.com/oss/python/deepagents/skills
- https://docs.langchain.com/oss/python/deepagents/human-in-the-loop
- https://docs.langchain.com/oss/python/deepagents/going-to-production
- https://github.com/langchain-ai/deepagents（`graph.py` / `pyproject.toml` / `libs/cli/examples/skills`）
- https://github.com/langchain-ai/deepagents/issues/554

**deep-agents-ui**：
- https://github.com/langchain-ai/deep-agents-ui（README / package.json / .nvmrc / src）
- https://deepwiki.com/langchain-ai/deep-agents-ui

**LangGraph**：
- https://docs.langchain.com/oss/python/langgraph/interrupts
- https://docs.langchain.com/oss/python/langgraph/streaming
- https://docs.langchain.com/oss/python/langgraph/persistence
- https://docs.langchain.com/langgraph-platform/use-stream-react
- https://github.com/langchain-ai/langgraph/issues/5790
