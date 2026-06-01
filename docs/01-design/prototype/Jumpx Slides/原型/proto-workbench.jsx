// —— 工作台：渲染高光动画（骨架屏→逐页点亮 + 活动流自动展开）+ 完成态 ——
// 依赖 window.Slide / Thumb / DECK / TEMPLATES / RENDER_STEPS、proto.css
const { useState: useStateW, useEffect: useEffectW, useRef: useRefW } = React;

function fmtTs(sec) {
  const h = Math.floor(sec / 3600) % 24, m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = n => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}
function stepPage(text) {
  if (/渲染封面/.test(text)) return 1;
  const m = text.match(/渲染第\s*(\d+)\s*页/);
  return m ? +m[1] : null;
}

function Workbench({ deck, tpl, mode, onComplete }) {
  const ai = mode === 'image';
  const tplName = (window.TEMPLATES.find(t => t.id === tpl) || {}).name || '素白';
  const TOTAL = deck.length;

  const [stepIdx, setStepIdx] = useStateW(-1);
  const [events, setEvents] = useStateW([]);
  const [rendered, setRendered] = useStateW(0);
  const [cur, setCur] = useStateW(0);
  const [justlit, setJustlit] = useStateW(0);
  const [finished, setFinished] = useStateW(false);
  const [flowOpen, setFlowOpen] = useStateW(true);

  // 渲染高光动画
  useEffectW(() => {
    let i = -1, evs = [], rc = 0;
    const TS = 9 * 3600 + 41 * 38;
    const steps = window.RENDER_STEPS;
    const id = setInterval(() => {
      i++;
      if (i >= steps.length) {
        clearInterval(id);
        setFinished(true); setFlowOpen(false); setCur(0);
        onComplete && onComplete();
        return;
      }
      const raw = steps[i].replace('{tpl}', tplName);
      const pg = stepPage(raw);
      if (pg) { rc = Math.max(rc, pg); setRendered(rc); setCur(pg - 1); setJustlit(pg); }
      evs = [{ tx: raw, ts: fmtTs(TS + i * 7) }, ...evs];
      setEvents(evs.slice(0, 40));
      setStepIdx(i);
    }, 760);
    return () => clearInterval(id);
  }, []);

  // 完成后键盘翻页
  useEffectW(() => {
    if (!finished) return;
    const onKey = e => {
      if (e.key === 'ArrowRight') setCur(c => Math.min(TOTAL - 1, c + 1));
      if (e.key === 'ArrowLeft') setCur(c => Math.max(0, c - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished, TOTAL]);

  // 三态待办
  const tplDone = stepIdx >= 1 || finished;
  const renderDoing = !finished && stepIdx >= 1 && stepIdx <= 13;
  const renderDone = finished || stepIdx > 13;
  const proofState = finished ? 'done' : stepIdx === 14 ? 'doing' : stepIdx > 14 ? 'done' : 'todo';
  const notesState = finished ? 'done' : stepIdx === 15 ? 'doing' : 'todo';
  const tasks = [
    { ti: '规划大纲（12 页）', st: 'done' },
    { ti: `套用模板「${tplName}」`, st: tplDone ? 'done' : 'doing' },
    { ti: '渲染幻灯片', st: renderDone ? 'done' : 'doing', meta: `第 ${Math.min(rendered || 1, TOTAL)} / ${TOTAL} 页 · 配图布局`, prog: rendered / TOTAL },
    { ti: '校对文字与排版', st: proofState },
    { ti: '生成讲者备注', st: notesState },
  ];
  const doneCount = tasks.filter(t => t.st === 'done').length;

  const maxNav = finished ? TOTAL : Math.max(rendered, 1);
  const chk = <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>;

  return (
    <div className="screen">
      <div className="wb">
        {/* 舞台 */}
        <div className="wb-stage">
          <div className="bigpg"><span className="a">{String(cur + 1).padStart(2, '0')}</span><span className="sl">⁄</span><span className="b">{TOTAL}</span><span className="cap">{finished ? '已完成' : '渲染中'}</span></div>
          {finished && <div className="done-toast">{chk}全部完成 · {TOTAL} 页已就绪</div>}
          <div className="mat"><Slide page={deck[cur]} tpl={tpl} ai={ai} /></div>
          <div className="stage-nav">
            <button className="nav" disabled={!finished || cur <= 0} onClick={() => setCur(c => Math.max(0, c - 1))}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg></button>
            <div className="kbd2"><kbd>←</kbd><kbd>→</kbd> {finished ? '键盘翻页' : '渲染中…'}</div>
            <button className="nav" disabled={!finished || cur >= TOTAL - 1} onClick={() => setCur(c => Math.min(TOTAL - 1, c + 1))}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg></button>
          </div>
        </div>

        {/* 副驾 */}
        <div className="cop">
          <div className="cop-head">
            <div className={'ai' + (finished ? '' : ' busy')}><i /></div>
            <span className="t">副驾</span>
            <span className="s">{finished ? '已完成' : '正在渲染…'}</span>
          </div>
          <div className="cop-scroll">
            <div className="sec-h">本次任务 <span className="cnt">{doneCount} / {tasks.length}</span></div>
            <div className="todo-list">
              {tasks.map((t, i) => (
                <div key={i} className={'task ' + t.st}>
                  <span className="mk">{t.st === 'done' ? chk : t.st === 'doing' ? <i /> : null}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ti">{t.ti}</div>
                    {t.st === 'doing' && t.meta && <div className="meta">{t.meta}</div>}
                    {t.st === 'doing' && t.prog != null && <div className="prog"><i style={{ width: Math.round(t.prog * 100) + '%' }} /></div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flow">
              <div className="flow-h" onClick={() => setFlowOpen(o => !o)}>
                <span className="t">它在干什么 · 实时</span>
                <svg className={'chev' + (flowOpen ? ' open' : '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
              </div>
              {flowOpen && (
                <div className="log">
                  {events.map((e, i) => (
                    <div key={e.ts + i} className={'ev' + (i === 0 && !finished ? ' now' : '')}>
                      <span className="d" />
                      <div><div className="tx">{e.tx}</div><div className="ts">{e.ts}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="chat">
            <div className="chips"><span className="chip">把这页改成三栏</span><span className="chip">配色再素一点</span><span className="chip">加一页小结</span></div>
            <div className="composer">
              <input placeholder="和副驾说点什么…" />
              <button className="send"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
            </div>
          </div>
        </div>

        {/* 底部胶片轨 */}
        <div className="film">
          <div className="film-h"><span className="t">幻灯片</span><span className="grp">封面 · 目录 · 正文 · 结尾</span><span className="c">{finished ? TOTAL : rendered} / {TOTAL} 已渲染</span></div>
          <div className="strip">
            {deck.map((p, i) => {
              const n = i + 1;
              const state = (finished || n <= rendered) ? 'done' : 'pending';
              return <Thumb key={n} n={n} page={p} tpl={tpl} ai={ai} state={state} sel={cur === i} justlit={justlit === n && !finished} onClick={() => finished && setCur(i)} />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Workbench = Workbench;
