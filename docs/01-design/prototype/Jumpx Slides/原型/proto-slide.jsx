// —— 幻灯片渲染器（按模板主题）+ 缩略图 + 模板封面 mini ——
// 依赖 proto.css 的 .slide[data-tpl] cqw 自适应主题。补齐自 Claude Design 文件计划。

const IC = {
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>,
};

function Slide({ page, tpl = 'plain', ai = false, skeleton = false }) {
  if (skeleton) {
    return (
      <div className="slide skeleton" data-tpl={tpl}>
        <div className="sk k1" /><div className="sk k2" /><div className="sk k3" />
        <div className="sk k4" /><div className="sk k5" /><div className="sk k6" />
      </div>
    );
  }
  const type = page.type || 'content';
  const base = `slide ${type === 'cover' ? 'cover' : type === 'closing' ? 'closing' : ''} ${ai ? 'ai' : ''}`.replace(/\s+/g, ' ').trim();

  if (type === 'cover') {
    if (ai) {
      return (
        <div className={base} data-tpl={tpl}>
          <div className="s-imgfull" />
          <div className="s-tag">AI 生成 · 封面氛围图</div>
          <div className="s-pad">
            <div className="s-kicker">{page.kicker}</div>
            <div className="s-title">{page.title}</div>
          </div>
        </div>
      );
    }
    return (
      <div className={base} data-tpl={tpl}>
        <div className="s-pad">
          <div className="s-kicker">{page.kicker}</div>
          <div className="s-title">{page.title}</div>
          {page.sub && <div className="s-sub">{page.sub}</div>}
          <div className="s-rule" />
        </div>
      </div>
    );
  }

  if (type === 'closing') {
    return (
      <div className={base} data-tpl={tpl}>
        <div className="s-pad">
          <div className="s-kicker">{page.kicker}</div>
          <div className="s-title">{page.title}</div>
          {page.sub && <div className="s-sub">{page.sub}</div>}
        </div>
      </div>
    );
  }

  // content
  const bullets = page.bullets || [];
  const centerList = bullets.length > 0 && bullets.every(b => !b.s) && !page.figure;
  return (
    <div className={base} data-tpl={tpl}>
      <div className="s-pad">
        <div className="s-kicker">{page.kicker}</div>
        <div className="s-title">{page.title}</div>
        <div className="s-body">
          <div className={'s-bullets' + (centerList ? ' center-list' : '')}>
            {bullets.map((b, i) => (
              <div className="s-bullet" key={i}>
                <span className="bdot" />
                <div>
                  <div className="bh">{b.h}</div>
                  {b.s && <div className="bs">{b.s}</div>}
                </div>
              </div>
            ))}
          </div>
          {page.figure && (
            <div className="s-fig"><span>{ai ? 'AI 生成 · ' + page.figure : page.figure}</span></div>
          )}
        </div>
      </div>
    </div>
  );
}

// 胶片轨 / 缩略图：state = done | cur | pending
function Thumb({ page, tpl, n, state, ai, sel, justlit, onClick }) {
  let cls = 'thumb';
  if (sel) cls += ' sel';
  if (state === 'pending') cls += ' pending';
  if (justlit) cls += ' justlit';
  return (
    <div className={cls} onClick={onClick} title={page ? page.title : ''}>
      <span className="tn">{String(n).padStart(2, '0')}</span>
      {state === 'pending'
        ? <div className="thumb-skel"><i /><i /><i /></div>
        : <div className="tmini"><Slide page={page} tpl={tpl} ai={ai} /></div>}
    </div>
  );
}

window.Slide = Slide;
window.Thumb = Thumb;
window.IC = IC;
