import { dirname, extname, relative, resolve, toFileUrl } from '@std/path'
import { denoPlugin } from '@deno/esbuild-plugin'
import { loadImpConfig } from './config.js'
import { collectFiles } from './walk.js'
import { DATAURL_ASSET_LOADERS, runEsbuild } from './deps.js'
import { dataUri } from './image.js'
import {
  collectMocks,
  extractCalls,
  impResolverPlugin,
  isIdentChar,
  LIBRARY_NAMESPACE,
  parseStringLiteral,
  resolveModuleFile,
  skipStringLiteral,
  splitFirstArgument,
} from './bundling.js'
import {
  createBroadcaster,
  createRequestHandler,
  injectImp,
  loadApp,
  watchForChanges,
} from './start.js'
import { isPreviewMetadataExport } from './preview-metadata.js'
import { createDevLog, DEFAULT_MAX_LOG_ENTRIES } from './dev-log.js'
import { addLogSink, logger } from './logger.js'
import { dim } from './colors.js'
import { isPreviewFile } from './project-files.js'
import { previewHref, previewSlugs } from './preview-map.js'

const PREVIEW_RUNTIME_URL = import.meta.resolve('./preview-runtime.js')

const DEFAULT_PREVIEW_PORT = 4517

const PREVIEW_EXTENSIONS = new Set(['js', 'mjs'])

const ENTRY_NAMESPACE = 'imp-preview-entry'
const RUNTIME_SPECIFIER = 'imp-preview-runtime'

const BUNDLE_PREFIX = '/@imp/preview/'
const APP_BUNDLE_NAME = 'app'
const APP_BUNDLE_PATH = `${BUNDLE_PREFIX}${APP_BUNDLE_NAME}.js`

const IMP_MARK_URL = new URL('./templates/favicon.svg', import.meta.url)

let impMark = null

const readImpMark = async () =>
  impMark ??= dataUri('image/svg+xml', await Deno.readFile(IMP_MARK_URL))

const STATE_ENTRY_POINTS = ['initState', 'useState']
const MAX_SCANNED_SOURCES = 40

const IMPORT_SPECIFIERS = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g

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
        `not a preview file: ${target} - previews end with .preview.js, and there is no ${
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
      const { rest: afterSelf } = splitFirstArgument(argumentSource)
      const { first, rest } = splitFirstArgument(afterSelf)
      const name = parseStringLiteral(first)
      if (name === null) continue
      const initial = functionName === 'initState' ? parseInitialValue(rest) : null
      declarations.push({ name, initial })
    }
  }
  return declarations
}

const EXPRESSION_CONTINUES = new Set([...'.?+-*/%<>=&|^:`'])

function skipTrivia(source, index) {
  while (index < source.length) {
    const char = source[index]
    if (/\s/.test(char)) {
      index++
      continue
    }
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index++
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++
      index += 2
      continue
    }
    return index
  }
  return index
}

function readWord(source, index) {
  let end = index
  while (end < source.length && isIdentChar(source[end])) end++
  return { word: source.slice(index, end), end }
}

function readExpressionEnd(source, start) {
  let index = start
  let depth = 0
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index++
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++
      index += 2
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      index = skipStringLiteral(source, index)
      continue
    }
    if ('([{'.includes(char)) {
      depth++
      index++
      continue
    }
    if (')]}'.includes(char)) {
      if (depth === 0) return index
      depth--
      index++
      continue
    }
    if (depth === 0 && (char === ';' || char === ',')) return index
    if (depth === 0 && char === '\n') {
      const next = skipTrivia(source, index)
      if (next >= source.length || !EXPRESSION_CONTINUES.has(source[next])) return index
      index = next
      continue
    }
    index++
  }
  return source.length
}

function readBlockEnd(source, start) {
  let index = start
  let depth = 0
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index++
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++
      index += 2
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      index = skipStringLiteral(source, index)
      continue
    }
    if (char === '{') depth++
    else if (char === '}') {
      depth--
      if (depth === 0) return index + 1
    }
    index++
  }
  return source.length
}

function readGroupedExport(source, start, exports) {
  const close = source.indexOf('}', start)
  const end = close === -1 ? source.length : close
  for (const entry of source.slice(start + 1, end).split(',')) {
    const parts = entry.trim().split(/\s+as\s+/)
    const name = (parts.at(-1) ?? '').trim()
    if (name) exports.push({ name, value: null })
  }
  return end + 1
}

function readDeclaredExport(source, start, exports) {
  let cursor = start
  while (cursor < source.length) {
    const declared = readWord(source, cursor)
    if (!declared.word) return cursor
    const afterName = skipTrivia(source, declared.end)
    if (source[afterName] !== '=') {
      exports.push({ name: declared.word, value: null })
      return afterName
    }
    const valueStart = skipTrivia(source, afterName + 1)
    const valueEnd = readExpressionEnd(source, valueStart)
    exports.push({
      name: declared.word,
      value: isPreviewMetadataExport(declared.word)
        ? source.slice(valueStart, valueEnd).trim()
        : null,
    })
    cursor = skipTrivia(source, valueEnd)
    if (source[cursor] !== ',') return cursor
    cursor = skipTrivia(source, cursor + 1)
  }
  return cursor
}

function readFunctionExport(source, start, exports) {
  let cursor = skipTrivia(source, start)
  if (source[cursor] === '*') cursor = skipTrivia(source, cursor + 1)
  const named = readWord(source, cursor)
  if (!named.word) return named.end
  const bodyStart = source.indexOf('{', named.end)
  if (bodyStart === -1) return named.end
  const bodyEnd = readBlockEnd(source, bodyStart)
  exports.push({ name: named.word, value: null })
  return bodyEnd
}

function readExportStatement(source, afterKeyword, exports) {
  const start = skipTrivia(source, afterKeyword)
  if (source[start] === '{') return readGroupedExport(source, start, exports)
  const first = readWord(source, start)
  if (first.word === 'default') return first.end
  let keyword = first
  if (first.word === 'async') keyword = readWord(source, skipTrivia(source, first.end))
  if (keyword.word === 'function' || keyword.word === 'class') {
    return readFunctionExport(source, keyword.end, exports)
  }
  if (keyword.word === 'const' || keyword.word === 'let' || keyword.word === 'var') {
    return readDeclaredExport(source, skipTrivia(source, keyword.end), exports)
  }
  return keyword.end
}

function readPreviewExports(source) {
  const exports = []
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index++
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++
      index += 2
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      index = skipStringLiteral(source, index)
      continue
    }
    if (isIdentChar(char) && !isIdentChar(source[index - 1])) {
      const { word, end } = readWord(source, index)
      if (word === 'export' && source[index - 1] !== '.') {
        index = readExportStatement(source, end, exports)
        continue
      }
      index = end
      continue
    }
    index++
  }
  return exports
}

export function splitPreviewExports(source) {
  const scenarios = []
  const declared = {}
  for (const { name, value } of readPreviewExports(source)) {
    if (!isPreviewMetadataExport(name)) {
      scenarios.push(name)
      continue
    }
    const literal = value === null ? null : parseStringLiteral(value)
    if (literal !== null) declared[name] = literal
  }
  return { scenarios, declared }
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
    if (!file) throw new Error(`theme not found: ${entry} - listed in 'preview.themes'`)
    resolved.push({ source: entry, file })
  }
  return resolved
}

export async function resolvePreviewEntry(root, entry) {
  if (entry === null) return null
  const file = resolve(root, entry)
  const exists = await Deno.stat(file).then((info) => info.isFile, () => false)
  if (!exists) throw new Error(`preview entry not found: ${entry} - listed in 'preview.entry'`)
  return { source: entry, file }
}

export async function resolvePreviewGroups(root, groups) {
  if (groups === null) return null
  const file = await resolveModuleFile(resolve(root, groups))
  if (!file) throw new Error(`groups module not found: ${groups} - listed in 'preview.groups'`)
  return { source: groups, file }
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
      throw new Error(`translations not found: ${entry} - listed in 'preview.translations.${code}'`)
    }
    resolved.push({ code, source: entry, file })
  }
  return resolved
}

const GROUPS_BINDING = 'previewGroups'

function previewEntryPlugin({ root, catalog, entries, themes, translations, groups, mark }) {
  const themeBinding = (index) => `customTheme${index}`
  const translationBinding = (index) => `previewTranslations${index}`
  const loaders = entries.map((entry) =>
    `  ${JSON.stringify(entry.file)}: () => import(${
      JSON.stringify(toFileUrl(resolve(root, entry.file)).href)
    }),`
  )
  const contents = [
    ...themes.map((theme, index) =>
      `import * as ${themeBinding(index)} from ${JSON.stringify(toFileUrl(theme.file).href)}`
    ),
    ...translations.map((entry, index) =>
      `import * as ${translationBinding(index)} from ${JSON.stringify(toFileUrl(entry.file).href)}`
    ),
    ...(groups === null
      ? []
      : [`import * as ${GROUPS_BINDING} from ${JSON.stringify(toFileUrl(groups.file).href)}`]),
    `import { startPreview } from '${RUNTIME_SPECIFIER}'`,
    `startPreview({`,
    `  mark: ${JSON.stringify(mark)},`,
    `  catalog: ${JSON.stringify(catalog)},`,
    `  load: {`,
    ...loaders,
    `  },`,
    `  themes: [${
      themes.map((theme, index) =>
        `{ source: ${JSON.stringify(theme.source)}, module: ${themeBinding(index)} }`
      ).join(', ')
    }],`,
    `  translations: [${
      translations.map((entry, index) =>
        `{ code: ${JSON.stringify(entry.code)}, module: ${translationBinding(index)} }`
      ).join(', ')
    }],`,
    `  groups: ${
      groups === null
        ? 'null'
        : `{ source: ${JSON.stringify(groups.source)}, module: ${GROUPS_BINDING} }`
    },`,
    `})`,
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

const PREVIEW_SUFFIX = /\.preview\.(js|mjs)$/

export function previewIdentity(file, declared = {}) {
  const segments = file.split('/')
  const component = segments.pop().replace(PREVIEW_SUFFIX, '')
  const folder = segments.at(-1) ?? 'previews'
  return {
    file,
    path: `${folder}/${component}`,
    name: declared.name ?? component,
    group: declared.group ?? folder,
    description: declared.description ?? null,
  }
}

const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0

const readPreviewSource = async (file) => {
  try {
    return await Deno.readTextFile(file)
  } catch {
    return ''
  }
}

export async function buildPreviewCatalog(root, files) {
  const entries = []
  for (const file of files) {
    const absolute = resolve(root, file)
    const { scenarios, declared } = splitPreviewExports(await readPreviewSource(absolute))
    entries.push({
      ...previewIdentity(file, declared),
      order: scenarios,
      states: await collectStateDeclarations(absolute),
    })
  }
  return entries.sort((left, right) =>
    compareText(left.group, right.group) || compareText(left.name, right.name)
  )
}

const BUILD_ROUNDS_LIMIT = 20

const failuresOf = (error) => Array.isArray(error?.errors) ? error.errors : []

const describeFailure = (error, file) => {
  const own = failuresOf(error).filter((failure) => failure.location?.file?.endsWith(file))
  if (own.length === 0) return error.message
  return own.map((failure) => {
    const { line, column, lineText } = failure.location
    return `${file}:${line}:${column + 1}: ${failure.text}\n  ${lineText.trim()}`
  }).join('\n')
}

const culpritsOf = (error, entries) => {
  const files = failuresOf(error).map((failure) => failure.location?.file).filter(Boolean)
  return entries.filter((entry) => files.some((file) => file.endsWith(entry.file)))
}

async function collectAppMocks(entries, { root, dependencies }) {
  const mocks = new Map()
  const owners = new Map()
  const failed = []
  for (const entry of entries) {
    try {
      const own = await collectMocks(resolve(root, entry.file), { root, dependencies })
      for (const [id, mock] of own) {
        const owner = owners.get(id)
        if (owner !== undefined && mocks.get(id).factorySource !== mock.factorySource) {
          throw new Error(
            `mockModule('${
              mock.specifier ?? id
            }') - ${owner} already mocks this module with a different factory; the preview app is one module graph, so a module is mocked once, the same way, for every preview`,
          )
        }
        mocks.set(id, mock)
        owners.set(id, entry.file)
      }
    } catch (error) {
      failed.push({ file: entry.file, error: error.message })
    }
  }
  return { mocks, failed }
}

export async function bundlePreviewApp(
  { root, dependencies, catalog, themes = [], translations = [], groups = null },
) {
  const { mocks, failed } = await collectAppMocks(catalog, { root, dependencies })
  const mark = await readImpMark()
  let entries = catalog.filter((entry) => !failed.some((failure) => failure.file === entry.file))
  for (let round = 0; round < BUILD_ROUNDS_LIMIT; round++) {
    const embedded = catalog.map((entry) => {
      const failure = failed.find((candidate) => candidate.file === entry.file)
      return failure === undefined ? entry : { ...entry, error: failure.error }
    })
    try {
      const result = await runEsbuild({
        plugins: [
          previewEntryPlugin({
            root,
            catalog: embedded,
            entries,
            themes,
            translations,
            groups,
            mark,
          }),
          impResolverPlugin({ root, dependencies, mocks }),
          denoPlugin(),
        ],
        entryPoints: [
          { in: ENTRY_NAMESPACE, out: APP_BUNDLE_NAME },
          ...entries.map((entry) => ({
            in: resolve(root, entry.file),
            out: entry.file.replace(/\.(js|mjs)$/, ''),
          })),
        ],
        bundle: true,
        splitting: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        legalComments: 'none',
        write: false,
        outdir: BUNDLE_PREFIX,
        chunkNames: 'chunks/[name]-[hash]',
        loader: DATAURL_ASSET_LOADERS,
      })
      const files = new Map(result.outputFiles.map((file) => [file.path, file.text]))
      return { files, failed }
    } catch (error) {
      const culprits = culpritsOf(error, entries)
      if (culprits.length === 0) throw error
      for (const entry of culprits) {
        failed.push({ file: entry.file, error: describeFailure(error, entry.file) })
      }
      entries = entries.filter((entry) => !culprits.includes(entry))
    }
  }
  throw new Error('the preview app could not be built after excluding the files that fail')
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

const escapeHtml = (text) => text.replace(/[&<>"]/g, (character) => HTML_ESCAPES[character])

const generatedShell = (title, body, mark) =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="${mark}">
<title>${escapeHtml(title)}</title>
</head>
<body>
${body}
</body>
</html>
`

const TITLE_ELEMENT = /<title\b[^>]*>[\s\S]*?<\/title>/i

const withTitle = (html, title) => {
  const titleTag = `<title>${escapeHtml(title)}</title>`
  if (TITLE_ELEMENT.test(html)) return html.replace(TITLE_ELEMENT, titleTag)
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}\n${titleTag}`)
  }
  return `${titleTag}\n${html}`
}

const withBody = (html, body) => {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `\n${body}\n</body>`)
  return `${html}\n${body}\n`
}

export const entryShell = (entryHtml, title, body) => withBody(withTitle(entryHtml, title), body)

const PAGE_TITLE = 'imp preview'

const appPage = async (entryHtml) => {
  const body = `<script type="module" src="${APP_BUNDLE_PATH}"></script>`
  return entryHtml === null
    ? generatedShell(PAGE_TITLE, body, await readImpMark())
    : entryShell(entryHtml, PAGE_TITLE, body)
}

const failureModule = (message) => `
const failure = document.createElement('pre')
failure.textContent = ${JSON.stringify('imp preview: the preview app failed to build\n\n')} + ${
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

const isPageRequest = (req, url) => req.method === 'GET' && extname(url.pathname) === ''

export function createPreviewHandler(
  {
    app,
    clients,
    listCatalog,
    dependencies,
    cache,
    themes = [],
    translations = [],
    groups = null,
    entry = null,
    recentLog = null,
  },
) {
  const serveApp = createRequestHandler({ ...app, clients, historyFallback: false, recentLog })

  const readEntry = async () => {
    if (entry === null) return null
    try {
      return await Deno.readTextFile(entry.file)
    } catch (error) {
      logger.error(`${entry.source} could not be read - ${error.message}`)
      return null
    }
  }

  const loadBuild = () => {
    cache.build ??= bundlePreviewApp({
      root: app.root,
      dependencies,
      catalog: listCatalog(),
      themes,
      translations,
      groups,
    }).then((built) => {
      for (const { file, error } of built.failed) logger.error(`${file} failed to build - ${error}`)
      return built
    }, (error) => {
      logger.error(`the preview app failed to build - ${error.message}`)
      return { error: error.message, files: new Map(), failed: [] }
    })
    return cache.build
  }

  const page = async () =>
    htmlResponse(injectImp(await appPage(await readEntry()), app.headInjection))

  return async (req, info) => {
    const url = new URL(req.url)

    if (url.pathname.startsWith(BUNDLE_PREFIX)) {
      const built = await loadBuild()
      if (url.pathname === APP_BUNDLE_PATH && built.error !== undefined) {
        return scriptResponse(failureModule(built.error))
      }
      const code = built.files.get(url.pathname)
      if (code === undefined) {
        return new Response(`not found: ${url.pathname.slice(BUNDLE_PREFIX.length)}`, {
          status: 404,
        })
      }
      return scriptResponse(code)
    }

    if (url.pathname === '/') return page()

    const response = await serveApp(req, info)
    if (response.status === 404 && isPageRequest(req, url)) return page()
    return response
  }
}

export async function preview(
  { root, paths = [], port = null, env = null, list = false, json = false, mocks = null } = {},
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
      "no previews found - write a '*.preview.js' file next to a component and export one instance per scenario, like: export const empty = myComponent()",
    )
    return
  }

  const themes = await resolvePreviewThemes(root, imp.preview?.themes ?? [])
  const translations = await resolvePreviewTranslations(root, imp.preview?.translations ?? {})
  const groups = await resolvePreviewGroups(root, imp.preview?.groups ?? null)
  const entry = await resolvePreviewEntry(root, imp.preview?.entry ?? null)
  const app = await loadApp(resolve(root, 'index.html'), { envAlias: env, mocks })
  const listenPort = port ?? DEFAULT_PREVIEW_PORT
  const clients = new Set()
  const cache = { build: null }

  const devLog = await createDevLog({
    root,
    maxEntries: imp.maxLogEntries ?? DEFAULT_MAX_LOG_ENTRIES,
  })
  const removeLogSink = addLogSink(devLog.write)

  for (const alias of app.missingDependencies) {
    logger.warn(`dependency '${alias}' is declared but not vendored - run 'imp install'`)
  }

  let catalog = await buildPreviewCatalog(root, previews)

  const broadcast = createBroadcaster(clients)
  watchForChanges(root, async () => {
    cache.build = null
    previews = await discover().catch(() => previews)
    catalog = await buildPreviewCatalog(root, previews)
    logger.debug('change detected -> reload')
    broadcast('reload')
  })

  const openPath = paths.length === 1 && previews.length === 1
    ? previewHref(previewSlugs(catalog).get(previews[0]))
    : '/'
  const count = `${previews.length} preview${previews.length === 1 ? '' : 's'}`

  const server = Deno.serve(
    {
      port: listenPort,
      onListen: ({ port }) => {
        logger.info(`imp preview serving ${count} from ${root}`)
        console.log(`  -> http://localhost:${port}${openPath}`)
        console.log(dim(`  logs -> ${devLog.path}`))
        if (themes.length) {
          console.log(
            dim(`  themes -> ${themes.map(({ source }) => source).join(', ')} + built-ins`),
          )
        }
        if (translations.length) {
          console.log(
            dim(`  languages -> ${translations.map(({ code }) => code).join(', ')}`),
          )
        }
        if (groups !== null) console.log(dim(`  groups -> ${groups.source}`))
        if (entry !== null) console.log(dim(`  entry -> ${entry.source}`))
        console.log(dim('  imp auto-injected | live reload | console + network telemetry'))
      },
    },
    createPreviewHandler({
      app,
      clients,
      listCatalog: () => catalog,
      dependencies,
      cache,
      themes,
      translations,
      groups,
      entry,
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
