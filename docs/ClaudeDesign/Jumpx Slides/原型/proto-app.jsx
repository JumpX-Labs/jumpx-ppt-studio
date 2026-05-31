// —— App：状态机 + 顶栏阶段条 + 路由 + 明暗 Tweak + 规划过渡 + 导出菜单 ——
// 依赖 window.Screens / Workbench、proto.css
const { useState: useStateA, useEffect: useEffectA } = React;

const STEPS = ['输入', '大纲', '选模板', '渲染', '完成'];
function activeIndex(screen, wbDone) {
  if (screen === 'input') return 0;
  if (screen === 'outline') return 1;
  if (screen === 'template') return 2;
  if (screen === 'output') return 3;
  if (screen === 'workbench') return wbDone ? 4 : 3;
  return 0;
}

function Stepper({ screen, wbDone }) {
  const ai = activeIndex(screen, wbDone);
  const live = screen === 'workbench' && !wbDone; // 渲染中显示脉冲点
  const chk = <svg viewBox="0 0 24 24" width="11" fill="none" stroke="#fff" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>;
  return (
    <div className="steps">
      {STEPS.map((lb, i) => {
        const done = i < ai || (wbDone && i <= 4);
        const cur = !done && i === ai;
        return (
          <React.Fragment key={lb}>
            {i > 0 && <span className={'bar' + (i <= ai ? ' fill' : '')} />}
            <div className={'step' + (done ? ' done' : cur ? ' cur' : '')}>
              <span className="num">{done ? chk : (cur && live && lb === '渲染') ? <i className="live" /> : (i + 1)}</span>
              <span className="lb">{lb}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function App() {
  const { InputScreen, OutlineScreen, TemplateScreen, OutputScreen } = window.Screens;
  const [screen, setScreen] = useStateA('input');
  const [dark, setDark] = useStateA(false);
  const [topic, setTopic] = useStateA('');
  const [tpl, setTpl] = useStateA('plain');
  const [mode, setMode] = useStateA('html');
  const [wbDone, setWbDone] = useStateA(false);
  const [planning, setPlanning] = useStateA(false);
  const [exportOpen, setExportOpen] = useStateA(false);
  const [skillsOpen, setSkillsOpen] = useStateA(false);

  const tplName = (window.TEMPLATES.find(t => t.id === tpl) || {}).name || '素白';
  const projTitle = screen === 'input' ? '新建演示' : '重新认识睡眠';
  const projChap = screen === 'input' ? '' : '· 训练营第三章作业';

  // 输入 → 规划过渡 → 大纲
  function startFromInput(t) { setTopic(t); setPlanning(true); setTimeout(() => { setPlanning(false); setScreen('outline'); }, 1400); }
  function startRender(m) { setMode(m); setWbDone(false); setScreen('workbench'); }

  const sun = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></svg>;
  const moon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
  const arrow = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  const back = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>;

  function TopRight() {
    const darkBtn = <button className="iconbtn" title="明 / 暗" onClick={() => setDark(d => !d)}>{dark ? sun : moon}</button>;
    const skillsBtn = <button className="iconbtn" title="配方 / Skills" onClick={() => setSkillsOpen(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h10M4 12h7M4 17h10" /><circle cx="18" cy="7" r="2.2" /><circle cx="14" cy="12" r="2.2" /><circle cx="18" cy="17" r="2.2" /></svg></button>;
    if (screen === 'input') return <div className="tb-right">{skillsBtn}{darkBtn}<div className="avatar">林</div></div>;
    if (screen === 'outline') return <div className="tb-right">{skillsBtn}{darkBtn}<button className="btn primary" onClick={() => setScreen('template')}>确认大纲 · 选模板 {arrow}</button><div className="avatar">林</div></div>;
    if (screen === 'template') return <div className="tb-right">{skillsBtn}{darkBtn}<button className="btn" onClick={() => setScreen('outline')}>{back} 返回大纲</button><button className="btn primary" onClick={() => setScreen('output')}>用「{tplName}」· 下一步 {arrow}</button><div className="avatar">林</div></div>;
    if (screen === 'output') return <div className="tb-right">{skillsBtn}{darkBtn}<button className="btn" onClick={() => setScreen('template')}>{back} 返回模板</button><button className="btn primary" onClick={() => startRender(mode)}>用 {mode === 'html' ? 'HTML' : 'AI 配图'} 生成 · 开始 {arrow}</button><div className="avatar">林</div></div>;
    // workbench
    if (!wbDone) return <div className="tb-right">{skillsBtn}{darkBtn}<button className="btn dis">导出 · 待完成</button><div className="avatar">林</div></div>;
    return (
      <div className="tb-right" style={{ position: 'relative' }}>
        {skillsBtn}{darkBtn}
        <button className="btn">分享</button>
        <button className="btn primary" onClick={() => setExportOpen(o => !o)}>导出 ▾</button>
        <div className="avatar">林</div>
        {exportOpen && (
          <div className="export-pop">
            {[['HTML 网页', '可翻页 · 在线分享'], ['PDF', '便于打印 / 提交'], ['图片 PNG', '逐页导出'], ['PPTX', '在 PowerPoint / WPS 继续改']].map(([t, s]) => (
              <div className="ei" key={t} onClick={() => setExportOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
                <div><b>{t}</b><div className="sub">{s}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app" data-mode={dark ? 'dark' : undefined}>
      <div className="topbar">
        <div className="tb-brand"><div className="tb-glyph" /><span className="tb-name">Jumpx</span></div>
        <div className="tb-divline" />
        <div className="proj"><span className="t">{projTitle}</span>{projChap && <span className="chap">{projChap}</span>}
          {screen !== 'input' && <svg className="edit" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>}
        </div>
        <Stepper screen={screen} wbDone={wbDone} />
        <TopRight />
      </div>

      {screen === 'input' && <InputScreen onStart={startFromInput} />}
      {screen === 'outline' && <OutlineScreen deck={window.DECK} tpl={tpl} />}
      {screen === 'template' && <TemplateScreen tpl={tpl} onTpl={setTpl} />}
      {screen === 'output' && <OutputScreen tpl={tpl} mode={mode} setMode={setMode} onStart={startRender} />}
      {screen === 'workbench' && <window.Workbench deck={window.DECK} tpl={tpl} mode={mode} onComplete={() => setWbDone(true)} />}

      {planning && (
        <div className="planning">
          <div className="ring" />
          <div className="pt">正在为 <b>{topic.split('——')[0].trim() || '你的主题'}</b> 规划大纲…</div>
        </div>
      )}

      {skillsOpen && <window.RecipeHub onClose={() => setSkillsOpen(false)} />}
    </div>
  );
}

window.App = App;

// 挂载：轮询等所有依赖就位（Babel standalone 并行 fetch、执行顺序不保证）
(function tryMount() {
  if (window.Slide && window.Thumb && window.Screens && window.Workbench && window.SkillsPanel && window.RecipeHub && window.App) {
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(window.App));
  } else {
    setTimeout(tryMount, 30);
  }
})();
