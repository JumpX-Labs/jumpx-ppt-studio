import React from 'react'
import { Slide } from './Slide.jsx'
import { DECK, TEMPLATES, TEMPLATE_DESC } from './data.js'

// —— 四屏：输入起步页 / 大纲编辑器 / 选模板 / 选输出形态 ——
// 依赖 Slide、proto.css、DECK/TEMPLATES/TEMPLATE_DESC
const { useState: useStateS } = React;

const ARROW = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const STAR = <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.6 6.3L21 9l-5 4.3L17.6 21 12 17.3 6.4 21 8 13.3 3 9l6.4-.7z" /></svg>;

/* ============ 屏 1 · 输入起步页（居中聚焦） ============ */
function InputScreen({ onStart }) {
  const [topic, setTopic] = useStateS('重新认识睡眠 —— 给训练营同学的 10 分钟分享');
  const [len, setLen] = useStateS('约 12 页');
  const [aud, setAud] = useStateS('同学');
  const [tone, setTone] = useStateS('干练');
  const examples = ['15 分钟生活圈', '用户增长的第一性原理', '宋代美学入门', '我的产品复盘'];
  const Seg = ({ label, val, set, opts }) => (
    <div className="optgrp">
      <span className="gl">{label}</span>
      <div className="seg">
        {opts.map(o => <span key={o} className={'s' + (val === o ? ' on' : '')} onClick={() => set(o)}>{o}</span>)}
      </div>
    </div>
  );
  return (
    <div className="screen">
      <div className="center-wrap">
        <div className="center-col">
          <h2 className="big">想讲点什么？</h2>
          <p className="lead">写下一个主题，副驾会先帮你规划大纲。几个关键选择，它会停下来问你的意见。</p>
          <div className="compose">
            <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="例如：重新认识睡眠 —— 给训练营同学的 10 分钟分享" />
            <div className="foot">
              <span className="hintn">可粘贴资料 / 上传 PDF · 可选</span>
              <span className="spacer" />
              <button className="cta" onClick={() => onStart(topic, { len, aud, tone })}>开始生成 {ARROW}</button>
            </div>
          </div>
          <div className="ex">
            <span className="lab">试：</span>
            {examples.map(x => <span key={x} className="chip" onClick={() => setTopic(x)}>{x}</span>)}
          </div>
          <div className="opts">
            <Seg label="篇幅" val={len} set={setLen} opts={['精简', '约 12 页', '详尽']} />
            <Seg label="受众" val={aud} set={setAud} opts={['同学', '客户', '评委']} />
            <Seg label="语气" val={tone} set={setTone} opts={['干练', '亲切', '学术']} />
          </div>
          <div className="reassure"><span className="pdot" />整个过程约 1–2 分钟，你随时可以打断或修改。</div>
        </div>
      </div>
    </div>
  );
}

/* ============ 屏 2 · 大纲编辑器（通览故事板 + 钻入） ============ */
function groupByChapter(deck) {
  const order = [];
  const map = {};
  deck.forEach(p => {
    if (!map[p.chapter]) { map[p.chapter] = []; order.push(p.chapter); }
    map[p.chapter].push(p);
  });
  return order.map(ch => ({ chapter: ch, pages: map[ch] }));
}

function OutlineScreen({ deck, tpl }) {
  const groups = groupByChapter(deck);
  const [sel, setSel] = useStateS(4);
  const [drill, setDrill] = useStateS(null);
  const [suggTaken, setSuggTaken] = useStateS(false);
  const chapNum = (ch) => deck.filter(p => p.chapter === ch).length;

  return (
    <div className="screen">
      <div className="body2">
        {/* 左：可拖拽大纲树 */}
        <div className="tree">
          <div className="agentline">
            <div className="ai"><i /></div>
            <div className="msg">我把它拆成了 <b>4 章 12 页</b>，顺序和重点先这样——有要调的直接改，几个关键选择我会停下来问你。</div>
          </div>
          <div className="tree-body">
            {groups.map((g, gi) => (
              <div className="chap-g" key={g.chapter}>
                <div className="chap-row">
                  <span className="ct">{g.chapter}</span>
                  <span className="cn">{g.pages.length} 页</span>
                </div>
                {g.pages.map(p => (
                  <div key={p.n} className={'prow' + (sel === p.n ? ' sel' : '')} onClick={() => setSel(p.n)} onDoubleClick={() => setDrill(p)}>
                    <span className="pn">{String(p.n).padStart(2, '0')}</span>
                    <span className="pt">{p.title}</span>
                  </div>
                ))}
                {gi === 3 && !suggTaken && (
                  <div className="sugg">
                    <span className="pn">+</span>
                    <span className="pt"><b>副驾建议 · 加一页</b>常见问题答疑</span>
                    <span className="act">
                      <button className="ok" onClick={() => setSuggTaken(true)} title="采纳">{IC.check}</button>
                      <button onClick={() => setSuggTaken(true)} title="忽略"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="tree-foot">
            <span className="meta">12 页 · 4 章 · 约 10 分钟</span>
            <span className="regen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" /></svg>重拟大纲</span>
          </div>
        </div>

        {/* 右：故事板网格 */}
        <div className="board">
          {groups.map(g => (
            <div key={g.chapter}>
              <div className="chap-div"><span className="ct">{g.chapter}</span><span className="ln" /></div>
              <div className="bgrid">
                {g.pages.map(p => (
                  p.type === 'cover'
                    ? <div key={p.n} className={'bcard cover' + (sel === p.n ? ' sel' : '')} onClick={() => setSel(p.n)} onDoubleClick={() => setDrill(p)}>
                        <div className="bn">封面</div>
                        <div className="bt">{p.title}</div>
                        <div className="sm">{p.sub}</div>
                      </div>
                    : <div key={p.n} className={'bcard' + (sel === p.n ? ' sel' : '')} onClick={() => setSel(p.n)} onDoubleClick={() => setDrill(p)}>
                        <div className="bn">{String(p.n).padStart(2, '0')}</div>
                        <div className="bt">{p.title}</div>
                        <div className="bl">
                          {(p.bullets || []).slice(0, 3).map((b, i) => <i key={i}>{b.h}</i>)}
                        </div>
                        <span className="hint">双击编辑</span>
                      </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 钻入单页编辑器 */}
      {drill && (
        <div className="drill" onClick={() => setDrill(null)}>
          <div className="drill-card" onClick={e => e.stopPropagation()}>
            <div className="drill-head">
              <span className="pgbadge">{String(drill.n).padStart(2, '0')}</span>
              <span className="cb">{drill.chapter}</span>
              <button className="x" onClick={() => setDrill(null)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
            </div>
            <div className="drill-body">
              <div className="drill-title" contentEditable suppressContentEditableWarning>{drill.title}</div>
              <div className="seclab">要点</div>
              {(drill.bullets || [{ h: drill.sub || '', s: '' }]).map((b, i) => (
                <div className="point" key={i}>
                  <span className="b" />
                  <div style={{ flex: 1 }}>
                    <div className="h" contentEditable suppressContentEditableWarning>{b.h}</div>
                    {b.s && <div className="s" contentEditable suppressContentEditableWarning>{b.s}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="drill-foot">
              <button className="btn" onClick={() => setDrill(null)}>取消</button>
              <button className="btn primary" onClick={() => setDrill(null)}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ 屏 3 · 选模板（套封面预览） ============ */
function TemplateScreen({ tpl, onTpl }) {
  const cur = TEMPLATES.find(t => t.id === tpl) || TEMPLATES[0];
  return (
    <div className="screen">
      <div className="body-tpl">
        <div className="tpl-left">
          <div className="h">选一套风格<span>· 7 套</span></div>
          <div className="tpl-grid">
            {TEMPLATES.map(t => (
              <div key={t.id} className={'tcard' + (t.id === tpl ? ' sel' : '')} onClick={() => onTpl(t.id)}>
                {t.rec && <div className="ribbon">{STAR}副驾推荐</div>}
                <div className="check">{IC.check}</div>
                <Slide page={DECK[0]} tpl={t.id} />
                <div className="nm">{t.id === tpl && <span className="rdot" />}{t.name}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="tpl-preview">
          <div className="pv-cap">预览 · 套用到你的封面</div>
          <div className="pv-big"><div className="mat"><Slide page={DECK[0]} tpl={tpl} /></div></div>
          <div className="pv-foot">
            <div className="info">
              <div className="nm">{cur.name}{cur.rec && <span className="r">· 副驾推荐</span>}</div>
              <div className="ds">{TEMPLATE_DESC[cur.id]}</div>
            </div>
            <div className="mini2">
              <Slide page={DECK[3]} tpl={tpl} />
              <Slide page={DECK[7]} tpl={tpl} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ 屏 4 · 选输出形态（同页两版） ============ */
function OutputScreen({ tpl, mode, setMode, onStart }) {
  const page = DECK[3];
  const clock = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  const Col = ({ id, title, badgeCls, badge, rec, frameCls, ai, meta, cost }) => {
    const isSel = mode === id;
    return (
      <div className="vcol">
        <div className="vhead">
          <span className="vt">{title}</span>
          <span className={'vbadge ' + badgeCls}>{badge}</span>
          {rec && <span className="rec">{STAR}推荐</span>}
        </div>
        <div className={'vframe ' + frameCls + (isSel ? ' selv' : '')} onClick={() => setMode(id)}>
          <div className="mat" style={{ padding: 14 }}><Slide page={page} tpl={tpl} ai={ai} /></div>
        </div>
        <div className="vmeta">{meta.map((m, i) => <span key={i}>{m[0]} <b>{m[1]}</b></span>)}</div>
        {cost && <div className="vcost">{clock}{cost}</div>}
        {isSel
          ? <button className="vbtn primary" onClick={() => onStart(id)}>✓ 用这种 · 开始渲染</button>
          : <button className="vbtn" onClick={() => setMode(id)}>改用这种</button>}
      </div>
    );
  };
  return (
    <div className="screen">
      <div className="center-wrap">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
          <div className="headrow">
            <div className="kick">渲染前最后一步</div>
            <h2>用哪种形态生成？</h2>
            <div className="agentnote">
              <span className="ai"><i /></span>
              <span>你这份偏 <b>清单 + 图表</b>，我建议用 <b>HTML</b>——更快、文字清晰、还能直接改。</span>
            </div>
          </div>
          <div className="versus">
            <Col id="html" title="HTML 网页式" badgeCls="fast" badge="秒级" rec frameCls="recf" ai={false}
              meta={[['速度', '快'], ['可编辑', '高'], ['体积', '轻']]} />
            <Col id="image" title="AI 配图式" badgeCls="slow" badge="较慢" frameCls="" ai={true}
              meta={[['速度', '较慢'], ['视觉', '强']]} cost="图片生成较慢，且不易再改" />
          </div>
        </div>
      </div>
    </div>
  );
}

export { InputScreen, OutlineScreen, TemplateScreen, OutputScreen };
