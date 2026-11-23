export const devClient = ({
  eventsEndpoint,
  logEndpoint,
  workerPath,
  telemetryEntries,
  mocks,
  themeEditor,
  themeDraftPrefix,
  themeDraftModule,
  previewFrameNamePrefix,
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
  if (!globalThis.name.startsWith(previewFrameNamePrefix)) {
    connect()
    addEventListener('pagehide', () => es?.close())
    addEventListener('pageshow', (e) => {
      if (e.persisted) connect()
    })
  }

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

  const isErrorLike = (v) =>
    v instanceof Error || (typeof v?.message === 'string' && typeof v?.stack === 'string')

  const describeError = (error) => {
    const head = String(error)
    const stack = error.stack ?? ''
    const full = stack.startsWith(head) ? stack : [head, stack].filter(Boolean).join('\n')
    return error.cause === undefined ? full : `${full}\nCaused by: ${safe(error.cause)}`
  }

  const errorFields = (key, value) =>
    isErrorLike(value) ? { name: value.name, message: value.message } : value

  const safe = (v) => {
    try {
      if (isErrorLike(v)) return describeError(v)
      if (typeof v === 'object' && v !== null) return JSON.stringify(v, errorFields) ?? String(v)
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
    const where = `@ ${e.filename || '?'}:${e.lineno || 0}`
    const text = isErrorLike(e.error)
      ? `${safe(e.error)}\n${where}`
      : `${e.message || 'error'} ${where}`
    push({ type: 'page', text })
  })
  addEventListener('unhandledrejection', (e) => {
    push({ type: 'page', text: `Unhandled rejection: ${safe(e.reason)}` })
  })

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.imp === 'telemetry') keep(event.data.entry)
    })
    // Until a worker controls the page, a fetch would skip the mocks. Hold it until one does.
    let release = () => {}
    if (mocks && !navigator.serviceWorker.controller) {
      const network = globalThis.fetch
      let open
      const controlled = new Promise((resolve) => (open = resolve))
      release = () => {
        if (!open) return
        globalThis.fetch = network
        open()
        open = null
      }
      globalThis.fetch = (...args) => {
        const target = String(args[0]?.url ?? args[0] ?? '')
        if (target.includes('/@imp/') || navigator.serviceWorker.controller) {
          return network.apply(globalThis, args)
        }
        return controlled.then(() => network.apply(globalThis, args))
      }
      navigator.serviceWorker.addEventListener('controllerchange', release, { once: true })
      setTimeout(() => {
        if (navigator.serviceWorker.controller) return
        console.warn('imp: no service worker controls the page, so its requests skip the mocks')
        release()
      }, 5000)
    }

    if (workerPath) {
      navigator.serviceWorker.register(workerPath, { scope: '/' }).catch((error) => {
        console.error('imp: the dev service worker failed to start -', error)
        release()
      })
    }
  }
}
