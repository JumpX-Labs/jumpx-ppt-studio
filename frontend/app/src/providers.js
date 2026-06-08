// 模型能力（Providers）前端态 —— BYO-key。
// key 始终存在浏览器 localStorage；local 模式可另存到本机后端（providers.json）。
// shared 模式：key 只在浏览器，按请求带给后端，后端用完即弃。

const LS_KEY = 'jumpx.providers.v1'

export function loadDraft() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
export function saveDraft(d) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d || {})) } catch { /* ignore */ }
}

export async function fetchState() {
  const r = await fetch('/api/providers')
  if (!r.ok) throw new Error('providers ' + r.status)
  return r.json()
}
export async function saveToServer(payload) {
  const r = await fetch('/api/providers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || ('save ' + r.status))
  return d
}
export async function testConn(payload) {
  try {
    const r = await fetch('/api/providers/test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return await r.json()
  } catch (e) {
    return { ok: false, detail: '请求失败：' + e.message }
  }
}

// 出图/生成请求可带上的 ephemeral header（shared 模式用；local 也可用作请求级覆盖）。
export function providerHeader() {
  const d = loadDraft()
  return JSON.stringify({ text: d.text || {}, image: d.image || {} })
}
