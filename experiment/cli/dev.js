// `imp dev` — static file server over the current directory with live reload
// (Deno.watchFs → SSE) and the browser→CLI telemetry bridge. No bundling, no
// transforms: files are served as-is (buildless). History-API fallback: an
// extension-less 404 serves index.html so client routing works on refresh.

import { extname, join, normalize } from 'jsr:@std/path@^1'
import { DEV_CLIENT_JS } from './dev_client.js'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
}

const dim = (s) => `\x1b[2m${s}\x1b[0m`
const colorOf = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  log: '\x1b[2m',
  debug: '\x1b[2m',
}

function printEntry(e) {
  if (e.type === 'console') {
    const c = colorOf[e.level] ?? ''
    console.log(`${c}[browser:${e.level}]\x1b[0m ${e.text}`)
  } else if (e.type === 'page') {
    console.log(`\x1b[31m[browser:uncaught]\x1b[0m ${e.text}`)
  } else if (e.type === 'net') {
    const status = e.error
      ? `\x1b[31m${e.error}\x1b[0m`
      : e.status >= 400
      ? `\x1b[31m${e.status}\x1b[0m`
      : `\x1b[32m${e.status}\x1b[0m`
    console.log(`${dim('[net]')} ${e.method} ${e.url} → ${status} ${dim(e.ms + 'ms')}`)
  }
}

const INJECT = '<script type="module" src="/@imp/client.js"></script>'

function injectClient(htmlText) {
  if (htmlText.includes('/@imp/client.js')) return htmlText
  if (htmlText.includes('</body>')) return htmlText.replace('</body>', INJECT + '\n</body>')
  return htmlText + '\n' + INJECT
}

export function dev({ root = Deno.cwd(), port = 4507, quiet = false, startPath = '/' } = {}) {
  const clients = new Set()

  const broadcast = (msg) => {
    for (const controller of clients) {
      try {
        controller.enqueue(new TextEncoder().encode(`data: ${msg}\n\n`))
      } catch {
        clients.delete(controller)
      }
    }
  } // file watcher → debounced reload
  ;(async () => {
    let timer = null
    for await (const event of Deno.watchFs(root)) {
      if (event.paths.every((p) => /[/\\](\.git|node_modules|dist)[/\\]/.test(p))) continue
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!quiet) console.log(dim('[imp] change detected → reload'))
        broadcast('reload')
      }, 80)
    }
  })()

  async function serveFile(pathname) {
    let path = decodeURIComponent(pathname)
    if (path.endsWith('/')) path += 'index.html'
    const fsPath = normalize(join(root, path))
    if (!fsPath.startsWith(normalize(root))) return new Response('forbidden', { status: 403 })
    let file
    try {
      const stat = await Deno.stat(fsPath)
      if (stat.isDirectory) {
        return new Response(null, { status: 302, headers: { location: path + '/' } })
      }
      file = await Deno.readFile(fsPath)
    } catch {
      // History-API fallback for extension-less SPA routes
      if (!extname(path)) {
        try {
          const index = await Deno.readTextFile(join(root, 'index.html'))
          return new Response(injectClient(index), { headers: { 'content-type': TYPES['.html'] } })
        } catch { /* no index.html either */ }
      }
      return new Response('not found: ' + path, { status: 404 })
    }
    const type = TYPES[extname(fsPath).toLowerCase()] ?? 'application/octet-stream'
    if (extname(fsPath).toLowerCase() === '.html') {
      return new Response(injectClient(new TextDecoder().decode(file)), {
        headers: { 'content-type': type },
      })
    }
    return new Response(file, { headers: { 'content-type': type } })
  }

  const server = Deno.serve({
    port,
    onListen: ({ port }) => {
      console.log(`\x1b[1mimp dev\x1b[0m serving ${root}`)
      console.log(`  → http://localhost:${port}${startPath}`)
      console.log(dim('  live reload + browser telemetry active'))
    },
  }, async (req) => {
    const url = new URL(req.url)
    if (url.pathname === '/@imp/client.js') {
      return new Response(DEV_CLIENT_JS, { headers: { 'content-type': TYPES['.js'] } })
    }
    if (url.pathname === '/@imp/events') {
      let ctrl
      const body = new ReadableStream({
        start(controller) {
          ctrl = controller
          clients.add(controller)
          controller.enqueue(new TextEncoder().encode(': connected\n\n'))
        },
        cancel() {
          clients.delete(ctrl)
        },
      })
      return new Response(body, {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-store',
        },
      })
    }
    if (url.pathname === '/@imp/log' && req.method === 'POST') {
      try {
        const entries = await req.json()
        if (!quiet) { for (const e of entries) printEntry(e) }
      } catch { /* malformed batch — ignore */ }
      return new Response('ok')
    }
    return serveFile(url.pathname)
  })

  return server.finished
}
