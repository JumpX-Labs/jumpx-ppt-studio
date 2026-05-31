// 实时工作台：由 LangGraph 流驱动（真 todos / 活动流 / 三交互点中断覆盖层 / 文件）。
import React from 'react'
import { readInterrupt, respondInterrupt, findOutputPath, runFinished, findPageCount } from './agent.js'

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
function findIndexHtml(files) {
  if (!files) return null
  return Object.keys(files).find(k => k.endsWith('index.html')) || null
}

function Overlay({ stream }) {
  const intr = readInterrupt(stream)
  if (!intr) return null
  const { name, args } = intr

  if (name === 'confirm_outline') {
    const outline = args.outline_md || args.outline || ''
    return (
      <div className="live-overlay">
        <div className="ov-card">
          <div className="ov-h">确认大纲 <span>{args.note || '改大纲很快；渲染成页后再改更贵'}</span></div>
          <pre className="ov-outline">{outline || '（大纲生成中…）'}</pre>
          <div className="ov-acts">
            <button className="btn primary" onClick={() => respondInterrupt(stream, 'OK，确认大纲，继续')}>✓ 确认大纲，继续</button>
            <button className="btn" onClick={() => respondInterrupt(stream, '请把要点更精简一些，重拟大纲')}>重拟（更精简）</button>
          </div>
        </div>
      </div>
    )
  }

  if (name === 'choose_template') {
    const rec = Array.isArray(args.recommended) ? args.recommended : []
    const list = [...new Set([...rec, ...REAL_PRESETS])]
    return (
      <div className="live-overlay">
        <div className="ov-card wide">
          <div className="ov-h">选一套模板 <span>{args.note || 'AI 推荐高亮；点选即用'}</span></div>
          <div className="ov-tpls">
            {list.map(p => (
              <button key={p} className={'ov-tpl' + (rec.includes(p) ? ' rec' : '')} onClick={() => respondInterrupt(stream, p)}>
                {rec.includes(p) && <span className="star">★</span>}{p}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
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
  const pages = plan && Array.isArray(plan.pages) ? plan.pages : []
  const pageCount = pages.length || findPageCount(stream)
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
              <div className="ov-card"><div className="ov-h">✅ 已生成{pageCount ? ` · ${pageCount} 页` : ''}</div>
                <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.7 }}>产物：<code>{indexHtml || 'runs/…/index.html'}</code><br />（在工作区 runs/ 下，可打开查看）</p>
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
          <div className="film-h"><span className="t">幻灯片</span><span className="c">{pageCount ? pageCount + ' 页' : '生成中'}</span></div>
          <div className="strip">
            {(pages.length ? pages : Array.from({ length: pageCount || 6 })).map((p, i) => (
              <div key={i} className={'thumb' + (pages.length ? '' : finished ? ' ready' : ' pending')}>
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
    </div>
  )
}
