export const devClient = ({
  eventsEndpoint,
  logEndpoint,
  workerPath,
  telemetryEntries,
  mocks,
  themeEditor,
  themeDraftPrefix,
  themeDraftModule,
}) => {
  const hasThemeDraft = () => {
    try {
      return Object.keys(localStorage).some((key) => key.startsWith(themeDraftPrefix))
    } catch {
      return false
    }
  }
  if (themeEditor && hasThemeDraft()) {
    import(themeDraftModule)
      .then((drafts) => drafts.followAppliedTheme())
      .catch((error) => console.error('imp: the theme draft could not be applied -', error))
  }

  let es = null
  const connect = () => {
    es = new EventSource(eventsEndpoint)
    es.onmessage = (e) => {
      if (e.data === 'reload') location.reload()
    }
  }
  connect()
  addEventListener('pagehide', () => es?.close())
  addEventListener('pageshow', (e) => {
    if (e.persisted) connect()
  })

  const queue = []
  let timer = null
  const kept = []
  const watchers = new Set()

  const keep = (entry) => {
    kept.push(entry)
    if (kept.length > telemetryEntries) kept.shift()
    for (const watcher of watchers) watcher(entry)
  }
  globalThis.__impTelemetry = {
    entries: () => kept.slice(),
    clear: (belongs) => {
      const rest = kept.filter((entry) => !belongs(entry))
      kept.splice(0, kept.length, ...rest)
    },
    watch: (watcher) => {
      watchers.add(watcher)
      return () => watchers.delete(watcher)
    },
  }

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
    fetch(logEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batch),
      keepalive: true,
    }).catch(() => {})
  }

  const send = (entry) => {
    queue.push(entry)
    if (document.visibilityState === 'hidden') {
      clearTimeout(timer)
      flush()
      return
    }
    if (!timer) timer = setTimeout(flush, 200)
  }
  const push = (entry) => {
    keep(entry)
    send(entry)
  }
  globalThis.__impFlushTelemetry = flush

  for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
    const orig = console[level]
    console[level] = (...args) => {
      orig.apply(console, args)
      push({ type: 'console', level, text: args.map(safe).join(' ') })
    }
  }

  addEventListener('error', (e) => {
    push({ type: 'page', text: `${e.message || 'error'} @ ${e.filename || '?'}:${e.lineno || 0}` })
  })
  addEventListener('unhandledrejection', (e) => {
    push({ type: 'page', text: `Unhandled rejection: ${safe(e.reason)}` })
  })

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.imp === 'telemetry') keep(event.data.entry)
    })
    if (workerPath) {
      navigator.serviceWorker
        .register(workerPath, { scope: '/' })
        .catch((error) => console.error('imp: the dev service worker failed to start -', error))
    }

    if (mocks && !navigator.serviceWorker.controller) {
      const network = globalThis.fetch
      let missed = false
      globalThis.fetch = (...args) => {
        const target = String(args[0]?.url ?? args[0] ?? '')
        if (!target.includes('/@imp/') && !navigator.serviceWorker.controller) missed = true
        return network.apply(globalThis, args)
      }
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => {
          globalThis.fetch = network
          if (missed) location.reload()
        },
        { once: true },
      )
    }
  }
}
