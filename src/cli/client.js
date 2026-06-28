export const CLIENT_JS = `
(() => {
  const es = new EventSource('/@imp/events')
  es.onmessage = (e) => { if (e.data === 'reload') location.reload() }

  const queue = []
  let timer = null

  const safe = (v) => {
    try {
      if (v instanceof Error) return v.stack || String(v)
      if (typeof v === 'object') return JSON.stringify(v)
      return String(v)
    } catch {
      return String(v)
    }
  }

  const flush = () => {
    timer = null
    const batch = queue.splice(0)
    if (!batch.length) return
    fetch('/@imp/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batch),
      keepalive: true,
    }).catch(() => {})
  }

  const push = (entry) => {
    queue.push(entry)
    if (!timer) timer = setTimeout(flush, 200)
  }

  for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
    const orig = console[level]
    console[level] = (...args) => {
      orig.apply(console, args)
      push({ type: 'console', level, text: args.map(safe).join(' ') })
    }
  }

  addEventListener('error', (e) => {
    push({ type: 'page', text: \`\${e.message || 'error'} @ \${e.filename || '?'}:\${e.lineno || 0}\` })
  })
  addEventListener('unhandledrejection', (e) => {
    push({ type: 'page', text: \`Unhandled rejection: \${safe(e.reason)}\` })
  })

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/@imp/sw.js', { scope: '/' }).catch(() => {})
  }
})()
`

export const SERVICE_WORKER_JS = `
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

const queue = []
let timer = null

const flush = () => {
  timer = null
  const batch = queue.splice(0)
  if (!batch.length) return
  fetch('/@imp/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(batch),
  }).catch(() => {})
}

const report = (entry) => {
  queue.push(entry)
  if (!timer) timer = setTimeout(flush, 200)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const { url, method } = request
  if (url.includes('/@imp/')) return
  const start = Date.now()
  event.respondWith(
    fetch(request).then((res) => {
      report({ type: 'net', method, url, status: res.status, ms: Date.now() - start })
      return res
    }, (err) => {
      report({ type: 'net', method, url, error: String(err), ms: Date.now() - start })
      throw err
    }),
  )
})
`
