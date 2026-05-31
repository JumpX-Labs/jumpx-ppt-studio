// 自原型数据自动转换为 ES 模块（DECK/TEMPLATES/TEMPLATE_DESC/RENDER_STEPS/SKILL_FILES/RECIPES_FALLBACK）
// —— Jumpx Slides 原型数据 ——
// 样例:重新认识睡眠 · 12 页 4 章

export const DECK = [
  { n:1,  type:'cover',   chapter:'封面',
    kicker:'训练营 · 第三章作业', title:'重新认识睡眠',
    sub:'给训练营同学的 10 分钟分享 · 林同学' },

  { n:2,  type:'content', chapter:'第一章 · 我们为何睡不好',
    kicker:'01 · 开场', title:'你昨晚，睡够了吗？',
    bullets:[
      {h:'一个扎心的提问', s:'多数人高估了自己的睡眠时长'},
      {h:'现场举手小调查', s:'七小时以上的请举手'},
    ] },

  { n:3,  type:'content', chapter:'第一章 · 我们为何睡不好',
    kicker:'02 · 误区', title:'三个常见误区',
    bullets:[
      {h:'补觉能还清睡眠债', s:'周末补觉只能部分恢复'},
      {h:'喝酒助眠', s:'酒精让深睡变浅、易早醒'},
      {h:'越累越好睡', s:'过度疲劳反而更难入睡'},
    ] },

  { n:4,  type:'content', chapter:'第二章 · 核心发现', accent:true,
    kicker:'03 · 核心发现', title:'三个被低估的睡眠杠杆',
    bullets:[
      {h:'固定起床时间', s:'比入睡时间更能稳定生物钟'},
      {h:'午后断咖啡因', s:'半衰期约 6 小时，影响深睡比例'},
      {h:'睡前降核心体温', s:'温水澡后体温回落带来困意'},
    ], figure:'深睡占比曲线图' },

  { n:5,  type:'content', chapter:'第二章 · 核心发现',
    kicker:'04 · 杠杆一', title:'固定起床时间',
    bullets:[
      {h:'生物钟的锚点', s:'每天同一时间起床，周末也尽量一致'},
      {h:'先固定起，再调整睡', s:'起床时间稳了，入睡会自然提前'},
    ], figure:'一周作息对照' },

  { n:6,  type:'content', chapter:'第二章 · 核心发现',
    kicker:'05 · 杠杆二三', title:'咖啡因与核心体温',
    bullets:[
      {h:'下午两点后不再摄入', s:'咖啡因半衰期约 6 小时'},
      {h:'睡前 1.5 小时温水澡', s:'体温回落是入睡信号'},
    ], figure:'体温与困意曲线' },

  { n:7,  type:'content', chapter:'第三章 · 怎么做',
    kicker:'06 · 计划', title:'一周睡眠计划',
    bullets:[
      {h:'可打印的执行表', s:'七天逐项打勾'},
      {h:'从一个习惯开始', s:'不必一次全改'},
    ], figure:'七天计划表' },

  { n:8,  type:'content', chapter:'第三章 · 怎么做',
    kicker:'07 · 环境', title:'卧室环境清单',
    bullets:[
      {h:'光', s:'遮光帘 + 睡前调暗'},
      {h:'温度', s:'18–20℃ 最适宜'},
      {h:'噪音', s:'白噪音或耳塞'},
    ] },

  { n:9,  type:'content', chapter:'第三章 · 怎么做',
    kicker:'08 · 工具', title:'趁手的工具与 App',
    bullets:[
      {h:'睡眠记录', s:'看趋势，别焦虑单晚'},
      {h:'光闹钟', s:'用光线唤醒更温和'},
      {h:'冥想音频', s:'帮助快速放松'},
    ], figure:'三个低成本选择' },

  { n:10, type:'content', chapter:'第四章 · 收尾',
    kicker:'09 · 回顾', title:'一页记住三件事',
    bullets:[
      {h:'固定起床时间', s:''},
      {h:'午后断咖啡因', s:''},
      {h:'睡前降核心体温', s:''},
    ] },

  { n:11, type:'content', chapter:'第四章 · 收尾',
    kicker:'10 · 行动', title:'今晚就能做的一步',
    bullets:[
      {h:'设一个“关机闹钟”', s:'睡前一小时提醒自己放下手机'},
    ] },

  { n:12, type:'closing', chapter:'第四章 · 收尾',
    kicker:'谢谢', title:'谢谢 · 问答', sub:'欢迎交流你的睡眠困扰' },
];

// —— 7 套模板：颜色 / 版式 / 性格各异 ——
export const TEMPLATES = [
  { id:'plain', name:'素白',     tag:'极简 · 通用', rec:true },
  { id:'pine',  name:'学术绿',   tag:'沉稳 · 学术' },
  { id:'kraft', name:'牛皮纸',   tag:'温暖 · 手作' },
  { id:'dark',  name:'夜读',     tag:'深色 · 聚焦' },
  { id:'mag',   name:'杂志',     tag:'大胆 · 编辑' },
  { id:'data',  name:'图表报告', tag:'结构 · 数据' },
  { id:'round', name:'圆润',     tag:'友好 · 轻松' },
];
export const TEMPLATE_DESC = {
  plain:'极简留白，黑字 + 一点墨绿。适合清单与图表，最通用、最好读。',
  pine:'墨绿封面色块 + 白字标题，沉稳的学术气质。',
  kraft:'暖牛皮纸底 + 棕墨字，像手作笔记，亲切。',
  dark:'深色背景聚焦内容，配琥珀点缀，适合现场投影。',
  mag:'大号粗标题 + 撞色块，杂志编辑感，主题页惊艳。',
  data:'结构化网格 + 等宽数字，为图表与数据而生。',
  round:'圆角与浅绿底，柔和友好、轻松不严肃。',
};

// —— 渲染阶段：逐页活动流文案（动词开头、简短、克制）——
export const RENDER_STEPS = [
  '套用模板「{tpl}」到全部正文页',
  '渲染封面 · 排标题与副标题',
  '渲染第 2 页 · 开场提问',
  '渲染第 3 页 · 三个误区清单',
  '为第 4 页选配图占位 · 深睡曲线',
  '渲染第 4 页 · 核心发现图文双栏',
  '渲染第 5 页 · 固定起床时间',
  '渲染第 6 页 · 咖啡因与体温',
  '渲染第 7 页 · 一周计划表',
  '渲染第 8 页 · 卧室环境清单',
  '渲染第 9 页 · 工具与 App',
  '渲染第 10 页 · 关键回顾',
  '渲染第 11 页 · 行动清单',
  '渲染第 12 页 · 谢谢与问答',
  '校对文字与排版 · 统一字号',
  '生成讲者备注草稿',
];


export const SKILL_FILES = [
  { group: '入口', path: 'SKILL.md', label: 'SKILL.md', kind: 'locked', why: '九步管线 + 6 道门禁 + 管线铁律。改了会破坏流程与产物有效性，故锁定。',
    body: `# ai-slide-producer\n主管线：Intake → Context Pack → Outline → Slide Plan → Review → Design → Render → QA → Delivery\n\n[CAUTION] 管线铁律（锁定）\n1. 串行执行；2. BLOCKING=硬停等用户；3. 禁跨阶段打包；\n6. 每页重读 style_lock.json；7. Image 路径禁伪造；8. Prompt 先落盘再调 API。` },

  { group: '配方 · 可改', path: 'references/02-context-pack.md', label: '02-context-pack.md · 素材怎么吸收', kind: 'edit',
    body: `# 素材吸收规则\n把 Brief + 用户材料压成固定结构：\n- Project Goal / Audience / Use Case\n- Knowledge Base（事实/数据/引用）\n- Narrative Direction（叙事方向）\n- Tone Rules（语气）\n- Forbidden Zones（禁区）\n- Acceptance Criteria（验收）\n\n# 可调：你想让素材里的「数据」优先级更高，就在这里加一行规则。` },

  { group: '配方 · 可改', path: 'references/03-strategist.md', label: '03-strategist.md · 大纲/叙事弧', kind: 'edit',
    body: `# 叙事弧（默认）\nHook → Context → Core → Shift → Takeaway\n\n# 按场景切换\n- 教学课件：问题 → 概念 → 方法 → 示例 → 练习 → 总结\n- 商业汇报：背景 → 问题 → 洞察 → 方案 → 路径 → 决策\n- 产品发布：痛点 → 新机会 → 产品 → 价值 → Demo → 行动\n\n# 可调：想要更"先抛结论"的麦肯锡式，把 Core 提到 Hook 之后即可。` },

  { group: '配方 · 可改', path: 'references/05-writer.md', label: '05-writer.md · 每页内容怎么构建', kind: 'edit',
    body: `# 每页构建规则\n- 每页只讲一个 key_message\n- on_slide_text：headline + 3–5 条要点（每条 h + 一句 s）\n- speaker_notes：讲者备注，口语、可照着讲\n- 标题要有"表达力"，不写"概述/简介"这类空标题\n\n# 可调：想要更精简（每页≤3 条、更短的 s），改这里的数字与措辞。` },

  { group: '配方 · 可改', path: 'references/background.md', label: 'background.md · 背景知识（配方的"脑子"）', kind: 'edit',
    body: `# 这个配方懂什么\n（配方自带、可复用的领域知识；与用户每次输入的素材不同）\n\n- 领域常识 / 术语 / 框架\n- 常用数据口径\n- 行业惯例与禁忌\n\n# 可调：把该领域的背景写在这里，生成时会作为底层知识注入。` },

  { group: '配方 · 可改', path: 'references/12-style-presets.md', label: '12-style-presets.md · 风格倾向', kind: 'edit',
    body: `# 风格选型规则\n根据场景 + 内容信号选 preset：\n- 清单/图表为主 → 素白（teaching-clean）\n- 强叙事/开场 → 杂志（editorial）\n- 信息密集/咨询 → swiss\n...\n\n# 可调：把你偏好的默认 preset 写在最前，AI 会优先推荐它。` },

  { group: '契约 · 锁定', path: 'schemas/slide_plan.schema.json', label: 'slide_plan.schema.json', kind: 'locked', why: '产物结构契约。layout_type 必须取自固定枚举，否则渲染器无法拼装。锁定以保证产物有效。',
    body: `{\n  "deck_meta": { "deck_title", "audience", "total_pages", "style_name", "language" },\n  "pages": [{\n    "page_id", "page_title", "key_message",\n    "on_slide_text": { "headline", "body[]" },\n    "layout_type": "cover|big-idea|two-column|comparison|framework|timeline|quote|image-text|section-divider|closing",\n    "image_requirement": { "needed", ... }\n  }]\n}` },

  { group: '机制 · 锁定', path: 'scripts/build_html.py', label: 'build_html.py · 渲染机制', kind: 'locked', why: '模板 + 占位符替换 + layout 片段拼接。属执行机制，改了会破坏渲染。锁定。',
    body: `# 读 source/slide_plan.json + style_lock.json\n# 套用模板 + 按 layout_type 拼 layout snippet\n# 输出可直接打开的 index.html（禁止 Agent 手写 HTML）` },
];

export const RECIPES_FALLBACK = [
  { id: 'plain', name: '素白 · 通用', active: true, tag: '内置 · 推荐',
    persona: '懂通用清单与图表 · 写得干练清晰 · 厚薄适中',
    domain: ['清单', '图表', '概念'], voice: '干练清晰', density: '适中',
    k: { background: '通用表达，无特定领域偏好。', narrative: '默认弧', voice: '干练清晰', absorb: ['忠实原文'], density: 1 } },
  { id: 'invest', name: '投资复盘风', tag: '内置',
    persona: '懂财务/增长指标与复盘框架 · 先抛结论·麦肯锡式 · 偏厚',
    domain: ['财务指标', '增长', '复盘框架'], voice: '理性·结论先行', density: '偏厚',
    k: { background: '熟悉北极星指标、AARRR、单位经济学、STAR 复盘框架、留存/LTV 口径……', narrative: '先抛结论', voice: '理性·结论先行', absorb: ['数据优先'], density: 2 } },
  { id: 'teach', name: '教学递进', tag: '内置',
    persona: '懂概念拆解与举例 · 循循善诱 · 厚薄适中',
    domain: ['概念拆解', '举例', '练习'], voice: '亲切·循循善诱', density: '适中',
    k: { background: '擅长把抽象概念拆成可教学的步骤、类比与练习。', narrative: '教学递进', voice: '亲切', absorb: ['自由重组'], density: 1 } },
  { id: 'song', name: '宋代美学入门', tag: '已导入 · GitHub',
    persona: '懂宋代美学背景 · 故事化·温润 · 偏薄',
    domain: ['宋代美学', '器物', '审美'], voice: '温润·叙事', density: '偏薄',
    k: { background: '熟悉宋代极简美学、汝窑、点茶、文人审美与器物史……', narrative: '故事化', voice: '温润·叙事', absorb: ['忠实原文'], density: 0 } },
];
