# UX_DESIGN.md · AI Slides WebApp 专属交互设计方案

> 2026-05-31。基于对 Gamma / Beautiful.ai / Tome / Genspark / Manus / Devin / AiPPT.cn / 讯飞智文 / MindShow / ChatPPT / 百度文库 / Kimi 等 12+ 产品的交互设计调研，结合我们已有的 deepagents 架构，提出**专属于"agent 驱动的 AI 幻灯片生产"场景**的 UI/UX 设计。
> 标注：【证据】= 调研有据；【设计判断】= 据证据推导的我们的取舍。来源见文末。

---

## 0. 核心论点（一句话）

**对"AI 做幻灯片"，纯聊天框是结构性错配；正确形态是「画布为主、agent 为副驾」+「关键岔路口用富交互卡片而非打字」+「逐页流式浮现而非黑盒等待」。**

幻灯片是**强视觉、空间化、多页、可并行编辑**的产物，而聊天是**线性、文本、单线程**的容器——二者天然不匹配【证据：arXiv 2508.19227，生成式 UI 对照纯聊天总体胜率 84%，信息密集场景 78.5% 用户更偏好】。

> **我们当前的最大短板**：deep-agents-ui 把两个交互点（选模板 / 出图vsHTML）渲染成「展示 tool 的 JSON 参数 + Approve/Reject/Edit」。这同时踩中两个被研究点名的反模式：①「富展示 ≠ 真交互」——给你看漂亮卡片却还要打字下命令；②「结构化选择靠自由文本」——输入熵高、易歧义。**这恰恰是 AI PPT 产品最该做专属 UI 的地方。**

---

## 1. 调研收敛出的跨产品共识（精炼）

| 共识 | 证据来源 | 对我们的意义 |
|---|---|---|
| **「先确认大纲再渲染」是近乎统一的范式**，中文产品尤其（AiPPT/讯飞/Kimi/百度/WPS/MindShow 全有；豆包/Manus 例外） | 全部中文产品官方流程【证据】 | 我们的 skill 已有 outline gate，但现在以纯聊天消息呈现——应升级为**大纲编辑器** |
| **模板选择是强交互点，常"两次接触"**：生成前选风格 + 生成后一键换肤（不动内容） | AiPPT/讯飞/MindShow/百度【证据】 | 我们的 `choose_template` 应是**缩略图网格选择器**，且换肤要做成低风险可逆操作 |
| **结构优先于样式**（low-fi outline → hi-fi design），破解"首次输出彩票" | Beautiful.ai/Gamma/SlidesGPT【证据】 | 我们的管线 intake→outline→plan→design→render 天然契合，要在 UI 上显式分两段 |
| **agent 过程用 todo 清单可视化最佳**（安心又不啰嗦），思考流/产物流做可展开二级面板 | Manus todo.md / Devin Planner / Claude Code【证据】 | deep-agents-ui 已有 todo 面板，方向对，要保留并强化 |
| **HITL 按风险分级**：高分叉低可逆才停，approve/edit/reject/respond 各有适用 | LangChain HITL / Smashing / Permit.io【证据】 | 我们两个硬交互点正是"高分叉低可逆"，该停；中间步骤用 edit 而非 approve |
| **逐页流式浮现 > spinner**，焦点放"输出进度"非"等待时长"；>10s 给进度条 | NN/g / 流式 AI 实践【证据】 | 生成阶段做**缩略图骨架屏→逐页填充**，而非转圈 |
| **中文用户：PPTX 是刚需**，在线播放仅补充；"改一页不串其他页"是普遍痛点 | 全部中文产品【证据】 | 我们目前只产 HTML——**PPTX 导出是后续硬缺口**；局部重生要保证页间隔离 |
| **渐进式信任**：新手走全程、老手可跳过；智能默认覆盖 90% 决策 | NN/g 渐进式披露 / ChatGPT 默认【证据】 | 记住老用户的模板/输出偏好，硬交互点可折叠为"沿用上次（点此改）" |

**值得抄的具体微交互**：
- Gamma「Try new layout」：一次给约 5 个布局变体，**带你自己内容的实时预览，挑一个应用**【证据】——局部重生的黄金范式。
- Beautiful.ai「Slide AI」：局部编辑**克制可逆**，有开关控制"只改布局 / 可改文案"【证据】——破解"我只想换布局它却重写我文案"。
- Tome：把"逐页手选 vs 全自动"做成**显式岔路口选择**【证据】——几乎就是我们"在岔路口问用户"的原型。
- Genspark：聊天末尾给**一键执行的建议气泡**，无需打字【证据】。

**要避免**：黑盒等待（三家西方产品普遍无逐页流式，是我们的差异化机会）；约束式模板锁死手动微调；Tome 式私有格式导致不能导 PPTX。

---

## 2. 我们产品的专属设计：把管线映射成 UI 状态

我们的管线（skill 九步）+ 两个硬交互点 + skill 自带 gate，应收敛成 **4 个富交互触点 + 全程可见的流式**，而不是现在观察到的"对话式停 5 次"。

```
输入(多入口卡片) → [触点①大纲编辑器] → [触点②模板网格] → 自动 plan/review
                                                          → [触点③出图vsHTML卡片]
                                                          → 流式逐页渲染(可见/可停)
                                                          → [触点④交付:预览+逐页重生+导出]
```

> 设计判断：把 skill 的「brief 确认」并入输入页（推断的 brief 用可编辑 chip 呈现，一键确认）；把「style lock 确认」并入模板选择（选模板=选风格）。**净效果：5 次对话式停 → 4 个有视觉、可一键的触点。**

### 布局：画布为主、agent 为副驾（canvas-first）

```
┌──────────────────────────────────────────────────────────────┐
│  顶栏: 项目名   ·   阶段进度条(intake→outline→design→render→done)  │
├───────────┬──────────────────────────────────────┬───────────┤
│           │                                      │           │
│ 缩略图轨   │         主舞台 (live preview)          │ Agent 副驾 │
│ (每页)     │   ·当前页大图，所见即所得              │ ·plan/todo │
│ ·骨架→填充 │   ·渲染时逐页浮现                      │  三态清单  │
│ ·hover 出  │   ·点缩略图跳转，键盘←→翻页            │ ·对话框    │
│  "重做这页"│                                      │ ·"在干什么"│
│           │                                      │  可展开    │
├───────────┴──────────────────────────────────────┴───────────┤
│  触点出现时：富交互卡片**就地浮现在主舞台**（非突兀弹窗，像 agent 递来的一步）│
└──────────────────────────────────────────────────────────────┘
```
依据：Artifacts/Canvas 双栏是"rich output 的黄金标准"，对幻灯片更应反转层级让画布当主角【证据】；agent 面板能"看到整个画布"（Gamma 3.0）【证据】。

---

## 3. 四个触点的专属设计（核心）

### 触点① 大纲编辑器（替代 skill 的 outline 对话 gate）

```
┌─ 主舞台：左大纲树 / 右线框预览 ───────────────────────┐
│  ┌─大纲(可编辑,支持Markdown)─┐  ┌─线框预览(low-fi)──┐ │
│  │ # 远程工作的三个高效习惯   │  │ [封面]            │ │
│  │ ## 习惯一：固定仪式       │  │ [要点页]          │ │
│  │   - 启动/关闭工作         │  │ [对比页]          │ │
│  │ ## 习惯二&三：异步+时间盒  │  │ [总结页]          │ │
│  │ ## 今天就开始             │  │                   │ │
│  └───────────────────────┘  └──────────────────┘ │
│  hover 章节出 [+添加] [删除] [↑↓调序]                  │
│  右下角: [💬 让 AI 改大纲]   [✓ 确认大纲，继续 →]       │
└──────────────────────────────────────────────────┘
```
- **可就地编辑**（增删章节、调层级、Markdown 整段重写），右侧线框实时同步【证据：MindShow 左大纲/右预览；AiPPT 5 级层级增删】。
- **配 AI 改大纲**（一句话"把习惯二三拆成两页"→大纲实时更新），补上 Gamma 在 outline 阶段没助手的缺口【证据】。
- 用 **Edit 协作**而非 Approve/Reject——结构性内容适合就地改【设计判断，依据 HITL 分级】。
- 引导话术借鉴 Gamma：「现在改大纲便宜，渲染成页后再改贵」。

### 触点② 模板网格选择器（替代 `choose_template` 的 JSON 面板）

```
┌─ 主舞台：选一套视觉模板 ───────────────────────────────┐
│  AI 推荐(基于你的主题)：teaching-clean ✓ / sketch-notes / corporate │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │
│  │[封面缩略]│ │[封面缩略]│ │[封面缩略]│ │[封面缩略]│  …7套   │
│  │teaching │ │editorial│ │ swiss   │ │corporate│         │
│  │-clean ✓ │ │-magazine│ │-system  │ │         │         │
│  └────────┘ └────────┘ └────────┘ └────────┘         │
│  ★ 每个缩略图用**你自己的封面内容**实时渲染(不是占位图)      │
│  [✓ 用 teaching-clean]   (默认已选，可一键沿用)           │
└──────────────────────────────────────────────────────┘
```
- **缩略图网格 + 一键选**，AI 推荐项预选高亮（智能默认覆盖多数决策）【证据：生成式 UI 声明式档；ChatGPT 默认覆盖 90%】。
- **关键**：缩略图用用户实际封面内容渲染（学 Gamma "带你内容的实时预览"），不是通用样图【证据】。
- 选模板 = 选风格（吸收 style_lock gate）；生成后仍可**一键换肤不动内容**（中文用户强预期）【证据】。

### 触点③ 出图 vs HTML 卡片（替代 `choose_render_mode` 的 JSON 面板）

```
┌─ 选择输出形态 ────────────────────────────────────────┐
│  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │ 🌐 HTML 网页幻灯片      │  │ 🖼️ AI 配图幻灯片        │  │
│  │ ·秒级生成、可直接翻页    │  │ ·每页 AI 出图(60-90s/页) │  │
│  │ ·适合快速交付/在线分享   │  │ ·视觉冲击强、适合封面金句 │  │
│  │ [✓ 默认]               │  │ ⚠ 需配置图片 API key     │  │
│  └──────────────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────┘
```
- 二选一**预览卡片**，每张写清代价（耗时/前置条件），HTML 预选为默认【证据：Smashing "Proceed/Edit/Handle"；Tome 显式控制粒度岔路口】。
- 附"为什么问"：让审批不沦为橡皮图章，也避免过度打断【证据】。

### 触点④ 交付：预览 + 逐页重生 + 导出

```
┌─ 主舞台(成品) + 缩略图轨 ──────────────────────────────┐
│  缩略图 hover → [🔄重做这页] [🖼️换图] [📐换布局] [✏️改文案] │
│   └→ 触发 skill 的 regenerate <N>，**只改该页不串其他页**   │
│  顶栏右: [⬇ 导出 ▾]  → HTML / PDF / 图片 / (PPTX*)         │
└──────────────────────────────────────────────────────┘
```
- **逐页重生**：hover 缩略图出操作，或对话"把第 3 页换个布局"；务必保证页间隔离（中文产品普遍痛点，作为我们的质量差异点）【证据】。
- 借鉴 Gamma「Try new layout」：换布局时给多变体带内容预览，挑一个应用【证据】。
- 借鉴 Beautiful.ai：局部编辑给"只改布局/可改文案"开关，克制可逆【证据】。
- **导出**：HTML/PDF/图片现成；**PPTX 是中文用户刚需，列为后续硬目标**【证据】。

---

## 4. 流式与等待（生成阶段）

- **缩略图骨架屏 → 逐页填充**：把一个长进度条拆成 N 个短进度；focus 在"第 3/5 页渲染中"而非转圈【证据：NN/g 骨架屏；流式 token-by-token；per-slide reveal】。
- **阶段文案**：用「正在整理大纲…/正在套用 teaching-clean…/正在渲染第 3 页…」替代 "Loading…"，建立掌控感【证据：上下文化进度文案】。
- **可中断可恢复**：Stop 随时可用，中断保留已生成页（deepagents interrupt + checkpoint 天然支持）【证据】。
- 整体任务 >10s 给进度估计；单页 <10s 用骨架屏【证据：NN/g 时间阈值】。

---

## 5. 渐进式信任（新手 vs 老手）

- **新手**：走全管线，4 个触点都问，智能预选最稳项（teaching-clean + HTML）。
- **老手/专家模式**：记住上次模板/输出偏好，硬触点折叠为「已用上次设置（点此修改）」；检测到连续接受默认 → 自动减少询问（自适应披露，非手动开关）【证据：渐进式披露 / 自适应披露】。
- 面向训练营学员：默认保守、可解释、每步有"为什么"——非设计师友好。

---

## 6. 这套设计怎么落到我们现有架构（不是空想）

| UI 设计 | 技术落点（基于已跑通的 deepagents 脚手架） |
|---|---|
| 富交互卡片触点 | deepagents `interrupt(payload)` 携带**结构化 payload**（推荐项/选项/缩略图数据）；**自定义前端组件按 tool 名渲染**对应 picker，`Command(resume=...)` 回选择。即我们 RESEARCH.md 里的「路径 B/增强版」 |
| 大纲编辑器 gate | 把 outline 确认从"对话消息"改为一个 `confirm_outline` 工具，payload 带大纲结构；UI 渲染左树右预览编辑器 |
| 缩略图带用户内容 | 用每套 preset 的 CSS 对"封面页"快速渲染一张小图（build_html 已能按 style 出页） |
| 逐页流式浮现 | UI 监听 `files`/自定义事件，按 slide_plan 的页先放骨架，渲染完替换；或后端逐页 emit |
| 画布主舞台 | 直接渲染 build_slides_html 产出的 HTML（已可打开）；缩略图轨 = 各 `<section class="slide">` |
| 逐页重生 | 接 skill 已有的 `regenerate <N>`（中间态模式），做成 hover 操作 |
| PPTX 导出 | skill Phase 3 规划里有"可选 PPTX 导出"，需补 |

**结论**：大部分是**前端定制 + 把若干 gate 从对话改为带 payload 的 interrupt**，后端 deepagents 机制已具备。不需要推翻现有架构。

---

## 7. 实施分层（建议优先级）

**P0（高性价比，直接补现有最大短板）**
1. 两个硬交互点：JSON 审批面板 → **缩略图网格 / 二选一卡片**。
2. 画布主舞台：渲染 HTML deck + 缩略图轨 + 翻页（成品已有，只差前端壳）。
3. 智能默认预选 + 每个触点的"为什么问"文案。

**P1（补齐范式）**
4. 大纲编辑器 gate（左树/右预览，可就地改 + AI 改）。
5. 流式逐页浮现 + 阶段文案 + 可中断。
6. 逐页重生（hover 操作，接 regenerate）。

**P2（中文刚需 / 进阶）**
7. **PPTX 导出**（学员交作业刚需）。
8. 模板生成后一键换肤（不动内容）。
9. 渐进式/专家模式（记忆偏好、自适应减少询问）。

**取舍说明**：是否值得自建前端 vs 继续用 deep-agents-ui，是个决策点——通用 agent UI 能跑通"对话+todo+审批"，但 AI PPT 的**画布主舞台、缩略图轨、模板网格、逐页重生**这些它给不了。建议 **P0 即开始做轻量自建前端壳**（仍连同一个 LangGraph server），把 deep-agents-ui 当"开发期联调工具"保留。

---

## 8. 与"通用 deep-agents-ui"的关键差异（一图说清为什么要专属 UI）

| 维度 | 通用 deep-agents-ui（现状） | AI PPT 专属 UI（本方案） |
|---|---|---|
| 主角 | 聊天流 | 幻灯片画布 + 缩略图轨 |
| 选模板 | 展示 JSON + Approve | 缩略图网格(带你内容)一键选 |
| 选输出 | 展示 JSON + Approve | 二选一预览卡片 |
| 确认大纲 | 聊天里一段文字 | 左树右预览可编辑器 |
| 生成过程 | tool 调用列表滚动 | 缩略图逐页骨架→填充 |
| 改一页 | 打字描述 | hover 缩略图选操作 |
| 交付 | 文件列表里一个 index.html | 成品预览 + 多格式导出 |

---

## 来源（精选）
**原则/学术**：[Generative Interfaces for LMs (arXiv 2508.19227)](https://arxiv.org/html/2508.19227) · [Skeleton Screens 101 (NN/g)](https://www.nngroup.com/articles/skeleton-screens/) · [Progressive Disclosure (NN/g)](https://www.nngroup.com/articles/progressive-disclosure/) · [Human-in-the-loop (LangChain)](https://docs.langchain.com/oss/python/langchain/human-in-the-loop) · [While We Wait (CHI 2025)](https://dl.acm.org/doi/10.1145/3706599.3719725)
**生成式 UI/agent UX**：[Generative UI Guide 2026 (CopilotKit)](https://www.copilotkit.ai/blog/the-developer-s-guide-to-generative-ui-in-2026) · [A2UI (Google)](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/) · [UX for Agents (LangChain)](https://blog.langchain.com/ux-for-agents-part-1-chat-2/) · [Designing Agentic AI UX (Smashing)](https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/)
**产品**：Gamma [帮助](https://help.gamma.app/en/articles/11029130-what-s-the-fastest-way-to-transform-content-and-layouts) · Beautiful.ai [Slide AI](https://support.beautiful.ai/hc/en-us/articles/43350069148557-Create-and-Edit-your-Slides-with-Slide-AI) · [Genspark AI Slides](https://www.genspark.ai/helpcenter?doc=tutorials_AI_Slides) · [Manus Slides](https://manus.im/blog/can-manus-create-slides) · [AiPPT 帮助](https://www.aippt.cn/help-center/) · [讯飞智文](https://zhiwen.xfyun.cn/) · [MindShow](https://mindshow.fun/) · [少数派 2026 横评](https://sspai.com/post/105484)
（完整来源见各调研 agent 原始报告。）
