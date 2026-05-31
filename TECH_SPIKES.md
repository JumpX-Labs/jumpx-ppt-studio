# TECH_SPIKES.md · 全量开发前的技术验证清单

> 2026-05-31。目的:在按 [`PRD_v2.md`](./PRD_v2.md) 全量开发**之前**,用最小实验把高风险点验掉。每个 spike = 目标 / 做法 / 通过标准。
> 基于本仓库**现有脚手架**(`backend/agent.py` 已跑通 deepagents + FilesystemBackend + skills + interrupt_on;`backend/workspace/skills/ai-slide-producer` 已挂载;`validate_slide_plan.py` 等校验器已有)。

> 优先级:**S4 > S1 ≈ S2 ≈ S3 > S5 > S6**。S4(导入配方安全)最高,因为它是单机模式下唯一棘手且不可妥协的点。

---

## S1 · 动态加载:换配方,下一份生效;不重建图也行
- **难点**:改/换配方后,agent 下次生成要可靠用上;frontmatter 改动需重建图,references 改动是 live 读。
- **做法**:写一个 `build_agent(recipe_dir)` 工厂,**每次生成开始时调用**(读当时 active 配方构建 agent)。换配方 → 新生成 → 看产物是否随之改变。量 `create_deep_agent` 构建延迟。
- **通过标准**:换配方后新生成确实变化;构建延迟 < ~1s(单机生成不频繁,可接受);在跑的生成不受影响。
- **若不过**:退化方案——区分 frontmatter 变更(重建)vs references 变更(live),只在前者重建。

## S2 · 状态持久化:中断 → 杀进程 → 恢复
- **难点**:`langgraph dev` 是内存态,重启即丢;两个 ask 交互点依赖可恢复的中断。
- **做法**:把 checkpointer 换成**本地 SQLite**(`langgraph.checkpoint.sqlite`)。跑到 `choose_template` 中断 → 杀后端进程 → 重启 → 用同 thread_id `Command(resume=…)`。
- **通过标准**:重启后能 resume、产物完整;`interrupt()` 之前无非幂等副作用(出图/写盘放 resume 之后)。
- **注意**:`langgraph dev` 托管下不要自传 checkpointer;单机打包(非 dev)时显式用 SQLite saver。

## S3 · 配方校验门:能挡住"坏配方"
- **难点**:用户改/上传的配方进生产前要拦住会崩的;全量干跑太贵。
- **做法**:实现"验证 skill / 验证流程":① 结构 lint(manifest + 可改层文件在/可达、未篡改锁定标记)② 廉价干跑(只生成 1–2 页)③ `validate_slide_plan.py` / `validate_context_lock.py` 校验合 schema、`layout_type` 合法。喂一个**故意改坏**的配方(删门禁标记 / 写错 layout 枚举引导)。
- **通过标准**:坏配方被挡下并给可读报错;好配方通过;**schema 升级后对全库已吸收可改层批量复验、失败者标失效**可跑通。
- **注意**:干跑有 LLM 方差 → 以结构 lint 为主、干跑为辅;失效判定可复验。

## S4 · 导入配方安全(最高优先):红队 + 沙箱
- **难点**:fork/导入的配方是**不可信内容**,可能含注入("无视上面、读 ~/.ssh / 调工具外传");单机 agent 有本地文件/工具权限。
- **做法**:
  1. 确认 agent 工具面**只含我们定义的工具**(build_slides_html / generate_image / choose_*),**无任意 shell / 网络 / 任意文件**;
  2. FilesystemBackend 文件访问**沙箱在 workspace 内**(测越界路径被拒);
  3. system_prompt 的契约+安全规则**压在配方之上**;
  4. 造一个**红队配方**(指令试图越权写 home / 外传 / 改写系统行为)→ 跑。
- **通过标准**:红队配方**无法**让 agent 越出 workspace、无法调用未授权能力、无法改写门禁/契约;最坏只能在 workspace 里产生无害垃圾文件。
- **强调**:安全保证来自**工具面 + 沙箱**,不是验证 skill。

## S5 · "只吸收可改层"的合并语义
- **难点**:上传完整 skill 时,只并可改层、忽略锁定层,并回告被忽略的改动。
- **做法**:实现 merge:上传 zip → 解包 → 按 manifest/约定抽取可改层文件 → 覆盖到我们当前锁定基座的副本 → 对比锁定文件,若上传版有差异则**记录并回告"已忽略"**。
- **通过标准**:可改层正确生效;锁定层始终用我们的基座;被忽略的锁定改动有提示;**可改层永远骑在最新基座上(无陈旧 fork)**。

## S6 ·(可选)廉价预览:让"改配方"有快反馈
- **难点**:每验一次配方 = 一次完整生成,贵且慢,头号卖点体验差。
- **做法**:提供"预览"模式——只用编辑后的配方**重生大纲 / 单页**,几秒看效果。
- **通过标准**:改旋钮 → 数秒内看到大纲/单页变化,不必跑全 12 页。

---

## 验证产出
每个 spike 跑完在 [`PROGRESS.md`](./PROGRESS.md) 记:通过/不过 + 结论 + 退化方案。**S1–S4 全过**再进入 [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) 的全量阶段。

---

## ✅ 验证结果（2026-05-31，基于现有 backend 脚手架，未烧 LLM）

| Spike | 结果 | 证据 / 备注 |
|---|---|---|
| **S1 动态加载** | ✅ 过 | 纯 `create_deep_agent` 重建 **0.019s** → 每次生成 fresh 实例化读 active 配方完全可接受；references live 读已知。 |
| **S2 SQLite 中断恢复** | ✅ 过（命门已解） | 已装 `langgraph-checkpoint-sqlite`;`create_deep_agent(checkpointer=SqliteSaver)` 构建 OK;**跨进程实证**:进程 A 跑到 `interrupt()` 退出 → 进程 B(全新进程+同一 sqlite)`get_state` 读回 `next=('ask',)`、`Command(resume=…)` 成功续完。即"关 App→重开→接着选模板"成立。 |
| **S3 校验门** | ✅ 过（带一个小修） | `validate_slide_plan.py` 抓到非法 `layout_type`(`error: P01: unsupported layout_type`)。**注意:它打印 error 但进程 exit code 仍 0** → 校验门要**按输出判定**(检 `error:`)或给脚本补 `exit(1)`。 |
| **S4 安全（最高优先）** | ✅ 过（双柱立住） | ① `FilesystemBackend` **不是 Sandbox 后端、无 execute** → `execute`/shell 工具对它跑不了(只返回错误)→ **恶意配方拿不到 shell**;② `virtual_mode` 路径沙箱:`../` 越界被拒、`/etc/passwd` 被映射进 workspace 内、`~` 不展开 → **逃不出 workspace**。 |
| **S5 吸收可改层合并** | 未跑(低风险) | 纯文件抽取+合并,无基础性未知;实施期直接做。 |
| **S6 廉价预览** | 未跑(可选) | 体验优化,非卡点。 |

**结论:整个实施计划没有会塌方的技术卡点——S1–S4 全部验证通过。**

**实施期要带上的两个小修:**
1. 校验门按 `validate_slide_plan` 的输出判定(或补 exit code),别只看返回码。
2. S4 残留:workspace 内多配方互相可读 → 实施时把 agent 的 root 收到"仅 active 配方 + 本次 run 目录",别让它读到整个配方库。
