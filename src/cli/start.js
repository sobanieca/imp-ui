import { basename, dirname, extname, fromFileUrl, join, normalize, resolve } from '@std/path'
import { CLIENT_JS, SERVICE_WORKER_JS } from './client.js'
import { loadImpConfig } from './config.js'

const FRAMEWORK_SRC = fromFileUrl(new URL('..', import.meta.url))

const CONTENT_TYPES = {
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
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
}

const dim = (s) => `\x1b[2m${s}\x1b[0m`
const consoleColor = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  log: '\x1b[2m',
  debug: '\x1b[2m',
}

function printEntry(entry) {
  if (entry.type === 'console') {
    const color = consoleColor[entry.level] ?? ''
    console.log(`${color}[browser:${entry.level}]\x1b[0m ${entry.text}`)
  } else if (entry.type === 'page') {
    console.log(`\x1b[31m[browser:uncaught]\x1b[0m ${entry.text}`)
  } else if (entry.type === 'net') {
    const status = entry.error
      ? `\x1b[31m${entry.error}\x1b[0m`
      : entry.status >= 400
      ? `\x1b[31m${entry.status}\x1b[0m`
      : `\x1b[32m${entry.status}\x1b[0m`
    console.log(`${dim('[net]')} ${entry.method} ${entry.url} → ${status} ${dim(entry.ms + 'ms')}`)
  }
}

const INJECTION_MARKER = '/@imp/imp.js'

const dependencyBundlePath = (alias) => `/dependencies/${alias}/${alias}.js`

function dependencyImports(dependencies) {
  return Object.fromEntries(
    Object.keys(dependencies).map((alias) => [alias, dependencyBundlePath(alias)]),
  )
}

function buildHeadInjection(dependencies) {
  const importMap = { imports: { imp: '/@imp/imp.js', ...dependencyImports(dependencies) } }
  return `<script>${CLIENT_JS}</script>\n<script type="importmap">${
    JSON.stringify(importMap)
  }</script>`
}

export function injectImp(html, headInjection) {
  if (html.includes(INJECTION_MARKER)) return html
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}\n${headInjection}`)
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (open) => `${open}\n<head>${headInjection}</head>`)
  }
  return `${headInjection}\n${html}`
}

function contentType(path) {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

async function serveFromDir(dir, relativePath, { headInjection = null } = {}) {
  let path = decodeURIComponent(relativePath)
  if (path.endsWith('/')) path += 'index.html'
  const fsPath = normalize(join(dir, path))
  if (!fsPath.startsWith(normalize(dir))) return new Response('forbidden', { status: 403 })
  let bytes
  try {
    const stat = await Deno.stat(fsPath)
    if (stat.isDirectory) {
      return new Response(null, { status: 302, headers: { location: path + '/' } })
    }
    bytes = await Deno.readFile(fsPath)
  } catch {
    return new Response('not found: ' + path, { status: 404 })
  }
  const type = contentType(fsPath)
  const extension = extname(fsPath).toLowerCase()
  if (headInjection && extension === '.html') {
    return new Response(injectImp(new TextDecoder().decode(bytes), headInjection), {
      headers: { 'content-type': type },
    })
  }
  return new Response(bytes, { headers: { 'content-type': type } })
}

export async function start({ entry = 'index.html', port = 4507 } = {}) {
  const entryPath = resolve(entry)
  let entryStat
  try {
    entryStat = await Deno.stat(entryPath)
  } catch {
    console.error(`imp start: file not found: ${entry}`)
    Deno.exit(1)
  }
  if (entryStat.isDirectory) {
    console.error(`imp start: expected an HTML file, got a directory: ${entry}`)
    Deno.exit(1)
  }

  const root = dirname(entryPath)
  const entryName = basename(entryPath)
  const imp = await loadImpConfig(root)
  const dependencies = imp.dependencies ?? {}
  const headInjection = buildHeadInjection(dependencies)
  const clients = new Set()

  for (const alias of Object.keys(dependencies)) {
    try {
      await Deno.stat(join(root, 'dependencies', alias, `${alias}.js`))
    } catch {
      console.log(
        `\x1b[33m[imp] dependency '${alias}' is declared but not vendored — run 'imp install'\x1b[0m`,
      )
    }
  }

  const broadcast = (message) => {
    const payload = new TextEncoder().encode(`data: ${message}\n\n`)
    for (const controller of clients) {
      try {
        controller.enqueue(payload)
      } catch {
        clients.delete(controller)
      }
    }
  }
  ;(async () => {
    let timer = null
    for await (const event of Deno.watchFs(root)) {
      if (event.paths.every((p) => /[/\\](\.git|node_modules|dist)[/\\]/.test(p))) continue
      clearTimeout(timer)
      timer = setTimeout(() => {
        console.log(dim('[imp] change detected → reload'))
        broadcast('reload')
      }, 80)
    }
  })()

  const server = Deno.serve({
    port,
    onListen: ({ port }) => {
      console.log(`\x1b[1mimp start\x1b[0m serving ${entryName} from ${root}`)
      console.log(`  → http://localhost:${port}/`)
      console.log(dim('  imp auto-injected · live reload · console + network telemetry'))
    },
  }, async (req) => {
    const url = new URL(req.url)

    if (url.pathname === '/@imp/events') {
      let controller
      const body = new ReadableStream({
        start(c) {
          controller = c
          clients.add(c)
          c.enqueue(new TextEncoder().encode(': connected\n\n'))
        },
        cancel() {
          clients.delete(controller)
        },
      })
      return new Response(body, {
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' },
      })
    }

    if (url.pathname === '/@imp/log' && req.method === 'POST') {
      try {
        const entries = await req.json()
        for (const entry of entries) printEntry(entry)
      } catch { /* malformed batch */ }
      return new Response('ok')
    }

    if (url.pathname === '/@imp/sw.js') {
      return new Response(SERVICE_WORKER_JS, {
        headers: {
          'content-type': CONTENT_TYPES['.js'],
          'service-worker-allowed': '/',
          'cache-control': 'no-store',
        },
      })
    }

    if (url.pathname.startsWith('/@imp/')) {
      return serveFromDir(FRAMEWORK_SRC, url.pathname.slice('/@imp/'.length))
    }

    if (url.pathname === '/' || url.pathname === '/' + entryName) {
      return serveFromDir(root, '/' + entryName, { headInjection })
    }

    return serveFromDir(root, url.pathname, { headInjection })
  })

  return server.finished
}
