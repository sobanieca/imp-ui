// The script `imp dev` injects into served HTML pages. Two jobs:
//   1. live reload over SSE,
//   2. browser → CLI telemetry: console output, page errors, and network
//      activity are batched back to the dev server, so an AI agent can read
//      runtime behavior straight from the terminal (essence #20).
// Exported as a string so `deno compile` embeds it in the binary.

export const DEV_CLIENT_JS = `
(() => {
  var es = new EventSource('/@imp/events')
  es.onmessage = function (e) { if (e.data === 'reload') location.reload() }

  var queue = []
  var timer = null
  function safe(v) {
    try {
      if (v instanceof Error) return v.stack || String(v)
      if (typeof v === 'object') return JSON.stringify(v)
      return String(v)
    } catch (_) { return String(v) }
  }
  function flush() {
    timer = null
    var batch = queue.splice(0)
    if (!batch.length) return
    fetch('/@imp/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batch),
      keepalive: true,
    }).catch(function () {})
  }
  function push(entry) {
    queue.push(entry)
    if (!timer) timer = setTimeout(flush, 300)
  }

  var levels = ['log', 'info', 'warn', 'error', 'debug']
  for (var i = 0; i < levels.length; i++) {
    (function (level) {
      var orig = console[level]
      console[level] = function () {
        var args = [].slice.call(arguments)
        orig.apply(console, args)
        push({ type: 'console', level: level, text: args.map(safe).join(' ') })
      }
    })(levels[i])
  }

  window.addEventListener('error', function (e) {
    push({ type: 'page', text: (e.message || 'error') + ' @ ' + (e.filename || '?') + ':' + (e.lineno || 0) })
  })
  window.addEventListener('unhandledrejection', function (e) {
    push({ type: 'page', text: 'Unhandled rejection: ' + safe(e.reason) })
  })

  var origFetch = window.fetch
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input)
    if (url.indexOf('/@imp/') !== -1) return origFetch.apply(window, arguments)
    var method = (init && init.method) || (input && input.method) || 'GET'
    var start = Date.now()
    return origFetch.apply(window, arguments).then(function (res) {
      push({ type: 'net', method: method, url: url, status: res.status, ms: Date.now() - start })
      return res
    }, function (err) {
      push({ type: 'net', method: method, url: url, error: String(err), ms: Date.now() - start })
      throw err
    })
  }
})()
`;
