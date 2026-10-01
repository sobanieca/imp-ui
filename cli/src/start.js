import {
  basename,
  dirname,
  extname,
  fromFileUrl,
  join,
  normalize,
  relative,
  resolve,
  SEPARATOR,
} from '@std/path'
import { clientScript } from './client.js'
import { loadImpConfig, mocksSetting, publicDirectory } from './config.js'
import { publicCopyOfEntry, resolveEntryPath } from './entry.js'
import { isSkippedPath } from './walk.js'
import { applyEdits, headEdit, readHtml } from './html-document.js'
import { createMocks, MOCK_ENDPOINT } from './mocks.js'
import {
  assembleServiceWorker,
  assertServiceWorkerSource,
  createServiceWorkerBundler,
  SERVICE_WORKER_PATH,
} from './service-worker.js'
import { envInjectionScript, resolveEnvironment } from './environments.js'
import { developmentChecksScript } from './development-checks.js'
import { flagsInjectionScript, splitEnvAndFlags } from './flags.js'
import { dim, green, red } from './colors.js'
import { addLogSink, logger } from './logger.js'
import { createDevLog, DEFAULT_MAX_LOG_ENTRIES } from './dev-log.js'
import { APPLE_TOUCH_ICON, buildManifest, pwaHeadTags, renderIconSet } from './pwa.js'
import {
  isLocalRequest,
  readWidgetMark,
  REVIEW_ENDPOINT,
  REVIEW_LOG_LINES,
  writeReview,
} from './review.js'
import { IMP_MODULES } from './specifiers.js'

const FRAMEWORK_SRC = fromFileUrl(new URL('../../lib/src', import.meta.url))

const DEFAULT_DEV_SERVER_PORT = 4507

export const CONTENT_TYPES = {
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
    logger.http(`${entry.method} ${entry.url} -> ${status} ${dim(entry.ms + 'ms')}${from}`)
  }
}

const impModulePath = (module) => `/@imp/${module}`

const INJECTION_MARKER = impModulePath(IMP_MODULES.imp)

const dependencyBundlePath = (alias) => `/dependencies/${alias}/${alias}.js`

function dependencyImports(dependencies) {
  return Object.fromEntries(
    Object.keys(dependencies).map((alias) => [alias, dependencyBundlePath(alias)]),
  )
}

const impImports = Object.fromEntries(
  Object.entries(IMP_MODULES).map(([specifier, module]) => [specifier, impModulePath(module)]),
)

const DEV_MANIFEST_PATH = '/@imp/manifest.webmanifest'
const DEV_ICON_PREFIX = '/@imp/pwa/'

const DEV_WORKER_PATH = '/@imp/sw.js'

function buildHeadInjection(dependencies, pwa, env, flags, mocks, ownWorker, widget) {
  const importMap = {
    imports: { ...impImports, ...dependencyImports(dependencies) },
  }
  const pwaTags = pwa
    ? '\n' + pwaHeadTags({
      manifestHref: DEV_MANIFEST_PATH,
      themeColor: pwa.themeColor,
      appleTouchHref: DEV_ICON_PREFIX + APPLE_TOUCH_ICON,
    })
    : ''
  const valueTags = [
    developmentChecksScript(),
    envInjectionScript(env),
    flagsInjectionScript(flags),
  ]
    .filter(Boolean)
    .map((tag) => tag + '\n')
    .join('')
  return `<script>${
    clientScript({ mocks, ownWorker, ...widget })
  }</script>\n${valueTags}<script type="importmap">${JSON.stringify(importMap)}</script>${pwaTags}`
}

export function injectImp(html, headInjection) {
  if (html.includes(INJECTION_MARKER)) return html
  return applyEdits(html, [headEdit(readHtml(html), headInjection)])
}

function contentType(path) {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

export function resolveWithinRoot(dir, relativePath) {
  let path
  try {
    path = decodeURIComponent(relativePath)
  } catch {
    return null
  }
  if (path.endsWith('/')) path += 'index.html'
  const base = resolve(dir)
  const fsPath = normalize(join(base, path))
  if (fsPath !== base && !fsPath.startsWith(base + SEPARATOR)) return null
  if (isSkippedPath(relative(base, fsPath))) return null
  return { path, fsPath }
}

async function serveFromDir(dir, relativePath, { headInjection = null } = {}) {
  const within = resolveWithinRoot(dir, relativePath)
  if (!within) return new Response('forbidden', { status: 403 })
  const { path, fsPath } = within
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

export async function loadApp(
  entryPath,
  { envAlias = null, mocks = null, themeEditor = true } = {},
) {
  const root = dirname(entryPath)
  const entryName = basename(entryPath)
  const imp = await loadImpConfig(root)
  const dependencies = imp.dependencies ?? {}
  const pwa = imp.pwa ?? null
  const selected = await resolveEnvironment({ root, config: imp, requestedAlias: envAlias })
  const { env, flags } = splitEnvAndFlags({ config: imp, env: selected })
  const declaredMocks = mocksSetting(imp)
  const mockingOn = Boolean(declaredMocks) && (mocks ?? declaredMocks.enabled)
  const mocksDirectory = mockingOn ? resolve(root, declaredMocks.folder) : null
  const serviceWorkerEntry = imp.serviceWorker ? resolve(root, imp.serviceWorker) : null
  if (serviceWorkerEntry) await assertServiceWorkerSource(serviceWorkerEntry, imp.serviceWorker)
  const headInjection = buildHeadInjection(
    dependencies,
    pwa,
    env,
    flags,
    mockingOn,
    Boolean(serviceWorkerEntry),
    { mark: await readWidgetMark(), themeEditor },
  )
  const mockServer = mocksDirectory
    ? createMocks({
      root,
      directory: mocksDirectory,
      dependencies,
      onChange: (state) => reportMocks(state, { root, directory: mocksDirectory }),
    })
    : null
  const buildServiceWorker = createServiceWorkerBundler({
    root,
    entry: serviceWorkerEntry,
    dependencies,
  })
  if (declaredMocks && !mockingOn) {
    logger.info(
      `mocks - ${declaredMocks.folder}/ is declared but off for this run; pass --mock to serve it`,
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
    mockServer,
    serviceWorker: serviceWorkerEntry
      ? relative(root, serviceWorkerEntry).replaceAll('\\', '/')
      : null,
    buildServiceWorker,
    runtimeValues: { env, flags },
    publicDir: publicDirectory(root),
  }
}

export function reportServiceWorker(state, { serviceWorker }) {
  if (!state.changed) return
  if (state.problem) {
    logger.error(`service worker - ${state.problem}`)
  } else {
    logger.info(
      `service worker - ${serviceWorker} serving at ${SERVICE_WORKER_PATH}; ` +
        'dev mode runs when it calls startDevMode()',
    )
  }
}

export function reportMocks(state, { root, directory }) {
  const where = relative(root, directory).replaceAll('\\', '/')
  for (const problem of state.problems) logger.error(`mocks - ${problem}`)
  if (state.files.length) {
    const answering = state.entries.length ? 'answering requests' : 'answering nothing'
    logger.info(`mocks - ${state.files.length} file(s) from ${where}/ ${answering}`)
  } else if (!state.problems.length) {
    logger.warn(`mocks - no *.mock.js files under ${where}/`)
  }
}

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

async function saveReview(req, info, root, recentLog) {
  if (!isLocalRequest(info)) {
    return jsonResponse({ error: 'reviews are only accepted from this machine' }, 403)
  }
  let payload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'the review could not be read' }, 400)
  }
  try {
    const path = await writeReview(root, payload, { log: recentLog?.(REVIEW_LOG_LINES) ?? [] })
    logger.info(`review - ${path}`)
    return jsonResponse({ path })
  } catch (error) {
    logger.error(`review - ${error.message}`)
    return jsonResponse({ error: error.message }, 400)
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
    mockServer = null,
    serviceWorker = null,
    buildServiceWorker = null,
    runtimeValues = {},
    publicDir = null,
    recentLog = null,
  },
) {
  const servedWorkerPath = serviceWorker ? SERVICE_WORKER_PATH : DEV_WORKER_PATH
  let iconSet = null
  const devIcons = () => (iconSet ??= renderIconSet({ root, pwa }))
  const serveAsset = async (pathname) => {
    if (publicDir) {
      const fromPublic = await serveFromDir(publicDir, pathname)
      if (fromPublic.status !== 404) return fromPublic
    }
    return serveFromDir(root, pathname, { headInjection })
  }
  return async (req, info) => {
    const url = new URL(req.url)

    if (url.pathname === REVIEW_ENDPOINT && req.method === 'POST') {
      return saveReview(req, info, root, recentLog)
    }

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

    if (url.pathname === servedWorkerPath) {
      const worker = await buildServiceWorker()
      if (serviceWorker) reportServiceWorker(worker, { serviceWorker })
      if (worker.problem) {
        return new Response(`service worker - ${worker.problem}`, {
          status: 500,
          headers: { 'content-type': CONTENT_TYPES['.txt'], 'cache-control': 'no-store' },
        })
      }
      const mockEndpoint = mockServer ? MOCK_ENDPOINT : null
      return new Response(
        assembleServiceWorker({ worker: worker.source, mockEndpoint, ...runtimeValues }),
        {
          headers: {
            'content-type': CONTENT_TYPES['.js'],
            'service-worker-allowed': '/',
            'cache-control': 'no-store',
          },
        },
      )
    }

    if (mockServer && url.pathname === MOCK_ENDPOINT && req.method === 'POST') {
      return mockServer.answer(req)
    }

    if (url.pathname.startsWith('/@imp/')) {
      return serveFromDir(FRAMEWORK_SRC, url.pathname.slice('/@imp/'.length))
    }

    if (url.pathname === '/' || url.pathname === '/' + entryName) {
      return serveFromDir(root, '/' + entryName, { headInjection })
    }

    const response = await serveAsset(url.pathname)
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
      if (event.paths.every((path) => isSkippedPath(relative(root, path)))) continue
      clearTimeout(timer)
      timer = setTimeout(onChange, 80)
    }
  })()
}

export function reloadBannerLine(reload) {
  return dim(
    `  imp auto-injected | ${reload ? 'live reload' : 'no reload'} | console + network telemetry`,
  )
}

export async function start(
  { entry = 'index.html', port = null, env = null, mocks = null, reload = true } = {},
) {
  let entryPath
  try {
    entryPath = await resolveEntryPath(entry, { expected: 'an HTML file' })
  } catch (error) {
    logger.error(error.message)
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
    mockServer,
    serviceWorker,
    buildServiceWorker,
    runtimeValues,
    publicDir,
  } = await loadApp(entryPath, { envAlias: env, mocks })
  const listenPort = port ?? devServerPort ?? DEFAULT_DEV_SERVER_PORT
  const clients = new Set()

  const devLog = await createDevLog({ root, maxEntries: maxLogEntries })
  const removeLogSink = addLogSink(devLog.write)

  for (const alias of missingDependencies) {
    logger.warn(`dependency '${alias}' is declared but not vendored - run 'imp install'`)
  }

  if (await publicCopyOfEntry(root, entryName)) {
    logger.warn(
      `public/${entryName} is ignored - ${entryName} is served from the project root, ` +
        `and 'imp build' fails on the collision`,
    )
  }

  await mockServer?.refresh()
  if (serviceWorker) reportServiceWorker(await buildServiceWorker(), { serviceWorker })

  const broadcast = createBroadcaster(clients)
  watchForChanges(root, () => {
    if (!reload) {
      logger.debug('change detected -> no reload')
      return
    }
    logger.debug('change detected -> reload')
    broadcast('reload')
  })

  const server = Deno.serve(
    {
      port: listenPort,
      onListen: ({ port }) => {
        logger.info(`imp start serving ${entryName} from ${root}`)
        console.log(`  -> http://localhost:${port}/`)
        console.log(dim('  logs -> imp logs (-f follows the session)'))
        console.log(reloadBannerLine(reload))
      },
    },
    createRequestHandler({
      root,
      entryName,
      headInjection,
      clients,
      pwa,
      mockServer,
      serviceWorker,
      buildServiceWorker,
      runtimeValues,
      publicDir,
      recentLog: devLog.recent,
    }),
  )

  try {
    await server.finished
  } finally {
    removeLogSink()
    await devLog.close()
  }
}
