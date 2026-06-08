// 模型能力配置页（BYO-key）。
// 文本模型：OpenAI 兼容端点（URL + Key）→ 测试成功后拉模型列表下拉 / 也可手动填。
// 图片：3 个真实 provider（OpenAI GPT Image 2 / 即梦 Seedream / Gemini Nano Banana 2）+ mock 测试。
import React from 'react'
import * as PV from './providers.js'

const IMG = [
  { id: 'openai', name: 'OpenAI · GPT Image 2', model: 'gpt-image-2', sub: 'images.generate' },
  { id: 'jimeng', name: '即梦 · Seedream 4.0', model: 'doubao-seedream-4-0-250828', sub: '火山方舟 ARK · OpenAI 兼容' },
  { id: 'gemini', name: 'Gemini · Nano Banana 2', model: 'gemini-3.1-flash-image', sub: ':generateContent' },
]
const imgDefault = id => (IMG.find(p => p.id === id) || {}).model || ''

function Cap({ on, label }) {
  return <span className={'pv-cap' + (on ? ' on' : '')}><i />{label}<b>{on ? '可用' : '未配置'}</b></span>
}

export function Providers({ onClose }) {
  const [state, setState] = React.useState(null)
  const [draft, setDraft] = React.useState(() => PV.loadDraft())
  const [busy, setBusy] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [msg, setMsg] = React.useState(null)
  const [textModels, setTextModels] = React.useState([])     // 测试成功后拉到的模型
  const [manualModel, setManualModel] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    PV.fetchState().then(s => alive && setState(s)).catch(() => alive && setState(false))
    return () => { alive = false }
  }, [])

  const text = draft.text || {}
  const image = draft.image || { provider: 'openai' }
  function setText(k, v) { const d = { ...draft, text: { ...text, [k]: v } }; setDraft(d); PV.saveDraft(d) }
  function setImage(k, v) { const d = { ...draft, image: { ...image, [k]: v } }; setDraft(d); PV.saveDraft(d) }

  const tenancy = state?.tenancy || 'local'
  const persistAllowed = state === false ? true : (state?.persist_allowed ?? true)
  const textReady = !!text.api_key
  const isReal = ['openai', 'jimeng', 'gemini'].includes(image.provider)
  const imageReady = image.provider === 'mock' || (isReal && !!image.api_key)

  async function test(kind) {
    setBusy(kind); setMsg(null)
    if (kind === 'text') {
      const r = await PV.testConn({ kind: 'text', provider: 'openai', api_key: text.api_key, base_url: text.base_url })
      setBusy('')
      setTextModels(r.models || [])
      setManualModel(!(r.models && r.models.length))
      setMsg({ ok: r.ok, text: '文本模型 · ' + (r.detail || '') })
    } else {
      const r = await PV.testConn({ kind: 'image', provider: image.provider, api_key: image.api_key, model: image.model })
      setBusy('')
      setMsg({ ok: r.ok, text: '图片 · ' + (r.detail || '') })
    }
  }
  async function saveLocal() {
    setSaving(true); setMsg(null)
    try {
      const s = await PV.saveToServer({ text, image })
      setState(s); setMsg({ ok: true, text: '已保存到本机（providers.json，0600，仅本机可读）' })
    } catch (e) { setMsg({ ok: false, text: e.message }) }
    setSaving(false)
  }

  return (
    <div className="pv-back" onClick={onClose}>
      <div className="pv-sheet" onClick={e => e.stopPropagation()}>
        <div className="pv-head">
          <div className="pv-title">模型能力 <span className={'pv-mode pv-mode-' + tenancy}>
            {tenancy === 'local' ? '本机模式' : '公开 / 多租户'}</span></div>
          <button className="btn" onClick={onClose}>关闭</button>
        </div>

        <div className="pv-caps">
          <Cap on label="HTML 生成" />
          <Cap on={textReady} label="文本模型" />
          <Cap on={imageReady} label="AI 图片" />
        </div>

        <p className="pv-note">
          {tenancy === 'local'
            ? 'key 存在你的浏览器；可选「保存到本机」写入后端持久卷（0600，仅本机）。'
            : '公开模式：key 只存在你的浏览器，按请求带给后端、用完即弃，后端不落盘、不记日志。'}
        </p>

        {/* 文本模型：OpenAI 兼容 */}
        <section className="pv-sec">
          <div className="pv-sec-h">文本模型 <span>（OpenAI 兼容端点 · 生成大纲与 HTML 必需）</span></div>
          <label className="pv-f"><span>Base URL</span>
            <input value={text.base_url || ''} placeholder="https://…/v1（OpenAI 兼容）"
                   onChange={e => setText('base_url', e.target.value)} /></label>
          <label className="pv-f"><span>API Key</span>
            <input type="password" value={text.api_key || ''} placeholder="sk-…"
                   onChange={e => setText('api_key', e.target.value)} /></label>
          <label className="pv-f"><span>Model</span>
            {(textModels.length && !manualModel)
              ? <select value={text.model || ''} onChange={e => {
                  if (e.target.value === '__manual__') { setManualModel(true); return }
                  setText('model', e.target.value)
                }}>
                  <option value="" disabled>选择模型…</option>
                  {textModels.map(m => <option key={m} value={m}>{m}</option>)}
                  <option value="__manual__">✎ 手动填写…</option>
                </select>
              : <input value={text.model || ''} placeholder="测试连接后可下拉选择，或手动填写"
                       onChange={e => setText('model', e.target.value)} />}
          </label>
          <div className="pv-row">
            <button className="btn" disabled={busy === 'text'} onClick={() => test('text')}>
              {busy === 'text' ? '测试中…' : '测试连接 · 拉模型'}</button>
            {textModels.length > 0 &&
              <button className="btn ghost" onClick={() => setManualModel(m => !m)}>
                {manualModel ? '改为下拉选择' : '改为手动填写'}</button>}
          </div>
        </section>

        {/* 图片 provider：3 个真实模型 */}
        <section className="pv-sec">
          <div className="pv-sec-h">图片模型 <span>（出图能力 · 不配则只出 HTML）</span></div>
          <div className="pv-providers">
            {IMG.map(p => (
              <button key={p.id}
                className={'pv-prov' + (image.provider === p.id ? ' on' : '')}
                onClick={() => setImage('provider', p.id)}>
                <b>{p.name}</b><span>{p.sub}</span>
              </button>
            ))}
          </div>
          {isReal && <>
            <label className="pv-f"><span>API Key</span>
              <input type="password" value={image.api_key || ''} placeholder="sk-… / ARK key / Gemini key"
                     onChange={e => setImage('api_key', e.target.value)} /></label>
            <label className="pv-f"><span>Model</span>
              <input value={image.model || ''} placeholder={imgDefault(image.provider) + '（留空用默认）'}
                     onChange={e => setImage('model', e.target.value)} /></label>
            <div className="pv-row">
              <button className="btn" disabled={busy === 'image'} onClick={() => test('image')}>
                {busy === 'image' ? '测试中…' : '测试连接'}</button>
              <span className="pv-mini">{image.provider === 'jimeng'
                ? '即梦走火山方舟 ARK key' : image.provider === 'gemini'
                ? 'Google AI Studio key' : 'OpenAI key'}</span>
            </div>
          </>}
          <div className="pv-mockrow">
            <button className={'pv-mock' + (image.provider === 'mock' ? ' on' : '')}
              onClick={() => setImage('provider', image.provider === 'mock' ? 'none' : 'mock')}>
              {image.provider === 'mock' ? '✓ ' : ''}用占位图测试（无需 key）</button>
            {image.provider === 'mock' &&
              <span className="pv-mini">mock 端到端跑通 image-first；有真 key 后切到上面任一即换真图</span>}
          </div>
        </section>

        {msg && <div className={'pv-msg' + (msg.ok ? ' ok' : ' err')}>{msg.text}</div>}

        <div className="pv-foot">
          {persistAllowed
            ? <button className="btn primary" disabled={saving} onClick={saveLocal}>
                {saving ? '保存中…' : '保存到本机'}</button>
            : <span className="pv-foot-note">公开模式不在服务端保存</span>}
          <span className="pv-foot-note">改动已自动存浏览器</span>
        </div>
      </div>
    </div>
  )
}
