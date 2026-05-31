# ai-ppt-webapp · Claude Code 入口

> 这是 Jumpxai 的 **AI Slides WebApp** 工程目录（基于 deepagents 驱动我们已有的 ai-slide-producer skill）。
> **动手前先完整读 [`IMPLEMENTATION_TASK.md`](./IMPLEMENTATION_TASK.md)**，那是本任务的实施宪法。

## 你是谁、做什么
你是负责把这个 WebApp 脚手架搭起来的工程 agent。当前阶段目标：**调研 deepagents 生态 → clone → 本地跑通 → 搭好脚手架并接入我们的 skill**。不是一次写完整产品。

## 必读顺序
1. `IMPLEMENTATION_TASK.md`（本任务的完整需求、阶段、验收标准、护栏）
2. 产品 PRD：`../../01_Camps/ai_camp/202605_Cohort01/02_Weeks/Week04_Vibe_Coding/课件2_AI_Slides_WebApp完整PRD.md`
3. 调研参考：`../../07_Research/DeerFlow借鉴调研_AI_PPT产品_v1.md`、`../../01_Camps/ai_camp/202605_Cohort01/02_Weeks/Week04_Vibe_Coding/deepagents_调研_v1.md`
4. 现有 skill：`../jumpx-ppt-slides-skill/`（SKILL.md / PRD / 打包好的 `skills/ai-slide-producer.zip`）

## 护栏（硬规则）
- **不 `git commit` / `git push`**，除非用户明确要求。
- 遇到**需要拍板的决策点**（见任务文档"待确认"），先停下问用户，不要自己替我们决定。
- 需要 API key / model 选择等密钥与配置，**列出来让用户提供**，不要硬编码、不要瞎填。
- **每完成一个阶段更新 `PROGRESS.md`**（在本目录），记录已做、卡点、下一步。
