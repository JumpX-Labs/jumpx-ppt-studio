import React from 'react'

// JumpX 官网。品牌标 + 官网跳转的唯一真相源。
export const JUMPX_SITE = 'https://jumpxai.vercel.app/'

const EXT = (
  <svg className="brand-ext" viewBox="0 0 24 24" width="11" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
  </svg>
)

// 可点击品牌标 → 跳 JumpX 官网（新标签）。用于顶栏 / Skill 页等带 chrome 的页面。
export function BrandLink({ sub = '', compact = false, onDark = false, className = '' }) {
  const cls = 'brand-link' + (onDark ? ' on-dark' : '') + (className ? ' ' + className : '')
  return (
    <a className={cls} href={JUMPX_SITE} target="_blank" rel="noopener noreferrer"
       title="访问 JumpX 官网 ↗" aria-label="JumpX · 访问官网">
      <img className="brand-mark" src="/jumpx-logo.svg" alt="JumpX" width="24" height="24" />
      {!compact && <span className="brand-word">JumpX{sub && <span className="brand-sub">{sub}</span>}</span>}
      {EXT}
    </a>
  )
}

// 静态品牌标（不可点）→ 用于全屏演示舞台角落，避免演讲中误触跳转。
export function BrandMark({ onDark = false, className = '' }) {
  const cls = 'brand-mark-static' + (onDark ? ' on-dark' : '') + (className ? ' ' + className : '')
  return (
    <span className={cls} aria-label="JumpX">
      <img className="brand-mark" src="/jumpx-logo.svg" alt="JumpX" width="22" height="22" />
      <span className="brand-word">JumpX</span>
    </span>
  )
}
