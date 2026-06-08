// 轻量现场演示模式（借鉴 Slidev：固定画布+scale、键盘表、BroadcastChannel 双窗同步、演讲者视图）。
// 不引 Vue。deck 与本 app 同源 → 直接读/驱动 iframe 里的 #deck transform。
import React from 'react'
import { BrandMark } from './Brand.jsx'

const LOGICAL_W = 1280, LOGICAL_H = 720
const viewURL = (id) => `/api/runs/${id}/view`

// —— deck iframe 驱动：直接设 #deck transform 翻页，隐藏其自带控件 ——
function deckDoc(iframe) {
  try { return iframe && iframe.contentDocument } catch { return null }
}
function deckSlideCount(iframe) {
  const d = deckDoc(iframe)
  return d ? d.querySelectorAll('.slide').length : 0
}
function driveDeck(iframe, i, animate = true) {
  const d = deckDoc(iframe); if (!d) return
  const deck = d.getElementById('deck'); if (!deck) return
  deck.style.transition = animate ? 'transform .35s ease' : 'none'
  deck.style.transform = `translateX(${-i * 100}vw)`
}
function hideDeckChrome(iframe) {
  const d = deckDoc(iframe); if (!d) return
  let s = d.getElementById('__present_css')
  if (!s) { s = d.createElement('style'); s.id = '__present_css'; d.head.appendChild(s) }
  s.textContent = '.slide-controls,.slide-index{display:none!important}'
}

// —— BroadcastChannel 双窗同步（防回声：带 senderId+role，收到非自己来源才采纳）——
function makeChannel(runId, role, onMsg) {
  if (typeof BroadcastChannel === 'undefined') return { post: () => { }, close: () => { } }
  const ch = new BroadcastChannel(`jumpx-present-${runId}`)
  const id = role + '-' + Math.floor(performance.now())
  ch.onmessage = (e) => { if (e.data && e.data.sender !== id) onMsg(e.data) }
  return {
    post: (data) => ch.postMessage({ ...data, sender: id }),
    close: () => ch.close(),
  }
}

// 缩放：把固定逻辑画布等比塞进容器
function useFit(ref, depKey) {
  const [scale, setScale] = React.useState(1)
  React.useEffect(() => {
    const el = ref.current; if (!el) return
    const fit = () => {
      const r = el.getBoundingClientRect()
      setScale(Math.min(r.width / LOGICAL_W, r.height / LOGICAL_H))
    }
    fit()
    const ro = new ResizeObserver(fit); ro.observe(el)
    return () => ro.disconnect()
  }, [depKey])
  return scale
}

// deck 单页缩放预览（一个只读 iframe，驱动到指定页）——用于演讲者「当前/下一页」
function DeckMini({ runId, page }) {
  const wrapRef = React.useRef(null)
  const frameRef = React.useRef(null)
  const scale = useFit(wrapRef, 0)
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => { if (ready) { hideDeckChrome(frameRef.current); driveDeck(frameRef.current, page, false) } }, [page, ready])
  return (
    <div className="pm-wrap" ref={wrapRef}>
      <div className="pm-canvas" style={{ width: LOGICAL_W, height: LOGICAL_H, transform: `translate(-50%,-50%) scale(${scale})` }}>
        <iframe ref={frameRef} title={'p' + page} src={viewURL(runId)} scrolling="no"
          style={{ width: LOGICAL_W, height: LOGICAL_H, border: 0, pointerEvents: 'none' }}
          onLoad={() => setReady(true)} />
      </div>
    </div>
  )
}

// ============ 观众舞台（主窗）============
export function PresentStage({ runId, onExit }) {
  const frameRef = React.useRef(null)
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(0)
  const [overview, setOverview] = React.useState(false)
  const [buf, setBuf] = React.useState('')
  const chanRef = React.useRef(null)
  const pageRef = React.useRef(0); pageRef.current = page

  // 频道：把翻页广播给演讲者窗；也接受演讲者窗的翻页
  React.useEffect(() => {
    chanRef.current = makeChannel(runId, 'stage', (m) => {
      if (m.type === 'goto' && typeof m.page === 'number') applyPage(m.page, false)
      if (m.type === 'hello') chanRef.current.post({ type: 'state', page: pageRef.current, total })
    })
    return () => chanRef.current && chanRef.current.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, total])

  function applyPage(i, broadcast = true) {
    const n = total || deckSlideCount(frameRef.current) || 1
    const p = Math.max(0, Math.min(n - 1, i))
    pageRef.current = p   // 立即更新，避免同一 tick 连按读到旧值
    setPage(p); driveDeck(frameRef.current, p)
    if (broadcast && chanRef.current) chanRef.current.post({ type: 'goto', page: p, total: n })
  }
  const go = (d) => applyPage(pageRef.current + d)

  function onFrameLoad() {
    hideDeckChrome(frameRef.current)
    const n = deckSlideCount(frameRef.current)
    setTotal(n); driveDeck(frameRef.current, pageRef.current, false)   // 重载后恢复到当前页
    if (chanRef.current) chanRef.current.post({ type: 'state', page: pageRef.current, total: n })
  }

  // 键盘表（借鉴 Slidev）
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key >= '0' && e.key <= '9') { setBuf((b) => (b + e.key).slice(-3)); return }
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'PageDown': case 'ArrowDown': go(1); break
        case 'ArrowLeft': case 'PageUp': case 'ArrowUp': go(-1); break
        case 'Home': applyPage(0); break
        case 'End': applyPage((total || 1) - 1); break
        case 'Enter': if (buf) { applyPage(parseInt(buf, 10) - 1); setBuf('') } break
        case 'f': case 'F': toggleFs(); break
        case 'o': case 'O': setOverview((v) => !v); break
        case 'p': case 'P': openPresenter(); break
        case 'Escape': if (overview) setOverview(false); else onExit && onExit(); break
        default: return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, overview, buf])

  function toggleFs() {
    const el = document.documentElement
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen && el.requestFullscreen()
  }
  function openPresenter() { window.open(`?present=${encodeURIComponent(runId)}&role=presenter`, '_blank') }

  return (
    <div className="present-stage">
      <BrandMark onDark className="ps-brand" />
      <iframe ref={frameRef} title="deck" src={viewURL(runId)} className="ps-frame" onLoad={onFrameLoad} />
      <div className="ps-bar">
        <button className="ps-btn" onClick={() => go(-1)} aria-label="上一页">‹</button>
        <span className="ps-page">{Math.min(page + 1, total || 1)} / {total || '…'}</span>
        <button className="ps-btn" onClick={() => go(1)} aria-label="下一页">›</button>
        <span className="ps-sp" />
        <button className="ps-btn" onClick={() => setOverview(true)} title="总览 (O)">▦</button>
        <button className="ps-btn" onClick={openPresenter} title="演讲者视图 (P)">🧑‍🏫</button>
        <button className="ps-btn" onClick={toggleFs} title="全屏 (F)">⛶</button>
        <button className="ps-btn" onClick={() => onExit && onExit()} title="退出 (Esc)">✕</button>
      </div>
      <div className="ps-progress"><i style={{ width: `${total ? ((page + 1) / total) * 100 : 0}%` }} /></div>
      {buf && <div className="ps-goto">跳到第 {buf} 页 · Enter</div>}
      {overview && (
        <div className="ps-overview" onClick={() => setOverview(false)}>
          <div className="ps-ov-grid">
            {Array.from({ length: total }).map((_, i) => (
              <button key={i} className={'ps-ov-cell' + (i === page ? ' cur' : '')}
                onClick={(e) => { e.stopPropagation(); applyPage(i); setOverview(false) }}>
                <DeckMini runId={runId} page={i} />
                <span className="ps-ov-n">{i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============ 演讲者视图（独立标签）============
export function PresenterView({ runId }) {
  const [page, setPage] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  const [pages, setPages] = React.useState([])   // slide_plan 的每页（含 speaker_notes）
  const chanRef = React.useRef(null)
  const pageRef = React.useRef(0); pageRef.current = page

  React.useEffect(() => {
    fetch(`/api/runs/${runId}/plan`).then(r => r.ok ? r.json() : null)
      .then(d => { if (d && Array.isArray(d.pages)) { setPages(d.pages); setTotal(d.pages.length) } }).catch(() => { })
    chanRef.current = makeChannel(runId, 'presenter', (m) => {
      if ((m.type === 'goto' || m.type === 'state') && typeof m.page === 'number') {
        setPage(m.page); if (m.total) setTotal(m.total)
      }
    })
    chanRef.current.post({ type: 'hello' })   // 请舞台回报当前态
    return () => chanRef.current && chanRef.current.close()
  }, [runId])

  function go(d) {
    const n = total || 1
    const p = Math.max(0, Math.min(n - 1, pageRef.current + d))
    pageRef.current = p
    setPage(p); chanRef.current && chanRef.current.post({ type: 'goto', page: p, total: n })
  }
  React.useEffect(() => {
    const onKey = (e) => {
      if (['ArrowRight', ' ', 'PageDown', 'ArrowDown'].includes(e.key)) { go(1); e.preventDefault() }
      else if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(e.key)) { go(-1); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total])

  const cur = pages[page] || {}
  const notes = cur.speaker_notes || cur.speaker_note || '（本页无演讲备注）'

  return (
    <div className="presenter">
      <div className="pr-main">
        <div className="pr-h">当前 · 第 {page + 1} / {total || '…'} 页</div>
        <DeckMini runId={runId} page={page} />
      </div>
      <div className="pr-side">
        <Timer />
        <div className="pr-next">
          <div className="pr-h">下一页</div>
          {page + 1 < (total || 0) ? <DeckMini runId={runId} page={page + 1} /> : <div className="pr-end">— 已是最后一页 —</div>}
        </div>
      </div>
      <div className="pr-notes">
        <div className="pr-h">演讲备注 · {cur.page_title || ''}</div>
        <div className="pr-notes-body">{notes}</div>
      </div>
      <div className="pr-ctrl">
        <button className="ps-btn" onClick={() => go(-1)}>‹ 上一页</button>
        <button className="ps-btn" onClick={() => go(1)}>下一页 ›</button>
      </div>
    </div>
  )
}

function Timer() {
  const [ms, setMs] = React.useState(0)
  const [run, setRun] = React.useState(true)
  React.useEffect(() => {
    if (!run) return
    const t = setInterval(() => setMs((m) => m + 1000), 1000)
    return () => clearInterval(t)
  }, [run])
  const s = Math.floor(ms / 1000)
  const fmt = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  return (
    <div className="pr-timer">
      <div className="pr-clock">{fmt}</div>
      <div className="pr-tbtns">
        <button className="ps-btn" onClick={() => setRun(r => !r)}>{run ? '暂停' : '继续'}</button>
        <button className="ps-btn" onClick={() => { setMs(0) }}>重置</button>
      </div>
    </div>
  )
}
