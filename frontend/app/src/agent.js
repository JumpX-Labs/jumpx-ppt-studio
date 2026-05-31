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

export function startRun(stream, topic) {
  stream.submit(
    { messages: [{ type: 'human', content: topic }] },
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
