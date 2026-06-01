// 连 LangGraph server（生成 agent，slides_agent）的流 —— 复用 deep-agents-ui 的 useStream 范式。
import { useStream } from '@langchain/langgraph-sdk/react'

// SDK 要求 apiUrl 为绝对地址；用同源 + /lg（仍走 vite 代理 → :2024）
const LG_URL = (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5180') + '/lg'

export function useAgent() {
  return useStream({
    apiUrl: LG_URL,
    assistantId: 'slides_agent',
    reconnectOnMount: true,
  })
}

// 解析当前中断：返回 { name, args, description } 或 null
export function readInterrupt(stream) {
  const it = stream && stream.interrupt
  if (!it) return null
  const v = it.value !== undefined ? it.value : it
  const ar = v && v.action_requests && v.action_requests[0]
  if (!ar) return { name: 'unknown', args: {}, description: typeof v === 'string' ? v : '' }
  return { name: ar.name, args: ar.args || {}, description: ar.description || '' }
}

// respond 恢复：把用户的选择当作该工具的结果回灌
export function respondInterrupt(stream, message) {
  stream.submit(null, { command: { resume: { decisions: [{ type: 'respond', message: String(message) }] } } })
}

// 把主题 + 篇幅/受众/语气 + 参考资料拼成结构化消息（skill 的 Intake/Context Pack 会吸收）
export function composeBrief(topic, opts = {}) {
  const lines = [String(topic || '').trim()]
  const meta = []
  if (opts.len) meta.push('篇幅：' + opts.len)
  if (opts.aud) meta.push('受众：' + opts.aud)
  if (opts.tone) meta.push('语气：' + opts.tone)
  if (meta.length) lines.push(meta.join('　'))
  if (opts.style) lines.push(`指定视觉风格：${opts.style}（已从参考图导入，请在 Design 阶段用此 style_name）`)
  const mat = (opts.material || '').trim()
  if (mat) lines.push('\n【参考资料 · 请吸收进 Context Pack 作为内容来源，引用其中的事实/数据/例子】\n' + mat)
  return lines.join('\n')
}

export function startRun(stream, topic, opts = {}) {
  stream.submit(
    { messages: [{ type: 'human', content: composeBrief(topic, opts) }] },
    { config: { recursion_limit: 100 } }
  )
}

// 产物路径：build_slides_html 直接写真实磁盘（不走虚拟 write_file），
// 所以优先从最后的 AI 文本里抓 index.html 路径，再回退虚拟文件。
export function findOutputPath(stream) {
  const msgs = (stream && stream.messages) || []
  for (const m of [...msgs].reverse()) {
    if (m.type !== 'ai' && m.role !== 'assistant') continue
    const c = typeof m.content === 'string' ? m.content : ''
    const mm = c.match(/[^\s`'"（）()]*index\.html/)
    if (mm) return mm[0]
  }
  const files = (stream && stream.values && stream.values.files) || {}
  const k = Object.keys(files).find(x => x.endsWith('index.html'))
  return k || null
}

// run id：从产物路径 /runs/<id>/index.html 抽 <id>（用于拉缩略图 / 内嵌预览）
export function findRunId(stream) {
  const p = findOutputPath(stream)
  if (!p) return null
  const m = p.match(/runs\/([^/]+)\/index\.html/)
  return m ? m[1] : null
}

// run slug：从任意消息里的 runs/<slug>/ 路径提取（生成中即可拿到，早于 findRunId）
export function findRunSlug(stream) {
  const msgs = (stream && stream.messages) || []
  for (const m of [...msgs].reverse()) {
    let s = ''
    try { s = typeof m.content === 'string' ? m.content : JSON.stringify(m) } catch { s = '' }
    const mm = s.match(/runs[\\/]+([A-Za-z0-9_-]+)[\\/]/)
    if (mm) return mm[1]
  }
  return null
}

// 页数：优先虚拟 slide_plan.json，回退从 AI 文本里抓「N 页」
export function findPageCount(stream) {
  const files = (stream && stream.values && stream.values.files) || {}
  const k = Object.keys(files).find(x => x.endsWith('slide_plan.json'))
  if (k) { try { const p = JSON.parse(files[k]); if (Array.isArray(p.pages)) return p.pages.length } catch { } }
  const msgs = (stream && stream.messages) || []
  for (const m of [...msgs].reverse()) {
    if (m.type !== 'ai' && m.role !== 'assistant') continue
    const c = typeof m.content === 'string' ? m.content : ''
    const mm = c.match(/(\d+)\s*页/)
    if (mm) return parseInt(mm[1], 10)
  }
  return 0
}

// 运行是否已完成（产物已出，或 todos 全完成且非加载/非中断）
export function runFinished(stream) {
  if (findOutputPath(stream)) return true
  const todos = (stream && stream.values && stream.values.todos) || []
  return todos.length > 0 && todos.every(t => t.status === 'completed') && !stream.isLoading && !stream.interrupt
}
