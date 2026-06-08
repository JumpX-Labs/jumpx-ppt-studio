// Skill 展示 + 下载 独立页。展示/下载都读同一份运行态（默认配方）→ 天然一致。
import React from 'react'
import { BrandLink } from './Brand.jsx'

const ROLE_DOT = '·'

export function SkillPage({ onClose }) {
  const [data, setData] = React.useState(null)
  const [openRef, setOpenRef] = React.useState(null)   // {file,title}
  const [refText, setRefText] = React.useState('')

  React.useEffect(() => {
    fetch('/api/skill').then(r => r.ok ? r.json() : null).then(setData).catch(() => setData(false))
  }, [])

  React.useEffect(() => {
    if (!openRef) return
    setRefText('加载中…')
    fetch('/api/skill/file/' + openRef.file).then(r => r.ok ? r.text() : '（读取失败）').then(setRefText).catch(() => setRefText('（读取失败）'))
  }, [openRef])

  if (data === null) return <div className="skp"><div className="skp-loading">加载 Skill…</div></div>
  if (data === false) return <div className="skp"><div className="skp-loading">Skill 接口未就绪</div></div>

  const pipeline = (data.pipeline || '').split('→').map(s => s.trim()).filter(Boolean)

  return (
    <div className="skp">
      <div className="skp-top">
        <BrandLink sub="PPT Studio" />
        {onClose && <button className="btn" onClick={onClose}>← 返回</button>}
      </div>

      <div className="skp-wrap">
        {/* Hero */}
        <div className="skp-hero">
          <div className="skp-tag">SKILL · 可装进任意 Agent</div>
          <h1>{data.name} <span className="skp-ver">v{data.version}</span></h1>
          <p className="skp-desc">{data.description}</p>
          <div className="skp-cta">
            <a className="btn primary lg" href={data.download_url} download>⬇ 下载 Skill（.zip）</a>
            <span className="skp-assure">✓ 这份 = 展示的 = Web App 正在跑的，<b>同一份文件</b></span>
          </div>
          <p className="skp-pitch">把它丢进 Claude / 其它 agent，就能复现这里的同款效果——厚内容 + 模型自由设计的版式。</p>
        </div>

        {/* 修好的两点 */}
        <div className="skp-fixes">
          <div className="skp-fix">
            <div className="skp-fix-h">🩻 内容有血肉</div>
            <p>每个要点带支撑层（为什么/数据/例子），讲稿写成 ≥150 字逐字口播稿；资料少也按机制/对比/可执行收束展开，不写薄。</p>
          </div>
          <div className="skp-fix">
            <div className="skp-fix-h">🎨 版式有自主性</div>
            <p>渲染主路径 = 模型按设计 token 直接写 HTML（可自绘图表/示意图），不是填死模板；模板降级为确定性回退。</p>
          </div>
        </div>

        {/* 管线 */}
        <div className="skp-sec-h">生产管线</div>
        <div className="skp-pipe">
          {pipeline.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="skp-arrow">→</span>}
              <span className="skp-step">{s}</span>
            </React.Fragment>
          ))}
        </div>

        {/* 角色文档 */}
        <div className="skp-sec-h">内部角色（点开看指令原文）</div>
        <div className="skp-refs">
          {(data.references || []).map(r => (
            <button key={r.file} className="skp-ref" onClick={() => setOpenRef(r)}>
              <span className="skp-ref-label">{r.label}</span>
              <span className="skp-ref-file">{r.file}</span>
            </button>
          ))}
        </div>

        {/* 资产 */}
        <div className="skp-sec-h">内置资产</div>
        <div className="skp-assets">
          <div className="skp-asset"><b>{data.layouts.length}</b> 种版式 layout<div className="skp-asset-sub">{data.layouts.join(` ${ROLE_DOT} `)}</div></div>
          <div className="skp-asset"><b>{data.style_presets.length}</b> 套风格预设<div className="skp-asset-sub">{data.style_presets.join(` ${ROLE_DOT} `)}</div></div>
          <div className="skp-asset"><b>{data.scripts.length}</b> 个脚本<div className="skp-asset-sub">校验 / 回退渲染 / 图片等</div></div>
        </div>
      </div>

      {/* 角色文档原文 */}
      {openRef && (
        <div className="skp-doc-mask" onClick={() => setOpenRef(null)}>
          <div className="skp-doc" onClick={e => e.stopPropagation()}>
            <div className="skp-doc-h"><b>{openRef.label}</b><span>{openRef.file}</span><span className="skp-sp" /><button className="iconbtn" onClick={() => setOpenRef(null)}>✕</button></div>
            <pre className="skp-doc-body">{refText}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
