// —— 菜单栏：Skills / 配方 控制器 ——
// 用户查看 / 合理修改 / 重新加载 skill；改的是"配方"，影响之后开始的 Slides。
// 依赖 proto.css。本文件自带 mock 的 skill 文件树。
const { useState: useStateSK } = React;

// kind: 'edit'(可改配方) | 'locked'(契约/机制，只读)
window.SKILL_FILES = [
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

const SK_IC = {
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  pen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>,
};

function SkillsPanel({ onClose }) {
  const files = window.SKILL_FILES;
  const [selPath, setSelPath] = useStateSK('references/03-strategist.md');
  const [edits, setEdits] = useStateSK({});            // path -> 编辑后的内容
  const [status, setStatus] = useStateSK(null);        // null | 'checking' | 'ok' | 'fail'
  const sel = files.find(f => f.path === selPath) || files[0];
  const content = edits[sel.path] != null ? edits[sel.path] : sel.body;

  // 分组渲染
  const groups = [];
  files.forEach(f => { if (!groups.find(g => g.name === f.group)) groups.push({ name: f.group, items: [] }); groups.find(g => g.name === f.group).items.push(f); });

  function runCheck(reload) {
    setStatus('checking');
    // 模拟「契约体检：lint + dry-run + schema 校验」
    setTimeout(() => {
      // 简单"合理性"判定：可改文件被清空 → 视为不合理
      const bad = Object.entries(edits).some(([p, v]) => files.find(f => f.path === p)?.kind === 'edit' && v.trim().length < 5);
      if (bad) { setStatus('fail'); return; }
      setStatus('ok');
    }, 1400);
  }

  return (
    <div className="skills-overlay" onClick={onClose}>
      <div className="skills-modal" onClick={e => e.stopPropagation()}>
        <div className="sk-head">
          <div className="ai"><i /></div>
          <span className="ttl">配方 · Skills 控制器</span>
          <span className="scope">改配方影响之后开始的 Slides · 当前这份不受影响</span>
          <button className="x" onClick={onClose}>{SK_IC.x}</button>
        </div>

        <div className="sk-body">
          {/* 左：文件树 */}
          <div className="sk-tree">
            <div className="sk-skillname"><span className="n">ai-slide-producer</span><span className="v">v3 · 我的副本</span></div>
            {groups.map(g => (
              <div key={g.name}>
                <div className="sk-group">{g.name}</div>
                {g.items.map(f => (
                  <div key={f.path} className={'sk-file' + (f.path === selPath ? ' sel' : '') + (f.kind === 'locked' ? ' locked' : '')} onClick={() => { setSelPath(f.path); setStatus(null); }}>
                    <span className="fn">{f.label}</span>
                    {f.kind === 'edit'
                      ? <span className="sk-badge edit">{SK_IC.pen}可改</span>
                      : <span className="sk-badge lock">{SK_IC.lock}锁定</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* 右：查看 / 编辑 */}
          <div className="sk-editor">
            <div className="sk-ed-head">
              <div className="fp">{sel.path}</div>
              {sel.kind === 'edit'
                ? <div className="note">{SK_IC.pen} 这是配方,可改。改它会影响之后所有生成（不影响当前这份）。</div>
                : <div className="note lk">{SK_IC.lock} 锁定：{sel.why}</div>}
            </div>
            <div className="sk-ed-area">
              {sel.kind === 'edit'
                ? <textarea value={content} onChange={e => { setEdits({ ...edits, [sel.path]: e.target.value }); setStatus(null); }} spellCheck={false} />
                : <pre className="locked">{content}</pre>}
            </div>
            <div className="sk-foot">
              {status === 'checking' && <span className="status checking"><span className="ring" />契约体检中 · 干跑生成 + schema 校验…</span>}
              {status === 'ok' && <span className="status ok">{SK_IC.check}配方已更新 · 下次生成生效</span>}
              {status === 'fail' && <span className="status fail">{SK_IC.x}体检未过：可改文件不能为空，已保留原配方</span>}
              <div className="right">
                <button className="btn" onClick={() => { setEdits({}); setStatus(null); }}>恢复默认</button>
                <button className="btn">上传配方</button>
                <button className="btn" onClick={() => runCheck(false)}>校验</button>
                <button className="btn primary" onClick={() => runCheck(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" /></svg>
                  保存并重新加载
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.SkillsPanel = SkillsPanel;
