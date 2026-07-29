import {
  basename,
  dirname,
  extname,
  fromFileUrl,
  join,
  normalize,
  relative,
  resolve,
} from '@std/path'
import { clientScript, serviceWorkerScript } from './client.js'
import { loadImpConfig, mocksSetting } from './config.js'
import { createMockBundler } from './mocks.js'
import { envInjectionScript, resolveEnvironment } from './environments.js'
import { dim, green, red } from './colors.js'
import { addLogSink, logger } from './logger.js'
import { createDevLog, DEFAULT_MAX_LOG_ENTRIES } from './dev_log.js'
import { APPLE_TOUCH_ICON, buildManifest, pwaHeadTags, renderIconSet } from './pwa.js'
import { IMP_SUBPATH_MODULES } from './specifiers.js'

const FRAMEWORK_SRC = fromFileUrl(new URL('../../lib/src', import.meta.url))

const DEFAULT_DEV_SERVER_PORT = 4507

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

function printEntry(entry) {
  if (entry.type === 'console') {
    logger.browser(entry.level, entry.text)
  } else if (entry.type === 'page') {
    logger.browser('uncaught', entry.text)
  } else if (entry.type === 'net') {
    const status = entry.error
      ? red(entry.error)
      : entry.status >= 400
      ? red(entry.status)
      : green(entry.status)
    const from = entry.mock ? dim(` (mock: ${entry.mock})`) : ''
    logger.http(`${entry.method} ${entry.url} → ${status} ${dim(entry.ms + 'ms')}${from}`)
  }
}

const INJECTION_MARKER = '/@imp/imp.js'

const dependencyBundlePath = (alias) => `/dependencies/${alias}/${alias}.js`

function dependencyImports(dependencies) {
  return Object.fromEntries(
    Object.keys(dependencies).map((alias) => [alias, dependencyBundlePath(alias)]),
  )
}

const impSubpathImports = () =>
  Object.fromEntries(
    Object.entries(IMP_SUBPATH_MODULES).map(([subpath, module]) => [subpath, `/@imp/${module}`]),
  )

const DEV_MANIFEST_PATH = '/@imp/manifest.webmanifest'
const DEV_ICON_PREFIX = '/@imp/pwa/'

function buildHeadInjection(dependencies, pwa, env, mocks) {
  const importMap = {
    imports: {
      imp: '/@imp/imp.js',
      ...impSubpathImports(),
      ...dependencyImports(dependencies),
    },
  }
  const pwaTags = pwa
    ? '\n' + pwaHeadTags({
      manifestHref: DEV_MANIFEST_PATH,
      themeColor: pwa.themeColor,
      appleTouchHref: DEV_ICON_PREFIX + APPLE_TOUCH_ICON,
    })
    : ''
  const envTag = envInjectionScript(env)
  return `<script>${clientScript({ mocks })}</script>\n${
    envTag ? envTag + '\n' : ''
  }<script type="importmap">${JSON.stringify(importMap)}</script>${pwaTags}`
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

export async function loadApp(entryPath, { envAlias = null, mocks = null } = {}) {
  const root = dirname(entryPath)
  const entryName = basename(entryPath)
  const imp = await loadImpConfig(root)
  const dependencies = imp.dependencies ?? {}
  const pwa = imp.pwa ?? null
  const env = await resolveEnvironment({ root, config: imp, requestedAlias: envAlias })
  const declaredMocks = mocksSetting(imp)
  const mockingOn = Boolean(declaredMocks) && (mocks ?? declaredMocks.enabled)
  const mocksDirectory = mockingOn ? resolve(root, declaredMocks.folder) : null
  const headInjection = buildHeadInjection(dependencies, pwa, env, mockingOn)
  const buildMocks = mocksDirectory
    ? createMockBundler({ root, directory: mocksDirectory, dependencies })
    : null
  if (declaredMocks && !mockingOn) {
    logger.info(
      `mocks — ${declaredMocks.folder}/ is declared but off for this run; pass --mock to serve it`,
    )
  }
  const maxLogEntries = imp.maxLogEntries ?? DEFAULT_MAX_LOG_ENTRIES
  const devServerPort = imp.devServerPort ?? null
  const missingDependencies = []
  for (const alias of Object.keys(dependencies)) {
    try {
      await Deno.stat(join(root, 'dependencies', alias, `${alias}.js`))
    } catch {
      missingDependencies.push(alias)
    }
  }
  return {
    root,
    entryName,
    headInjection,
    missingDependencies,
    pwa,
    maxLogEntries,
    devServerPort,
    mocksDirectory,
    buildMocks,
  }
}

export function reportMocks(state, { root, directory }) {
  if (!state.changed) return
  const where = relative(root, directory).replaceAll('\\', '/')
  if (state.problem) {
    logger.error(`mocks — ${state.problem}`)
  } else if (state.files.length) {
    logger.info(`mocks — ${state.files.length} file(s) from ${where}/ serving through the browser`)
  } else {
    logger.warn(`mocks — no *.mock.js files under ${where}/`)
  }
}

export function createRequestHandler(
  {
    root,
    entryName,
    headInjection,
    clients,
    pwa = null,
    historyFallback = true,
    mocksDirectory = null,
    buildMocks = null,
  },
) {
  let iconSet = null
  const devIcons = () => (iconSet ??= renderIconSet({ root, pwa }))
  return async (req) => {
    const url = new URL(req.url)

    if (pwa && url.pathname === DEV_MANIFEST_PATH) {
      return new Response(
        buildManifest(pwa, { iconBase: DEV_ICON_PREFIX, startUrl: '/', scope: '/' }),
        { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'no-store' } },
      )
    }

    if (pwa && url.pathname.startsWith(DEV_ICON_PREFIX)) {
      const file = url.pathname.slice(DEV_ICON_PREFIX.length)
      const icon = (await devIcons()).find((entry) => entry.file === file)
      if (icon) {
        return new Response(icon.bytes, {
          headers: { 'content-type': CONTENT_TYPES['.png'], 'cache-control': 'no-store' },
        })
      }
      return new Response('not found: ' + url.pathname, { status: 404 })
    }

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
      let mockBundle = ''
      if (buildMocks) {
        const state = await buildMocks()
        reportMocks(state, { root, directory: mocksDirectory })
        mockBundle = state.source
      }
      return new Response(serviceWorkerScript({ mockBundle }), {
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

    const response = await serveFromDir(root, url.pathname, { headInjection })
    if (response.status === 404 && historyFallback && isClientRouteRequest(req, url)) {
      return serveFromDir(root, '/' + entryName, { headInjection })
    }
    return response
  }
}

function isClientRouteRequest(req, url) {
  if (req.method !== 'GET') return false
  if (extname(url.pathname)) return false
  return (req.headers.get('accept') ?? '').includes('text/html')
}

export function createBroadcaster(clients) {
  return (message) => {
    const payload = new TextEncoder().encode(`data: ${message}\n\n`)
    for (const controller of clients) {
      try {
        controller.enqueue(payload)
      } catch {
        clients.delete(controller)
      }
    }
  }
}

export function watchForChanges(root, onChange) {
  ;(async () => {
    let timer = null
    for await (const event of Deno.watchFs(root)) {
      if (event.paths.every((p) => /[/\\](\.git|node_modules|dist|\.imp)[/\\]/.test(p))) continue
      clearTimeout(timer)
      timer = setTimeout(onChange, 80)
    }
  })()
}

export async function start({ entry = 'index.html', port = null, env = null, mocks = null } = {}) {
  const entryPath = resolve(entry)
  let entryStat
  try {
    entryStat = await Deno.stat(entryPath)
  } catch {
    logger.error(`file not found: ${entry}`)
    Deno.exit(1)
  }
  if (entryStat.isDirectory) {
    logger.error(`expected an HTML file, got a directory: ${entry}`)
    Deno.exit(1)
  }

  const {
    root,
    entryName,
    headInjection,
    missingDependencies,
    pwa,
    maxLogEntries,
    devServerPort,
    mocksDirectory,
    buildMocks,
  } = await loadApp(entryPath, { envAlias: env, mocks })
  const listenPort = port ?? devServerPort ?? DEFAULT_DEV_SERVER_PORT
  const clients = new Set()

  const devLog = await createDevLog({ root, maxEntries: maxLogEntries })
  const removeLogSink = addLogSink(devLog.write)

  for (const alias of missingDependencies) {
    logger.warn(`dependency '${alias}' is declared but not vendored — run 'imp install'`)
  }

  if (buildMocks) reportMocks(await buildMocks(), { root, directory: mocksDirectory })

  const broadcast = createBroadcaster(clients)
  watchForChanges(root, () => {
    logger.debug('change detected → reload')
    broadcast('reload')
  })

  const server = Deno.serve(
    {
      port: listenPort,
      onListen: ({ port }) => {
        logger.info(`imp start serving ${entryName} from ${root}`)
        console.log(`  → http://localhost:${port}/`)
        console.log(dim(`  logs → ${devLog.path}`))
        console.log(dim('  imp auto-injected · live reload · console + network telemetry'))
      },
    },
    createRequestHandler({
      root,
      entryName,
      headInjection,
      clients,
      pwa,
      mocksDirectory,
      buildMocks,
    }),
  )

  try {
    await server.finished
  } finally {
    removeLogSink()
    await devLog.close()
  }
}
