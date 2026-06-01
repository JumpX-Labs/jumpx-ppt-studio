// —— 配方页（产品叙事：领域×风格的人格）+ 配方编辑器（简洁旋钮 / 进阶 Markdown）——
// 依赖 proto.css、window.SKILL_FILES（proto-skills）。
const { useState: useStateR } = React;

// 人格化配方（mock）
window.RECIPES = [
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

const RC_IC = {
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>,
  fork: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="19" r="2.5" /><path d="M6 8.5v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-3M12 14.5v2" /></svg>,
  dl: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>,
  up: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21V9M7 14l5-5 5 5M5 3h14" /></svg>,
  pen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  reload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" /></svg>,
};
const NARRATIVES = ['默认弧', '先抛结论', '教学递进', '故事化'];
const VOICES = ['干练清晰', '亲切', '理性·结论先行', '温润·叙事', '学术'];
const ABSORBS = ['忠实原文', '自由重组', '数据优先'];
const DENSITY = ['精简', '适中', '详尽'];

/* ===== 配方编辑器（旋钮 / 进阶 Markdown） ===== */
function RecipeEditor({ recipe, onBack }) {
  const [tab, setTab] = useStateR('knobs');
  const [k, setK] = useStateR({ ...recipe.k });
  const [name, setName] = useStateR(recipe.name);
  const [status, setStatus] = useStateR(null);
  // 进阶：复用 SKILL_FILES
  const files = window.SKILL_FILES || [];
  const [selPath, setSelPath] = useStateR('references/05-writer.md');
  const [edits, setEdits] = useStateR({});
  const sel = files.find(f => f.path === selPath) || files[0];

  function check() {
    setStatus('checking');
    setTimeout(() => setStatus('ok'), 1300);
  }
  const toggleAbsorb = v => setK(s => ({ ...s, absorb: s.absorb.includes(v) ? s.absorb.filter(x => x !== v) : [...s.absorb, v] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="rcp-ehead">
        <span className="back" onClick={onBack}>{RC_IC.back} 配方</span>
        <span className="nm">{name || '未命名配方'}</span>
        <span className="scope">改配方影响之后开始的 Slides · 当前这份不受影响</span>
        <div className="rcp-tabs">
          <span className={'rcp-tab' + (tab === 'knobs' ? ' on' : '')} onClick={() => setTab('knobs')}>简洁</span>
          <span className={'rcp-tab' + (tab === 'adv' ? ' on' : '')} onClick={() => setTab('adv')}>进阶 · Markdown</span>
        </div>
      </div>

      <div className="rcp-scroll">
        {tab === 'knobs' ? (
          <div className="knobs">
            <div className="knob">
              <div className="kl">配方名</div>
              <input className="tx" value={name} onChange={e => { setName(e.target.value); setStatus(null); }} />
            </div>
            <div className="knob">
              <div className="kl">背景知识 <span>这个配方"懂什么"——自带的领域脑子</span></div>
              <textarea className="bg" value={k.background} onChange={e => { setK({ ...k, background: e.target.value }); setStatus(null); }} />
            </div>
            <div className="knob">
              <div className="kl">叙事结构</div>
              <div className="kchips">{NARRATIVES.map(n => <span key={n} className={'kchip' + (k.narrative === n ? ' on' : '')} onClick={() => { setK({ ...k, narrative: n }); setStatus(null); }}>{n}</span>)}</div>
            </div>
            <div className="knob">
              <div className="kl">写作语气 / 风格</div>
              <div className="kchips">{VOICES.map(n => <span key={n} className={'kchip' + (k.voice === n ? ' on' : '')} onClick={() => { setK({ ...k, voice: n }); setStatus(null); }}>{n}</span>)}</div>
            </div>
            <div className="knob">
              <div className="kl">素材吸收 <span>可多选</span></div>
              <div className="kchips">{ABSORBS.map(n => <span key={n} className={'kchip' + (k.absorb.includes(n) ? ' on' : '')} onClick={() => { toggleAbsorb(n); setStatus(null); }}>{n}</span>)}</div>
            </div>
            <div className="knob">
              <div className="kl">厚薄</div>
              <div className="kslider">
                <div className="kseg">{DENSITY.map((d, i) => <span key={d} className={'s' + (k.density === i ? ' on' : '')} onClick={() => { setK({ ...k, density: i }); setStatus(null); }}>{d}</span>)}</div>
              </div>
              <div className="hint">控制每页要点数与展开程度（薄=每页≤3条、更短；厚=展开充分）。</div>
            </div>
          </div>
        ) : (
          <div className="sk-body" style={{ height: '100%' }}>
            <div className="sk-tree">
              <div className="sk-skillname"><span className="n">{name}</span><span className="v">进阶 · 直接改指令</span></div>
              {files.map(f => (
                <div key={f.path} className={'sk-file' + (f.path === selPath ? ' sel' : '') + (f.kind === 'locked' ? ' locked' : '')} onClick={() => setSelPath(f.path)}>
                  <span className="fn">{f.label}</span>
                  {f.kind === 'edit' ? <span className="sk-badge edit">{RC_IC.pen}可改</span> : <span className="sk-badge lock">{RC_IC.lock}锁定</span>}
                </div>
              ))}
            </div>
            <div className="sk-editor">
              <div className="sk-ed-head">
                <div className="fp">{sel.path}</div>
                {sel.kind === 'edit'
                  ? <div className="note">{RC_IC.pen} 可改。影响之后所有生成（不影响当前这份）。</div>
                  : <div className="note lk">{RC_IC.lock} 锁定：{sel.why}</div>}
              </div>
              <div className="sk-ed-area">
                {sel.kind === 'edit'
                  ? <textarea value={edits[sel.path] != null ? edits[sel.path] : sel.body} onChange={e => { setEdits({ ...edits, [sel.path]: e.target.value }); setStatus(null); }} spellCheck={false} />
                  : <pre className="locked">{sel.body}</pre>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rcp-foot">
        {status === 'checking' && <span className="status checking"><span className="ring" />契约体检中 · 干跑 + schema 校验…</span>}
        {status === 'ok' && <span className="status ok">{RC_IC.check}已保存 · 下次生成生效</span>}
        <div className="right">
          <button className="btn">{RC_IC.dl} 下载配方</button>
          <button className="btn" onClick={check}>校验</button>
          <button className="btn primary" onClick={check}>{RC_IC.reload} 保存并重新加载</button>
        </div>
      </div>
    </div>
  );
}

/* ===== 配方 Hub：叙事页(画廊) + 编辑器 ===== */
function RecipeHub({ onClose }) {
  const [editing, setEditing] = useStateR(null);   // recipe | null
  const [active, setActive] = useStateR('plain');

  return (
    <div className="skills-overlay" onClick={onClose}>
      <div className="recipe-modal" onClick={e => e.stopPropagation()}>
        {editing ? (
          <RecipeEditor recipe={editing} onBack={() => setEditing(null)} />
        ) : (
          <div className="rcp-scroll">
            {/* 顶栏关闭 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 18px 0' }}>
              <button className="x" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--hair)', background: 'var(--paper-1)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-3)' }} onClick={onClose}>{RC_IC.x}</button>
            </div>
            {/* 叙事 hero */}
            <div className="rcp-hero">
              <div className="ey">配方 · Recipes</div>
              <h2>一个配方，就是<span className="hl">一个会写某类 deck 的"脑子"</span></h2>
              <p>它不是模板，而是一种<b>人格</b>：懂某个领域的背景、用某种风格叙事、写到某种厚薄。换个配方，就像换一位帮你写 slides 的专家——内容怎么来、为什么这么写，全由它决定，而你可以查看、调整，甚至上传别人的配方，本地生效。</p>
              <div className="formula">
                <span className="fx">📚 领域背景</span><span className="op">×</span>
                <span className="fx">✍️ 叙事风格</span><span className="op">×</span>
                <span className="fx">📏 厚薄</span><span className="op">=</span>
                <span className="fx" style={{ background: 'var(--pine)', color: '#fff', borderColor: 'var(--pine)' }}>一个人格化配方</span>
              </div>
            </div>

            <div className="rcp-bar">
              <span className="t">配方库 · 本地</span><span className="sp" />
              <button className="btn">{RC_IC.up} 上传配方（.zip）</button>
              <button className="btn">+ 新建配方</button>
            </div>

            <div className="rcp-grid">
              {window.RECIPES.map(r => {
                const on = active === r.id;
                return (
                  <div key={r.id} className={'rcard' + (on ? ' active' : '')}>
                    <div className="rtop"><span className="nm">{r.name}</span><span className="tag">{r.tag}</span></div>
                    <div className="persona">{r.persona}</div>
                    <div className="chips2">{r.domain.map(d => <span key={d} className="dchip">{d}</span>)}</div>
                    <div className="meta"><span>风格 <b>{r.voice}</b></span><span>厚薄 <b>{r.density}</b></span></div>
                    <div className="racts">
                      {on
                        ? <span className="activeflag">{RC_IC.check} 当前使用</span>
                        : <button className="use" onClick={() => setActive(r.id)}>选用</button>}
                      <button onClick={() => setEditing(r)}>{RC_IC.pen} 编辑</button>
                      <button className="icn" title="复制改一份（fork）" onClick={() => setEditing({ ...r, name: r.name + ' · 副本' })}>{RC_IC.fork}</button>
                      <button className="icn" title="下载 .zip">{RC_IC.dl}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

window.RecipeHub = RecipeHub;
