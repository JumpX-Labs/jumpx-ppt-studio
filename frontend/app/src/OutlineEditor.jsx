// 大纲编辑器：对齐原型（左树 + 右故事板）
// 解析 confirm_outline 的 outline_md → 结构化数据 → 双栏展示。
import React from 'react'
import { respondInterrupt } from './agent.js'

// ——— 解析 outline_md（鲁棒：兼容多种 LLM 输出格式）———
// 页头识别：可选 #~####，含 P 前缀 + 数字 + 分隔符（｜ | · . 、 ： : — – -）→ 标题；
//          或有序列表 "N. 标题" / "N. **角色** — 标题"。
// 其它 # 标题（叙事策略 / 节奏 / 总页数 …）= 段落边界，结束当前页收集。
function parseOutline(md) {
  if (!md) return { strategy: '', pages: [] }
  const lines = md.split('\n')
  let strategy = ''
  const pages = []
  let cur = null
  let inStrategy = false

  const SEP = '｜|·、：:．.\\-—–'
  // 带 P 前缀的页头（## P01｜.. / ### P01 ·.. / P1: ..）
  const reP = new RegExp('^#{0,4}\\s*P(\\d{1,2})\\s*[' + SEP + ']\\s*(.+)$', 'i')
  // 有序列表页头（1. **Role** — 标题 / 1. **标题** / 1. 标题）
  const reNumRole = /^(\d{1,2})\.\s+\*{1,2}([^*]+)\*{1,2}\s*[—–-]+\s*(.+)$/
  const reNum = /^(\d{1,2})\.\s+\*{0,2}(.+?)\*{0,2}$/
  const isHeading = (l) => /^#{1,4}\s/.test(l)

  const flush = () => { if (cur) { pages.push(cur); cur = null } }

  for (const raw of lines) {
    const l = raw.trim()
    if (!l || /^[-—–]{3,}$/.test(l)) continue

    // 叙事策略：段头或内联
    if (/^#{1,4}\s*(叙事策略|叙事弧|narrative|strategy)/i.test(l)) { inStrategy = true; flush(); continue }
    const inlineArc = l.match(/^\*{0,2}叙事[弧策略线]+\*{0,2}\s*[:：]\s*(.+)/)
    if (inlineArc) { strategy = inlineArc[1].replace(/\*+/g, '').trim(); inStrategy = false; continue }

    // 收尾段（节奏/时长/总页数/页面规划标题本身）→ 结束页收集
    if (/^#{1,4}\s*(总页数|预计时长|时长|时间|节奏|pacing|页面规划|pages)\b/i.test(l)) { flush(); inStrategy = false; continue }

    // 页头
    const mP = l.match(reP)
    const mNR = !mP && l.match(reNumRole)
    const mN = !mP && !mNR && l.match(reNum)
    if (mP || mNR || mN) {
      flush(); inStrategy = false
      let n, title, role = ''
      if (mP) { n = +mP[1]; title = mP[2].replace(/\*+/g, '').trim() }
      else if (mNR) { n = +mNR[1]; role = mNR[2].trim(); title = mNR[3].trim() }
      else { n = +mN[1]; title = mN[2].replace(/\*+/g, '').trim() }
      cur = { n, title, role, oneliner: '', bullets: [] }
      continue
    }

    // 其它标题 = 段落边界
    if (isHeading(l)) { flush(); inStrategy = false; continue }

    if (inStrategy) { strategy += (strategy ? '\n' : '') + l; continue }
    if (!cur) continue

    // 角色 / 作用
    const roleM = l.match(/^\s*[-*•]?\s*\*{0,2}(?:角色|作用|role)\*{0,2}\s*[:：]\s*(.+)/i)
    if (roleM) { cur.role = cur.role || roleM[1].replace(/\*+/g, '').trim(); continue }
    // 一句话 / key message
    const oneM = l.match(/^\s*[-*•]?\s*\*{0,2}(?:一句话|核心|key ?message|oneliner)\*{0,2}\s*[:：]\s*(.+)/i)
    if (oneM) { cur.oneliner = oneM[1].replace(/\*+/g, '').trim(); continue }
    // 普通要点
    const bM = l.match(/^\s*[-*•]\s+(.+)/)
    if (bM) { cur.bullets.push(bM[1].replace(/\*+/g, '').trim()); continue }
    if (/^\s{2,}\S/.test(raw)) cur.bullets.push(l.replace(/\*+/g, '').trim())
  }
  flush()
  return { strategy, pages }
}

// 把 role 映射成中文标签
const ROLE_LABEL = {
  hook: '钩子', cover: '封面', context: '背景', core: '核心',
  shift: '转折', takeaway: '收束', closing: '收束', evidence: '论据',
}
function roleTag(r) { const k = (r || '').toLowerCase().split('/')[0].trim(); return ROLE_LABEL[k] || r || '' }

// ——— 大纲编辑器组件 ———
export function OutlineEditor({ stream, args }) {
  const outline = args.outline_md || args.outline || ''
  const note = args.note || ''
  const { strategy, pages } = React.useMemo(() => parseOutline(outline), [outline])
  const [sel, setSel] = React.useState(pages[0]?.n ?? 1)

  // 兜底：解析不出结构化页（罕见格式），但已有大纲文本 → 直接展示原文 + 确认/重拟，绝不卡住
  if (!pages.length) {
    if (!outline.trim()) return <div className="oe-empty"><p>大纲生成中…</p></div>
    return (
      <div className="oe oe-raw">
        <div className="oe-raw-head">确认大纲{note ? ` · ${note.slice(0, 50)}` : ''}</div>
        <pre className="oe-raw-body">{outline}</pre>
        <div className="oe-acts">
          <button className="btn" onClick={() => respondInterrupt(stream, '请把要点更精简一些，重拟大纲')}>重拟（更精简）</button>
          <button className="btn primary" onClick={() => respondInterrupt(stream, 'OK，确认大纲，继续')}>✓ 确认大纲，继续</button>
        </div>
      </div>
    )
  }

  const selPage = pages.find(p => p.n === sel) || pages[0]

  return (
    <div className="oe">
      {/* 左：大纲树 */}
      <div className="oe-tree">
        <div className="oe-agent">
          <div className="oe-ai"><i /></div>
          <div className="oe-msg">
            共 <b>{pages.length} 页</b>。{strategy ? <span className="oe-strategy">{strategy.slice(0, 80)}{strategy.length > 80 ? '…' : ''}</span> : '顺序和重点先这样——有要调的直接告诉我。'}
          </div>
        </div>
        <div className="oe-list">
          {pages.map(p => (
            <div key={p.n} className={'oe-row' + (sel === p.n ? ' sel' : '')} onClick={() => setSel(p.n)}>
              <span className="oe-pn">{String(p.n).padStart(2, '0')}</span>
              <span className="oe-pt">{p.title}</span>
              {p.role && <span className="oe-role">{roleTag(p.role)}</span>}
            </div>
          ))}
        </div>
        <div className="oe-foot">
          <span className="oe-meta">{pages.length} 页{note ? ` · ${note}` : ''}</span>
        </div>
      </div>

      {/* 右：故事板网格 */}
      <div className="oe-board">
        <div className="oe-grid">
          {pages.map(p => {
            const isFirst = p.n === 1
            const isSel = p.n === sel
            return (
              <div key={p.n} className={'oe-card' + (isFirst ? ' cover' : '') + (isSel ? ' sel' : '')} onClick={() => setSel(p.n)}>
                <div className="oe-bn">{isFirst ? '封面' : String(p.n).padStart(2, '0')}</div>
                <div className="oe-bt">{p.title}</div>
                {p.oneliner && <div className="oe-one">{p.oneliner}</div>}
                <div className="oe-bls">
                  {p.bullets.slice(0, 3).map((b, i) => <i key={i}>{b}</i>)}
                </div>
              </div>
            )
          })}
        </div>

        {/* 选中页详情 */}
        {selPage && (
          <div className="oe-detail">
            <div className="oe-dh"><b>{String(selPage.n).padStart(2, '0')} · {selPage.title}</b>{selPage.role && <span className="oe-role">{roleTag(selPage.role)}</span>}</div>
            {selPage.oneliner && <div className="oe-done">{selPage.oneliner}</div>}
            {selPage.bullets.length > 0 && <ul className="oe-dbl">{selPage.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="oe-acts">
          <button className="btn" onClick={() => respondInterrupt(stream, '请把要点更精简一些，重拟大纲')}>重拟（更精简）</button>
          <button className="btn primary" onClick={() => respondInterrupt(stream, 'OK，确认大纲，继续')}>✓ 确认大纲，继续</button>
        </div>
      </div>
    </div>
  )
}
