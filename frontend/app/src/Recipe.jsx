// 配方页（叙事 + 人格画廊）+ 编辑器（简洁旋钮 / 进阶 Markdown）——接真 recipe_api。
import React, { useState, useEffect, useRef } from 'react'
import { SKILL_FILES, RECIPES_FALLBACK } from './data.js'

const API = '/api'
const j = (r) => r.json()
const api = {
  list: () => fetch(`${API}/recipes`).then(j),
  get: (id) => fetch(`${API}/recipes/${encodeURIComponent(id)}`).then(j),
  save: (id, body) => fetch(`${API}/recipes/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(j),
  fork: (id, name) => fetch(`${API}/recipes/${encodeURIComponent(id)}/fork`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) }).then(j),
  setActive: (id) => fetch(`${API}/recipes/active`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }).then(j),
  importZip: (buf, name) => fetch(`${API}/recipes/import?name=${encodeURIComponent(name || '')}`, { method: 'POST', headers: { 'content-type': 'application/zip' }, body: buf }).then(j),
  exportUrl: (id) => `${API}/recipes/${encodeURIComponent(id)}/export`,
}

const RC_IC = {
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>,
  fork: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="19" r="2.5" /><path d="M6 8.5v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-3M12 14.5v2" /></svg>,
  dl: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>,
  up: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21V9M7 14l5-5 5 5M5 3h14" /></svg>,
  pen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  reload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" /></svg>,
}
const NARRATIVES = ['默认弧', '先抛结论', '教学递进', '故事化']
const VOICES = ['干练清晰', '亲切', '理性·结论先行', '温润·叙事', '学术']
const ABSORBS = ['忠实原文', '自由重组', '数据优先']
const DENSITY = ['精简', '适中', '详尽']
const LOCKED = SKILL_FILES.filter(f => f.kind === 'locked')

function RecipeEditor({ id, onBack }) {
  const [tab, setTab] = useState('knobs')
  const [m, setM] = useState(null)            // manifest
  const [files, setFiles] = useState({})      // 可改文件 {path: content}
  const [selPath, setSelPath] = useState('references/05-writer.md')
  const [selLocked, setSelLocked] = useState(null)
  const [status, setStatus] = useState(null)

  useEffect(() => { api.get(id).then(d => { setM(d.manifest); setFiles(d.editable || {}) }) }, [id])
  if (!m) return <div className="rcp-scroll" style={{ padding: 40, color: 'var(--ink-3)' }}>加载配方…</div>

  const setMeta = (k, v) => { setM({ ...m, [k]: v }); setStatus(null) }
  const absorb = Array.isArray(m.absorb) ? m.absorb : []
  const toggleAbsorb = v => setMeta('absorb', absorb.includes(v) ? absorb.filter(x => x !== v) : [...absorb, v])
  const setFile = (path, content) => { setFiles({ ...files, [path]: content }); setStatus(null) }

  async function save() {
    setStatus('checking')
    const r = await api.save(id, {
      name: m.name, density: m.density, voice: m.voice, narrative: m.narrative,
      absorb: m.absorb, persona: m.persona, files,
    })
    setStatus(r.validate && r.validate.ok ? 'ok' : 'fail')
  }

  const editPaths = Object.keys(files)
  const sel = selLocked ? LOCKED.find(f => f.path === selLocked) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="rcp-ehead">
        <span className="back" onClick={onBack}>{RC_IC.back} 配方</span>
        <span className="nm">{m.name || '未命名配方'}</span>
        <span className="scope">改配方影响之后开始的 Slides · 当前这份不受影响</span>
        <div className="rcp-tabs">
          <span className={'rcp-tab' + (tab === 'knobs' ? ' on' : '')} onClick={() => setTab('knobs')}>简洁</span>
          <span className={'rcp-tab' + (tab === 'adv' ? ' on' : '')} onClick={() => setTab('adv')}>进阶 · Markdown</span>
        </div>
      </div>

      <div className="rcp-scroll">
        {tab === 'knobs' ? (
          <div className="knobs">
            <div className="knob"><div className="kl">配方名</div>
              <input className="tx" value={m.name || ''} onChange={e => setMeta('name', e.target.value)} /></div>
            <div className="knob"><div className="kl">背景知识 <span>这个配方"懂什么"——自带的领域脑子</span></div>
              <textarea className="bg" value={files['references/background.md'] ?? ''} onChange={e => setFile('references/background.md', e.target.value)} /></div>
            <div className="knob"><div className="kl">叙事结构</div>
              <div className="kchips">{NARRATIVES.map(n => <span key={n} className={'kchip' + (m.narrative === n ? ' on' : '')} onClick={() => setMeta('narrative', n)}>{n}</span>)}</div></div>
            <div className="knob"><div className="kl">写作语气 / 风格</div>
              <div className="kchips">{VOICES.map(n => <span key={n} className={'kchip' + (m.voice === n ? ' on' : '')} onClick={() => setMeta('voice', n)}>{n}</span>)}</div></div>
            <div className="knob"><div className="kl">素材吸收 <span>可多选</span></div>
              <div className="kchips">{ABSORBS.map(n => <span key={n} className={'kchip' + (absorb.includes(n) ? ' on' : '')} onClick={() => toggleAbsorb(n)}>{n}</span>)}</div></div>
            <div className="knob"><div className="kl">厚薄</div>
              <div className="kslider"><div className="kseg">{DENSITY.map((d, i) => <span key={d} className={'s' + (m.density === i ? ' on' : '')} onClick={() => setMeta('density', i)}>{d}</span>)}</div></div></div>
          </div>
        ) : (
          <div className="sk-body" style={{ height: '100%' }}>
            <div className="sk-tree">
              <div className="sk-skillname"><span className="n">{m.name}</span><span className="v">进阶 · 直接改指令</span></div>
              <div className="sk-group">配方 · 可改</div>
              {editPaths.map(p => (
                <div key={p} className={'sk-file' + (!selLocked && p === selPath ? ' sel' : '')} onClick={() => { setSelPath(p); setSelLocked(null) }}>
                  <span className="fn">{p}</span><span className="sk-badge edit">{RC_IC.pen}可改</span>
                </div>
              ))}
              <div className="sk-group">契约 / 机制 · 锁定</div>
              {LOCKED.map(f => (
                <div key={f.path} className={'sk-file locked' + (selLocked === f.path ? ' sel' : '')} onClick={() => setSelLocked(f.path)}>
                  <span className="fn">{f.label}</span><span className="sk-badge lock">{RC_IC.lock}锁定</span>
                </div>
              ))}
            </div>
            <div className="sk-editor">
              <div className="sk-ed-head">
                <div className="fp">{selLocked || selPath}</div>
                {selLocked
                  ? <div className="note lk">{RC_IC.lock} 锁定：{sel && sel.why}</div>
                  : <div className="note">{RC_IC.pen} 可改。影响之后所有生成（不影响当前这份）。</div>}
              </div>
              <div className="sk-ed-area">
                {selLocked
                  ? <pre className="locked">{sel && sel.body}</pre>
                  : <textarea value={files[selPath] ?? ''} onChange={e => setFile(selPath, e.target.value)} spellCheck={false} />}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rcp-foot">
        {status === 'checking' && <span className="status checking"><span className="ring" />契约体检中 · 保存 + 校验…</span>}
        {status === 'ok' && <span className="status ok">{RC_IC.check}已保存 · 下次生成生效</span>}
        {status === 'fail' && <span className="status fail">{RC_IC.x}校验未过（见进阶层）</span>}
        <div className="right">
          <a className="btn" href={api.exportUrl(id)} download>{RC_IC.dl} 下载配方</a>
          <button className="btn primary" onClick={save}>{RC_IC.reload} 保存并重新加载</button>
        </div>
      </div>
    </div>
  )
}

function RecipeHub({ onClose }) {
  const [recipes, setRecipes] = useState(null)
  const [active, setActive] = useState('default')
  const [editing, setEditing] = useState(null)
  const [offline, setOffline] = useState(false)
  const fileRef = useRef()

  function refresh() {
    api.list().then(d => { setRecipes(d.recipes || []); setActive(d.active); setOffline(false) })
      .catch(() => { setRecipes(RECIPES_FALLBACK); setOffline(true) })
  }
  useEffect(refresh, [])

  async function onUpload(e) {
    const f = e.target.files[0]; if (!f) return
    const buf = await f.arrayBuffer()
    await api.importZip(buf, f.name.replace(/\.zip$/, ''))
    refresh()
  }

  const list = recipes || []
  return (
    <div className="skills-overlay" onClick={onClose}>
      <div className="recipe-modal" onClick={e => e.stopPropagation()}>
        {editing ? (
          <RecipeEditor id={editing} onBack={() => { setEditing(null); refresh() }} />
        ) : (
          <div className="rcp-scroll">
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 18px 0' }}>
              <button className="iconbtn" onClick={onClose}>{RC_IC.x}</button>
            </div>
            <div className="rcp-hero">
              <div className="ey">配方 · Recipes{offline ? ' · (离线示例)' : ''}</div>
              <h2>一个配方，就是<span className="hl">一个会写某类 deck 的"脑子"</span></h2>
              <p>它不是模板，而是一种<b>人格</b>：懂某个领域的背景、用某种风格叙事、写到某种厚薄。换个配方，就像换一位帮你写 slides 的专家——内容怎么来、为什么这么写，全由它决定，而你可以查看、调整，甚至上传别人的配方，本地生效。</p>
              <div className="formula">
                <span className="fx">📚 领域背景</span><span className="op">×</span>
                <span className="fx">✍️ 叙事风格</span><span className="op">×</span>
                <span className="fx">📏 厚薄</span><span className="op">=</span>
                <span className="fx" style={{ background: 'var(--pine)', color: '#fff', borderColor: 'var(--pine)' }}>一个人格化配方</span>
              </div>
            </div>
            <div className="rcp-bar">
              <span className="t">配方库 · 本地</span><span className="sp" />
              <input ref={fileRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={onUpload} />
              <button className="btn" onClick={() => fileRef.current && fileRef.current.click()}>{RC_IC.up} 上传配方（.zip）</button>
            </div>
            <div className="rcp-grid">
              {list.map(r => {
                const on = active === r.id
                const dens = DENSITY[r.density] || r.density || '适中'
                const doms = Array.isArray(r.domain) ? r.domain : []
                return (
                  <div key={r.id} className={'rcard' + (on ? ' active' : '')}>
                    <div className="rtop"><span className="nm">{r.name}</span><span className="tag">{r.tag || '我的'}</span></div>
                    <div className="persona">{r.persona || '—'}</div>
                    <div className="chips2">{doms.map(d => <span key={d} className="dchip">{d}</span>)}</div>
                    <div className="meta"><span>风格 <b>{r.voice || '—'}</b></span><span>厚薄 <b>{dens}</b></span></div>
                    <div className="racts">
                      {on
                        ? <span className="activeflag">{RC_IC.check} 当前使用</span>
                        : <button className="use" onClick={() => api.setActive(r.id).then(refresh)}>选用</button>}
                      <button onClick={() => setEditing(r.id)}>{RC_IC.pen} 编辑</button>
                      <button className="icn" title="复制改一份（fork）" onClick={() => api.fork(r.id, r.name).then(d => d.id && setEditing(d.id))}>{RC_IC.fork}</button>
                      <a className="icn" title="下载 .zip" href={api.exportUrl(r.id)} download>{RC_IC.dl}</a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export { RecipeHub }
