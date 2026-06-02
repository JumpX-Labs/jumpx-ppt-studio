// 实时工作台：由 LangGraph 流驱动（真 todos / 活动流 / 三交互点中断覆盖层 / 文件）。
import React from 'react'
import { readInterrupt, respondInterrupt, findOutputPath, runFinished, findPageCount, findRunId, findRunSlug } from './agent.js'
import { OutlineEditor } from './OutlineEditor.jsx'

const REAL_PRESETS = ['teaching-clean', 'editorial-magazine', 'swiss-system', 'blueprint', 'sketch-notes', 'corporate', 'creator-social']
const chk = <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>

function tasksFromTodos(todos) {
  return (todos || []).map(t => {
    const s = t.status === 'completed' ? 'done' : t.status === 'in_progress' ? 'doing' : 'todo'
    return { ti: t.content || t.title || '', st: s }
  })
}

// 从 messages 拉活动流（assistant 的工具调用 + 文本片段）
function activityFromMessages(messages) {
  const evs = []
  for (const m of messages || []) {
    if (m.type !== 'ai' && m.role !== 'assistant') continue
    const tcs = m.tool_calls || (m.additional_kwargs && m.additional_kwargs.tool_calls) || []
    for (const tc of tcs) {
      const nm = tc.name || (tc.function && tc.function.name)
      if (nm) evs.push('调用 ' + nm)
    }
    if (typeof m.content === 'string' && m.content.trim()) evs.push(m.content.trim().slice(0, 60))
  }
  return evs.slice(-6).reverse()
}

function findSlidePlan(files) {
  if (!files) return null
  const key = Object.keys(files).find(k => k.endsWith('slide_plan.json'))
  if (!key) return null
  try { return JSON.parse(files[key]) } catch { return null }
}
// 选模板：显示每套 preset 的真实渲染缩略图（预烤，/api/presets）
function TemplateChooser({ stream, args }) {
  const rec = Array.isArray(args.recommended) ? args.recommended : []
  const [presets, setPresets] = React.useState(null)
  React.useEffect(() => {
    let alive = true
    fetch('/api/presets').then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setPresets(d.presets || []) }).catch(() => { })
    return () => { alive = false }
  }, [])
  const meta = {}
  ;(presets || []).forEach(p => { meta[p.id] = p })
  const ids = [...new Set([...rec, ...REAL_PRESETS])]
  return (
    <div className="live-overlay">
      <div className="ov-card wide">
        <div className="ov-h">选一套模板 <span>{args.note || 'AI 推荐高亮；缩略图是该风格的真实渲染样例'}</span></div>
        <div className="ov-tpls grid">
          {ids.map(p => {
            const m = meta[p] || {}
            // 优先用内容页缩略图（更能体现版式），退而求其次用封面
            const thumb = (m.thumbs && (m.thumbs[1] || m.thumbs[0])) || null
            const isRec = rec.includes(p)
            return (
              <button key={p} className={'ov-tpl card' + (isRec ? ' rec' : '')} onClick={() => respondInterrupt(stream, p)}>
                <div className="ov-tpl-thumb">
                  {thumb
                    ? <img src={thumb} alt={p} loading="lazy" />
                    : <div className="ov-tpl-noimg">{presets ? '暂无预览' : '加载中…'}</div>}
                  {isRec && <span className="star">★ 推荐</span>}
                </div>
                <div className="ov-tpl-meta">
                  <b>{m.display_name || p}</b>
                  <i>{m.mood || p}</i>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Overlay({ stream }) {
  const intr = readInterrupt(stream)
  if (!intr) return null
  const { name, args } = intr

  if (name === 'confirm_outline') {
    return <OutlineEditor stream={stream} args={args} />
  }

  if (name === 'choose_template') {
    return <TemplateChooser stream={stream} args={args} />
  }

  if (name === 'choose_render_mode') {
    return (
      <div className="live-overlay">
        <div className="ov-card">
          <div className="ov-h">用哪种形态生成？ <span>{args.note || 'HTML 秒级、可改；AI 配图较慢、不易改'}</span></div>
          <div className="ov-modes">
            <button className="ov-mode rec" onClick={() => respondInterrupt(stream, 'html')}>
              <b>🌐 HTML 网页式</b><span>秒级 · 可编辑 · 体积轻 · 推荐</span></button>
            <button className="ov-mode" onClick={() => respondInterrupt(stream, 'image')}>
              <b>🖼️ AI 配图式</b><span>视觉强 · 较慢 · 不易再改</span></button>
          </div>
        </div>
      </div>
    )
  }

  // 兜底：未知交互点
  return (
    <div className="live-overlay">
      <div className="ov-card">
        <div className="ov-h">需要你确认：{name}</div>
        <pre className="ov-outline">{JSON.stringify(args, null, 2)}</pre>
        <div className="ov-acts"><button className="btn primary" onClick={() => respondInterrupt(stream, 'OK')}>继续</button></div>
      </div>
    </div>
  )
}

export function LiveWorkbench({ stream }) {
  const todos = tasksFromTodos(stream.values && stream.values.todos)
  const acts = activityFromMessages(stream.messages)
  const files = (stream.values && stream.values.files) || {}
  const plan = findSlidePlan(files)
  const indexHtml = findOutputPath(stream)
  const finished = runFinished(stream)
  const intr = readInterrupt(stream)
  const loading = stream.isLoading
  const runId = finished ? findRunId(stream) : null
  const runSlug = runId || findRunSlug(stream)   // 生成中即可拿到，用于提前拉逐页内容

  // 从后端拉真 slide_plan（逐页内容）；生成中轮询直到有页，完成后再刷一次。
  // FilesystemBackend 模式下虚拟 files 不含 slide_plan，所以靠后端读盘。
  const [runPlan, setRunPlan] = React.useState(null)
  const msgCount = (stream.messages || []).length
  React.useEffect(() => {
    if (!runSlug) { setRunPlan(null); return }
    let alive = true
    const pull = () => fetch(`/api/runs/${runSlug}/plan`)
      .then(r => (r.ok ? r.json() : null)).then(d => { if (alive && d) setRunPlan(d) }).catch(() => { })
    pull()
    // 生成中每 5s 轮询一次（slide_plan 写好前会 404）
    const t = (!finished) ? setInterval(pull, 5000) : null
    return () => { alive = false; if (t) clearInterval(t) }
  }, [runSlug, finished, msgCount])

  const virtualPages = plan && Array.isArray(plan.pages) ? plan.pages : []
  const fetchedPages = runPlan && Array.isArray(runPlan.pages) ? runPlan.pages : []
  const pages = virtualPages.length ? virtualPages : fetchedPages
  const pageCount = pages.length || findPageCount(stream)
  const [openPage, setOpenPage] = React.useState(null)   // 点缩略图看逐页内容
  const doneCount = todos.filter(t => t.st === 'done').length
  const lastText = (() => {
    const ai = [...(stream.messages || [])].reverse().find(m => (m.type === 'ai' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    return ai ? ai.content.trim() : ''
  })()

  return (
    <div className="screen">
      <div className="wb">
        <div className="wb-stage" style={{ position: 'relative' }}>
          {intr ? <Overlay stream={stream} />
            : finished ? (
              <div className="live-done">
                <div className="ld-bar">
                  <span className="ld-h">✅ 已生成{pageCount ? ` · ${pageCount} 页` : ''}</span>
                  {runId && <a className="btn" href={`/api/runs/${runId}/view`} target="_blank" rel="noreferrer">新标签打开 ↗</a>}
                </div>
                {runId
                  ? <iframe className="ld-frame" src={`/api/runs/${runId}/view`} title="生成的幻灯片预览" />
                  : <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.7 }}>产物：<code>{indexHtml || 'runs/…/index.html'}</code></p>}
              </div>
            ) : (
              <div className="ov-card">
                <div className="ov-h">{loading ? '副驾正在工作…' : '准备就绪'}{loading && <span className="ring" style={{ marginLeft: 10 }} />}</div>
                <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.7, maxWidth: 520 }}>{lastText ? lastText.slice(0, 280) : '正在规划与生成…'}</p>
              </div>
            )}
        </div>

        <div className="cop">
          <div className="cop-head"><div className={'ai' + (loading ? ' busy' : '')}><i /></div><span className="t">副驾</span><span className="s">{loading ? '运行中…' : intr ? '等你确认' : '空闲'}</span></div>
          <div className="cop-scroll">
            <div className="sec-h">本次任务 <span className="cnt">{doneCount} / {todos.length || '—'}</span></div>
            <div className="todo-list">
              {todos.length === 0 && <div className="task todo"><span className="mk" /><div className="body"><div className="ti">等待规划…</div></div></div>}
              {todos.map((t, i) => (
                <div key={i} className={'task ' + t.st}>
                  <span className="mk">{t.st === 'done' ? chk : t.st === 'doing' ? <i /> : null}</span>
                  <div className="body" style={{ flex: 1, minWidth: 0 }}><div className="ti">{t.ti}</div></div>
                </div>
              ))}
            </div>
            <div className="flow">
              <div className="flow-h"><span className="t">它在干什么 · 实时</span></div>
              <div className="log">
                {acts.length === 0 && <div className="ev"><span className="d" /><div><div className="tx" style={{ color: 'var(--ink-3)' }}>—</div></div></div>}
                {acts.map((e, i) => (
                  <div key={i} className={'ev' + (i === 0 ? ' now' : '')}><span className="d" /><div><div className="tx">{e}</div></div></div>
                ))}
              </div>
            </div>
          </div>
          <div className="chat">
            <div className="composer">
              <input placeholder="和副驾说点什么…" />
              {loading
                ? <button className="send" title="停止" onClick={() => stream.stop()}><svg viewBox="0 0 24 24" fill="#fff"><rect x="7" y="7" width="10" height="10" rx="2" /></svg></button>
                : <button className="send"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>}
            </div>
          </div>
        </div>

        <div className="film">
          <div className="film-h"><span className="t">幻灯片</span><span className="c">{pages.length ? pages.length + ' 页 · 点开看内容' : (pageCount ? pageCount + ' 页' : '生成中')}</span></div>
          <div className="strip">
            {(pages.length ? pages : Array.from({ length: pageCount || 6 })).map((p, i) => (
              <div key={i} className={'thumb' + (pages.length ? ' has' : finished ? ' ready' : ' pending')}
                onClick={() => pages.length && setOpenPage(i)} title={pages.length ? '点开看本页内容' : ''}>
                <span className="tn">{String(i + 1).padStart(2, '0')}</span>
                {pages.length
                  ? <div className="tmini" style={{ inset: '16px 8px 8px 8px', position: 'absolute', fontSize: 9, color: 'var(--ink-2)', lineHeight: 1.3, overflow: 'hidden' }}>{(p.page_title || p.title || '')}</div>
                  : finished ? null
                    : <div className="thumb-skel"><i /><i /><i /></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
      {openPage !== null && pages[openPage] && <PageDetail page={pages[openPage]} n={openPage + 1} total={pages.length} onClose={() => setOpenPage(null)} onNav={(d) => setOpenPage(Math.max(0, Math.min(pages.length - 1, openPage + d)))} />}
    </div>
  )
}

// 逐页内容查看（点缩略图弹出）：标题 + 要点 + 演讲备注
function PageDetail({ page, n, total, onClose, onNav }) {
  const t = page.on_slide_text || {}
  const body = t.body || []
  return (
    <div className="pd-mask" onClick={onClose}>
      <div className="pd" onClick={e => e.stopPropagation()}>
        <div className="pd-head">
          <span className="pd-n">{String(n).padStart(2, '0')} / {total}</span>
          <b className="pd-title">{page.page_title || t.headline || ''}</b>
          {page.layout_type && <span className="pd-layout">{page.layout_type}</span>}
          <span className="pd-sp" />
          <button className="iconbtn" onClick={() => onNav(-1)} disabled={n <= 1}>‹</button>
          <button className="iconbtn" onClick={() => onNav(1)} disabled={n >= total}>›</button>
          <button className="iconbtn" onClick={onClose}>✕</button>
        </div>
        <div className="pd-body">
          {page.key_message && <div className="pd-key">{page.key_message}</div>}
          {(t.headline && t.headline !== page.page_title) && <div className="pd-h2">{t.headline}</div>}
          {t.sub_headline && <div className="pd-sub">{t.sub_headline}</div>}
          {body.length > 0 && <ul className="pd-bullets">{body.map((b, i) => <li key={i}>{b}</li>)}</ul>}
          {t.caption && <div className="pd-cap">{t.caption}</div>}
          {page.speaker_notes && <div className="pd-notes"><div className="pd-notes-h">演讲备注</div>{page.speaker_notes}</div>}
        </div>
      </div>
    </div>
  )
}
