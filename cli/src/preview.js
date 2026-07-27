import { dirname, relative, resolve, toFileUrl } from '@std/path'
import { denoPlugin } from '@deno/esbuild-plugin'
import { loadImpConfig } from './config.js'
import { collectFiles } from './walk.js'
import { runEsbuild } from './deps.js'
import {
  collectMocks,
  DATAURL_ASSET_LOADERS,
  extractCalls,
  impResolverPlugin,
  LIBRARY_NAMESPACE,
  parseStringLiteral,
  resolveModuleFile,
  splitFirstArgument,
} from './bundling.js'
import {
  createBroadcaster,
  createRequestHandler,
  injectImp,
  loadApp,
  watchForChanges,
} from './start.js'
import { createDevLog, DEFAULT_MAX_LOG_ENTRIES } from './dev_log.js'
import { addLogSink, logger } from './logger.js'
import { dim } from './colors.js'

const PREVIEW_RUNTIME_URL = import.meta.resolve('./preview_runtime.js')

const DEFAULT_PREVIEW_PORT = 4517

const PREVIEW_EXTENSIONS = new Set(['js', 'mjs'])

const ENTRY_NAMESPACE = 'imp-preview-entry'
const RUNTIME_SPECIFIER = 'imp-preview-runtime'

const PAGE_PREFIX = '/preview/'
const BUNDLE_PREFIX = '/@imp/preview/'

const STATE_ENTRY_POINTS = ['initState', 'useState']
const MAX_SCANNED_SOURCES = 40

const IMPORT_SPECIFIERS = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g

export const isPreviewFile = (path) => path.endsWith('.preview.js') || path.endsWith('.preview.mjs')

const siblingPreviewOf = (path) => path.replace(/\.(js|mjs)$/, '.preview.$1')

async function resolveTargets(root, paths) {
  const targets = []
  for (const target of paths) {
    const path = resolve(root, target)
    let info
    try {
      info = await Deno.stat(path)
    } catch {
      throw new Error(`path not found: ${target}`)
    }
    if (info.isDirectory || isPreviewFile(path)) {
      targets.push(path)
      continue
    }
    const sibling = siblingPreviewOf(path)
    const hasSibling = sibling !== path && await Deno.stat(sibling).then(() => true, () => false)
    if (!hasSibling) {
      throw new Error(
        `not a preview file: ${target} — previews end with .preview.js, and there is no ${
          relative(root, sibling).replaceAll('\\', '/')
        } next to it`,
      )
    }
    targets.push(sibling)
  }
  return targets
}

export async function selectPreviewFiles({ root, paths, exclude }) {
  const targets = await resolveTargets(root, paths)
  const files = await collectFiles({
    root,
    paths: targets,
    extensions: PREVIEW_EXTENSIONS,
    exclude,
  })
  return files.filter(isPreviewFile)
}

const parseInitialValue = (source) => {
  const text = source.trim()
  if (!text) return null
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return null
  }
}

function extractStateDeclarations(source) {
  const declarations = []
  for (const functionName of STATE_ENTRY_POINTS) {
    for (const { argumentSource } of extractCalls(source, functionName)) {
      const { first, rest } = splitFirstArgument(argumentSource)
      const name = parseStringLiteral(first)
      if (name === null) continue
      const initial = functionName === 'initState' ? parseInitialValue(rest) : null
      declarations.push({ name, initial })
    }
  }
  return declarations
}

const EXPORTED_NAMES =
  /export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)|export\s*\{([^}]*)\}/g

export function extractExportOrder(source) {
  const names = []
  for (const [, declared, group] of source.matchAll(EXPORTED_NAMES)) {
    if (declared) {
      names.push(declared)
      continue
    }
    for (const entry of (group ?? '').split(',')) {
      const parts = entry.trim().split(/\s+as\s+/)
      const name = (parts.at(-1) ?? '').trim()
      if (name) names.push(name)
    }
  }
  return names
}

function relativeImports(source) {
  const specifiers = []
  for (const [, specifier] of source.matchAll(IMPORT_SPECIFIERS)) {
    if (specifier.startsWith('.')) specifiers.push(specifier)
  }
  return specifiers
}

export async function collectStateDeclarations(entryFile) {
  const declarations = new Map()
  const visited = new Set()
  const queue = [entryFile]
  while (queue.length && visited.size < MAX_SCANNED_SOURCES) {
    const file = queue.shift()
    if (visited.has(file)) continue
    visited.add(file)
    let source
    try {
      source = await Deno.readTextFile(file)
    } catch {
      continue
    }
    for (const declaration of extractStateDeclarations(source)) {
      const known = declarations.get(declaration.name)
      if (!known) declarations.set(declaration.name, declaration)
      else if (known.initial === null) known.initial = declaration.initial
    }
    for (const specifier of relativeImports(source)) {
      const target = await resolveModuleFile(resolve(dirname(file), specifier))
      if (target && !visited.has(target)) queue.push(target)
    }
  }
  return [...declarations.values()]
}

export async function resolvePreviewThemes(root, themes) {
  const resolved = []
  for (const entry of themes) {
    const file = await resolveModuleFile(resolve(root, entry))
    if (!file) throw new Error(`theme not found: ${entry} — listed in 'preview.themes'`)
    resolved.push({ source: entry, file })
  }
  return resolved
}

export async function resolvePreviewTranslations(root, translations) {
  if (!translations || typeof translations !== 'object' || Array.isArray(translations)) {
    throw new Error(
      "'preview.translations' must map a language code to a translations file, like " +
        '{ "pl": "./locales/pl.js" }',
    )
  }
  const resolved = []
  for (const [code, entry] of Object.entries(translations)) {
    const file = await resolveModuleFile(resolve(root, entry))
    if (!file) {
      throw new Error(`translations not found: ${entry} — listed in 'preview.translations.${code}'`)
    }
    resolved.push({ code, source: entry, file })
  }
  return resolved
}

function previewEntryPlugin({ file, meta, root, themes, translations }) {
  const themeBinding = (index) => `customTheme${index}`
  const translationBinding = (index) => `previewTranslations${index}`
  const contents = [
    `import * as scenarios from ${JSON.stringify(toFileUrl(file).href)}`,
    ...themes.map((theme, index) =>
      `import * as ${themeBinding(index)} from ${JSON.stringify(toFileUrl(theme.file).href)}`
    ),
    ...translations.map((entry, index) =>
      `import * as ${translationBinding(index)} from ${JSON.stringify(toFileUrl(entry.file).href)}`
    ),
    `import { startPreview } from '${RUNTIME_SPECIFIER}'`,
    `startPreview(scenarios, ${JSON.stringify(meta)}, [${
      themes.map((theme, index) =>
        `{ source: ${JSON.stringify(theme.source)}, module: ${themeBinding(index)} }`
      ).join(', ')
    }], [${
      translations.map((entry, index) =>
        `{ code: ${JSON.stringify(entry.code)}, module: ${translationBinding(index)} }`
      ).join(', ')
    }])`,
  ].join('\n') + '\n'
  return {
    name: 'imp-preview-entry',
    setup(build) {
      build.onResolve({ filter: new RegExp(`^${ENTRY_NAMESPACE}$`) }, () => ({
        path: 'entry',
        namespace: ENTRY_NAMESPACE,
      }))
      build.onLoad({ filter: /.*/, namespace: ENTRY_NAMESPACE }, () => ({
        contents,
        loader: 'js',
        resolveDir: root,
      }))
      build.onResolve({ filter: new RegExp(`^${RUNTIME_SPECIFIER}$`) }, () => ({
        path: PREVIEW_RUNTIME_URL,
        namespace: LIBRARY_NAMESPACE,
      }))
    },
  }
}

export async function bundlePreview(file, { root, dependencies, themes = [], translations = [] }) {
  const meta = {
    file: relative(root, file).replaceAll('\\', '/'),
    order: extractExportOrder(await Deno.readTextFile(file)),
    states: await collectStateDeclarations(file),
  }
  const mocks = await collectMocks(file, { root, dependencies })
  const result = await runEsbuild({
    plugins: [
      previewEntryPlugin({ file, meta, root, themes, translations }),
      impResolverPlugin({ root, dependencies, mocks }),
      denoPlugin(),
    ],
    entryPoints: [ENTRY_NAMESPACE],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    legalComments: 'none',
    write: false,
    outdir: '/imp-preview',
    loader: DATAURL_ASSET_LOADERS,
  })
  return result.outputFiles[0].text
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

const escapeHtml = (text) => text.replace(/[&<>"]/g, (character) => HTML_ESCAPES[character])

const pagePath = (file) => PAGE_PREFIX + file.split('/').map(encodeURIComponent).join('/')

const bundlePath = (file) => BUNDLE_PREFIX + file.split('/').map(encodeURIComponent).join('/')

const documentShell = (title, body) =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body>
${body}
</body>
</html>
`

const previewPage = (file) =>
  documentShell(
    `imp preview — ${file}`,
    `<script type="module" src="${escapeHtml(bundlePath(file))}"></script>`,
  )

const INDEX_STYLES = `
body { margin: 0; padding: 32px 24px; background: #0f1115; color: #e6e8ec;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
h1 { font-size: 16px; margin: 0 0 4px; }
p { color: #9aa4b8; font-size: 13px; margin: 0 0 20px; }
ul { list-style: none; padding: 0; margin: 0; max-width: 640px; }
li { border-top: 1px solid #262b36; }
li:last-child { border-bottom: 1px solid #262b36; }
a { display: block; padding: 10px 4px; color: #7c9cff; text-decoration: none; font-size: 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
a:hover { background: #171a21; }
`

const indexPage = (files) =>
  documentShell(
    'imp preview',
    `<style>${INDEX_STYLES}</style>
<h1>imp preview</h1>
<p>${files.length} preview${files.length === 1 ? '' : 's'} in this project</p>
<ul>
${
      files.map((file) =>
        `<li><a href="${escapeHtml(pagePath(file))}">${escapeHtml(file)}</a></li>`
      )
        .join('\n')
    }
</ul>`,
  )

const failureModule = (file, message) => `
const failure = document.createElement('pre')
failure.textContent = ${JSON.stringify(`imp preview: ${file} failed to build\n\n`)} + ${
  JSON.stringify(message)
}
failure.setAttribute(
  'style',
  'margin:24px;padding:16px;border-radius:8px;white-space:pre-wrap;' +
    'background:#2a1618;border:1px solid #57282c;color:#ffb4b4;' +
    'font:13px ui-monospace,SFMono-Regular,Menlo,monospace',
)
document.body.setAttribute('style', 'margin:0;background:#0f1115')
document.body.append(failure)
`

const htmlResponse = (body) =>
  new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })

const scriptResponse = (body) =>
  new Response(body, {
    headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' },
  })

export function createPreviewHandler(
  { app, clients, listPreviews, dependencies, bundles, themes = [], translations = [] },
) {
  const serveApp = createRequestHandler({ ...app, clients, historyFallback: false })

  const loadBundle = async (file) => {
    if (!bundles.has(file)) {
      try {
        bundles.set(file, {
          code: await bundlePreview(resolve(app.root, file), {
            root: app.root,
            dependencies,
            themes,
            translations,
          }),
        })
      } catch (error) {
        logger.error(`${file} failed to build — ${error.message}`)
        bundles.set(file, { error: error.message })
      }
    }
    return bundles.get(file)
  }

  return async (req) => {
    const url = new URL(req.url)
    const previews = listPreviews()

    if (url.pathname === '/') {
      return htmlResponse(injectImp(indexPage(previews), app.headInjection))
    }

    if (url.pathname.startsWith(PAGE_PREFIX)) {
      const file = decodeURIComponent(url.pathname.slice(PAGE_PREFIX.length))
      if (!previews.includes(file)) return new Response(`not found: ${file}`, { status: 404 })
      return htmlResponse(injectImp(previewPage(file), app.headInjection))
    }

    if (url.pathname.startsWith(BUNDLE_PREFIX)) {
      const file = decodeURIComponent(url.pathname.slice(BUNDLE_PREFIX.length))
      if (!previews.includes(file)) return new Response(`not found: ${file}`, { status: 404 })
      const bundle = await loadBundle(file)
      return scriptResponse(bundle.error ? failureModule(file, bundle.error) : bundle.code)
    }

    return serveApp(req)
  }
}

export async function preview(
  { root, paths = [], port = null, env = null, list = false, json = false } = {},
) {
  const imp = await loadImpConfig(root)
  const dependencies = imp.dependencies ?? {}
  const discover = async () =>
    (await selectPreviewFiles({ root, paths, exclude: imp.preview?.exclude ?? [] }))
      .map((file) => relative(root, file).replaceAll('\\', '/'))
  let previews = await discover()

  if (list) {
    if (json) console.log(JSON.stringify(previews))
    else for (const file of previews) console.log(file)
    return
  }

  if (!previews.length) {
    logger.info(
      "no previews found — write a '*.preview.js' file next to a component and export one instance per scenario, like: export const empty = myComponent()",
    )
    return
  }

  const themes = await resolvePreviewThemes(root, imp.preview?.themes ?? [])
  const translations = await resolvePreviewTranslations(root, imp.preview?.translations ?? {})
  const app = await loadApp(resolve(root, 'index.html'), { envAlias: env })
  const listenPort = port ?? DEFAULT_PREVIEW_PORT
  const clients = new Set()
  const bundles = new Map()

  const devLog = await createDevLog({
    root,
    maxEntries: imp.maxLogEntries ?? DEFAULT_MAX_LOG_ENTRIES,
  })
  const removeLogSink = addLogSink(devLog.write)

  for (const alias of app.missingDependencies) {
    logger.warn(`dependency '${alias}' is declared but not vendored — run 'imp install'`)
  }

  const broadcast = createBroadcaster(clients)
  watchForChanges(root, async () => {
    bundles.clear()
    previews = await discover().catch(() => previews)
    logger.debug('change detected → reload')
    broadcast('reload')
  })

  const openPath = paths.length === 1 && previews.length === 1 ? pagePath(previews[0]) : '/'
  const count = `${previews.length} preview${previews.length === 1 ? '' : 's'}`

  const server = Deno.serve(
    {
      port: listenPort,
      onListen: ({ port }) => {
        logger.info(`imp preview serving ${count} from ${root}`)
        console.log(`  → http://localhost:${port}${openPath}`)
        console.log(dim(`  logs → ${devLog.path}`))
        if (themes.length) {
          console.log(
            dim(`  themes → ${themes.map(({ source }) => source).join(', ')} + built-ins`),
          )
        }
        if (translations.length) {
          console.log(
            dim(`  languages → ${translations.map(({ code }) => code).join(', ')}`),
          )
        }
        console.log(dim('  imp auto-injected · live reload · console + network telemetry'))
      },
    },
    createPreviewHandler({
      app,
      clients,
      listPreviews: () => previews,
      dependencies,
      bundles,
      themes,
      translations,
    }),
  )

  try {
    await server.finished
  } finally {
    removeLogSink()
    await devLog.close()
  }
}
