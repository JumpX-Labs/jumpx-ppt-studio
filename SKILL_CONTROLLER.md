# SKILL_CONTROLLER.md · 用户可控的「配方/Skills 控制器」设计

> 2026-05-31。产品定位:**一个把控制权交给用户的独立 PPT 生成器**。菜单栏提供 Skills 控制器,用户可**查看 / 合理修改 / 让 Agent 重新加载** skill;重载后**之后开始的 Slides** 用新配方。
> 本文是该特性的设计依据,落地参考。配套:[`UX_DESIGN.md`](./UX_DESIGN.md)、[`PROGRESS.md`](./PROGRESS.md)(架构现状)。

---

## 0. 核心命题

把 skill(控制"内容怎么生成"的指令)从**隐藏的后端资产**变成**用户可见、可改、可换的一等资产**。
- 用户能看懂"内容为什么这样输出"——因为是 skill 指令在控制。
- 想要不同版本的 Slides,最根本的杠杆是**改配方**,而不是反复抽卡。
- 产品从"PPT 生成器"升级为"**可编辑配方的生成平台**"。

---

## 1. 三层模型(开放程度不同,必须分清)

| 层 | 是什么 | 谁控制 | 开放 |
|---|---|---|---|
| **① 素材 / Context** | 本项目输入:主题、资料、受众;agent 压成的 context_pack | 用户的数据 | 完全开放 |
| **② 配方 / Skill 指令** | 怎么处理任何输入:大纲策略、每页写法、语气/密度、风格倾向 | skill references | **可看 + 受约束可改 / 可上传**（本特性主体） |
| **③ 契约 / Schema+Gates+机制** | slide_plan/style_lock schema、九步门禁、layout_type 枚举、build/render 机制、安全规则 | 系统 | **锁定** |

> "符合我们约束"= 用户只动 ②,动不了 ③。

### 1.1 映射到真实 skill 文件(ai-slide-producer)

| 文件 | 层 | 控制器中 |
|---|---|---|
| `references/02-context-pack.md` | ② 素材怎么吸收 | ✏️ 可改 |
| `references/03-strategist.md` | ② 大纲/叙事弧怎么搭 | ✏️ 可改 |
| `references/05-writer.md` | ② 每页内容怎么构建 | ✏️ 可改 |
| `references/07-designer.md` / `12-style-presets.md` | ② 设计/风格倾向 | ✏️ 可改 |
| `SKILL.md`（管线 + 6 Gate + 管线铁律） | ③ | 🔒 只读 |
| `schemas/*.json` | ③ 产物契约 | 🔒 只读 |
| `assets/templates`、`scripts/build_html.py` 等 | ③ 渲染机制 | 🔒 只读 |

---

## 2. 关键技术洞察:为什么"重新加载"很轻

我们用 `FilesystemBackend(root_dir=WORKSPACE)` 把 skill 挂在**真实磁盘**,且 skill 是 **progressive disclosure(边用边按需 read_file)**,甚至有"每页重读 style_lock"的规则。由此:

- **改 references 内容(配方主体)** → 存盘即可,**下一次生成时 agent 自然读到新版**,无需重建 agent 图。≈"保存=对下一份生效"。
- **改 SKILL.md frontmatter(name/description)/ 增删整个 skill** → 才需要真正重载 agent 图(重跑 `create_deep_agent`)。`langgraph dev` 监听文件变化会热重载;生产环境提供**按会话的 reload 接口**。
- **重载只影响"之后开始的 Slides",不打断在跑的那份。**

> 含义:"保存并重新加载"按钮 = 写盘 + 校验(+ 必要时触发图重载)。对绝大多数"改配方"操作,代价极低。

---

## 3. 控制器形态(菜单栏入口)

顶栏放一个 **`⚙ 配方 / Skills`** 入口,点开为覆盖式面板:

```
┌─ Skills 控制器 ─────────────────────────────────────────────┐
│  左:skill 文件树                  右:查看 / 编辑              │
│   ai-slide-producer  v3（我的副本）                            │
│    SKILL.md             🔒 核心·管线/门禁                      │
│    references/                                                │
│     02-context-pack.md  ✏️ 素材怎么吸收                        │
│     03-strategist.md    ✏️ 大纲/叙事弧            ← 选中,右侧编辑 │
│     05-writer.md        ✏️ 每页内容怎么构建                     │
│     12-style-presets.md ✏️ 风格倾向                           │
│    schemas/             🔒 契约·产物结构                       │
│    assets / scripts     🔒 机制·渲染                          │
│                                                              │
│  右上:🔒 锁定说明 / ✏️ 可改  ·  "改配方影响之后所有生成"          │
│  右:Markdown 编辑器（可改）/ 只读预览（锁定，附为何锁定）         │
│                                                              │
│  底部: [恢复默认]  [上传配方]      [校验]  [保存并重新加载 ⟳]   │
└──────────────────────────────────────────────────────────┘
```

- 可改文件 = Markdown 编辑器;锁定文件 = 只读 + 一句"为何锁定(保证产物有效/安全)"。
- 顶部常驻一句 scope 提示:**"改的是配方,影响之后开始的 Slides;当前这份产物不受影响。"**

---

## 4. "合理修改" = 保存前的校验门

点「校验」或「保存并重新加载」时:
1. **写入该用户自己的 skill 副本**(见 §6 多用户隔离)。
2. **契约体检(lint + dry-run)**:
   - 结构完整(SKILL.md frontmatter 在、references 可达);
   - 未删除/篡改门禁与铁律标记(③ 层不可动);
   - **干跑一次小样生成 → 用 `validate_slide_plan.py` / `validate_context_lock.py` 校验产物仍符合 schema、`layout_type` 合法**。
3. 通过 → 写盘(+ 必要时触发图重载)→ 提示 **"✓ 配方已更新,下次生成生效"**。
4. 不过 → 高亮哪条崩了、给可读报错、**不应用**(可存为草稿)。永远保留「恢复默认」逃生口。

> 校验门是"合理"的把关:写崩不会产出废页,而是被挡下并解释。

---

## 5. 改"配方" vs 改"这一份"(必须分开的两个入口)

| | 改"这一份" | 改"配方" |
|---|---|---|
| 入口 | 大纲编辑器 / 单页钻入 / Mark up | **Skills 控制器** |
| 改什么 | 本项目的产物实例 | 生成规则(指令) |
| 影响 | 仅当前 deck | 之后所有生成 / 重生 |

UI 必须让用户清楚"我现在改的是哪种",否则困惑。

---

## 6. 多用户隔离 + 安全(独立产品前提)

- **每用户一份可编辑 skill 副本**(base 拷贝,或 base + 用户 overrides)。控制器编辑该副本;该用户的 agent 挂载该副本。互不影响。
  - 技术:deepagents `skills=` 支持多来源、**后者覆盖同名**(见 RESEARCH.md)→ 可挂 `[基座(锁核心), 用户配方覆盖]`,用户改动只在可编辑层生效。
- **安全(prompt 注入)**:用户编辑/上传的指令是**进入 agent 上下文的不可信内容**。
  - system prompt 的**契约与安全规则必须压在用户配方之上**:用户配方只能调"内容怎么做",改不动"必须产出合法 slide_plan / 不越门禁 / 安全边界"。
  - 上传的 skill 要净化(剥离试图改写系统行为/越权的指令),并经 §4 校验门。

---

## 7. 进阶:配方即资产

- **版本 / fork / 命名**:配方可保存为命名版本、回滚("我的极简风 v2")。
- **上传 / 导入**:导入符合 skill 结构的配方包(.zip/目录)→ 校验 → 挂载。
- **分享 / 市场**(更后续):配方可分享,形成生态。

---

## 8. 落地阶段建议

- **P0 透明只读**:控制器先做"查看"——文件树 + 只读查看 + 锁定/可改标注。几乎免费(skill 本是可读 Markdown),立刻兑现"看懂为什么这样输出"。
- **P1 可改 + 校验重载**:开放 ② 层编辑 + §4 校验门 + 重载(开发期靠 langgraph 热重载,生产加 reload 接口)。
- **P2 多用户副本 + 上传 + 版本**:productionize(每用户副本、上传净化、版本/fork)。

---

## 9. 与现有实现的衔接

- 现状(`backend/`):单一 workspace,skill 在 `backend/workspace/skills/ai-slide-producer`,FilesystemBackend 挂载。
- P0/P1 在单 workspace 即可演示(编辑该目录文件 → langgraph dev 热重载 → 下次生成生效)。
- P2 productionize 时拆成 per-user workspace + reload 接口 + 上传净化。
- 前端:菜单栏 Skills 控制器(原型见 `docs/ClaudeDesign/Jumpx Slides/原型/proto-skills.jsx`)。
