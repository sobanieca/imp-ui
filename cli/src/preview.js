import {
  dirname,
  extname,
  fromFileUrl,
  join,
  normalize,
  relative,
  resolve,
  SEPARATOR,
  toFileUrl,
} from '@std/path'
import { denoPlugin } from '@deno/esbuild-plugin'
import { loadImpConfig } from './config.js'
import { collectFiles } from './walk.js'
import { DATAURL_ASSET_LOADERS, runEsbuild, shutdownBundler } from './deps.js'
import { dataUri } from './image.js'
import { impMarkSvg } from '../../lib/src/std/shared/imp-mark.js'
import {
  collectMocks,
  IMP_LIBRARY_ROOT,
  impResolverPlugin,
  libraryModule,
  resolveModuleFile,
} from './bundling.js'
import {
  createBroadcaster,
  createRequestHandler,
  injectImp,
  loadApp,
  watchForChanges,
} from './start.js'
import { PREVIEW_SKILL_EXPORT } from './preview-metadata.js'
import { scanGroupsModule, scanPreviewSource } from './preview-source.js'
import { retargetLinks, skillFileFor, standardComponentSubjects } from './skill.js'
import { marked } from './vendor/marked.js'
import { applyEdits, headEdit, readHtml } from './html-document.js'
import { createDevLog, DEFAULT_MAX_LOG_ENTRIES } from './dev-log.js'
import { addLogSink, logger } from './logger.js'
import { dim } from './colors.js'
import { isPreviewFile } from './project-files.js'
import { previewHref, previewSlugs } from './preview-map.js'
import {
  PREVIEW_APP_MARK,
  PREVIEW_ELEMENT,
  PREVIEW_ELEMENT_FILE,
  PREVIEW_ENV,
  PREVIEW_ROUTE_EVENT,
  previewElementScript,
} from './preview-export.js'
import { envInjectionScript, resolveEnvironment } from './environments.js'
import { productionDefines } from './development-checks.js'
import { formatSize } from './file-size.js'
import {
  collectLicenseNotices,
  LICENSE_NOTICES_FILE,
  licenseNoticeCount,
  licenseNoticesFile,
  licenseNoticesReference,
  splitLicenseNotices,
  unrecordedLicensesWarning,
} from './license-notices.js'

const PREVIEW_RUNTIME_URL = import.meta.resolve('./preview-runtime.js')

const DEFAULT_PREVIEW_PORT = 4517

const PREVIEW_EXTENSIONS = new Set(['js', 'mjs'])

const ENTRY_NAMESPACE = 'imp-preview-entry'
const RUNTIME_SPECIFIER = 'imp-preview-runtime'
const GROUP_NAMESPACE = 'imp-preview-group'
const GROUP_SCHEME = `${GROUP_NAMESPACE}:`
const GROUPS_FOLDER = 'groups'

const BUNDLE_PREFIX = '/@imp/preview/'
const APP_BUNDLE_NAME = 'app'
const APP_BUNDLE_PATH = `${BUNDLE_PREFIX}${APP_BUNDLE_NAME}.js`

const IMP_FAVICON_URL = new URL('./templates/favicon.ico', import.meta.url)

let impMark = null

let impFavicon = null

const readImpMark = () =>
  impMark ??= {
    light: dataUri('image/svg+xml', new TextEncoder().encode(impMarkSvg('light'))),
    dark: dataUri('image/svg+xml', new TextEncoder().encode(impMarkSvg('dark'))),
  }

const readImpFavicon = async () =>
  impFavicon ??= dataUri('image/x-icon', await Deno.readFile(IMP_FAVICON_URL))

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

const PREVIEW_SUFFIX = /\.preview\.(js|mjs)$/

const ROUTE_BRIDGE = [
  `started.then(() => {`,
  `  useRoute().watch((route) => {`,
  `    globalThis.frameElement?.dispatchEvent(`,
  `      new CustomEvent(${JSON.stringify(PREVIEW_ROUTE_EVENT)}, { detail: route }),`,
  `    )`,
  `  })`,
  `})`,
]

const groupModulesOf = (root, catalog, entries) => {
  const slugs = previewSlugs(catalog)
  const groups = new Map()
  const bindings = new Map()
  for (const entry of entries) {
    const segment = slugs.get(entry.file).groupSegment
    if (!groups.has(segment)) groups.set(segment, [])
    const exports = groups.get(segment)
    const binding = `preview${exports.length}`
    exports.push(
      `export * as ${binding} from ${JSON.stringify(toFileUrl(resolve(root, entry.file)).href)}`,
    )
    bindings.set(entry.file, { segment, binding })
  }
  return { groups, bindings }
}

const groupSpecifier = (segment) => `${GROUP_SCHEME}${segment}`

const groupOutput = (segment) => `${GROUPS_FOLDER}/${segment}`

function previewEntryPlugin(
  { root, catalog, entries, themes, translations, groups, mark, favicon, embedded },
) {
  const themeBinding = (index) => `customTheme${index}`
  const translationBinding = (index) => `previewTranslations${index}`
  const modules = groupModulesOf(root, catalog, entries)
  const loaders = entries.map((entry) => {
    const { segment, binding } = modules.bindings.get(entry.file)
    return `  ${JSON.stringify(entry.file)}: () => import(${
      JSON.stringify(groupSpecifier(segment))
    }).then((group) => group.${binding}),`
  })
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
    ...(embedded ? [`import { useRoute } from 'imp/router'`] : []),
    `const started = startPreview({`,
    `  embedded: ${embedded},`,
    `  mark: ${JSON.stringify(mark)},`,
    `  favicon: ${JSON.stringify(favicon)},`,
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
    ...(embedded ? ROUTE_BRIDGE : []),
  ].join('\n') + '\n'
  const groupEntryPoints = [...modules.groups.keys()].map((segment) => ({
    in: groupSpecifier(segment),
    out: groupOutput(segment),
  }))
  const plugin = {
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
      build.onResolve({ filter: new RegExp(`^${GROUP_SCHEME}`) }, (args) => ({
        path: args.path.slice(GROUP_SCHEME.length),
        namespace: GROUP_NAMESPACE,
      }))
      build.onLoad({ filter: /.*/, namespace: GROUP_NAMESPACE }, (args) => ({
        contents: modules.groups.get(args.path).join('\n') + '\n',
        loader: 'js',
        resolveDir: root,
      }))
      build.onResolve(
        { filter: new RegExp(`^${RUNTIME_SPECIFIER}$`) },
        () => libraryModule(PREVIEW_RUNTIME_URL),
      )
      build.onLoad({ filter: PREVIEW_SUFFIX, namespace: 'file' }, async (args) => ({
        contents: await withSkill(args.path, await Deno.readTextFile(args.path)),
        loader: 'js',
      }))
    },
  }
  return { plugin, groupEntryPoints }
}

export function previewIdentity(file, declared = {}) {
  const segments = file.split('/')
  const component = segments.pop().replace(PREVIEW_SUFFIX, '')
  const folder = segments.at(-1) ?? 'previews'
  return {
    file,
    path: `${folder}/${component}`,
    name: declared.name ?? component,
    group: declared.group ?? folder,
    description: declared.description === undefined
      ? null
      : renderDescription(declared.description),
  }
}

const componentModuleOf = (previewFile) => previewFile.replace(PREVIEW_SUFFIX, '.$1')

const sidecarOf = (previewFile) => skillFileFor(componentModuleOf(previewFile))

const fileExists = (path) => Deno.stat(path).then((info) => info.isFile, () => false)

let standardSidecars = null

const readStandardSidecars = async () =>
  standardSidecars ??= new Map(
    (await standardComponentSubjects()).map(({ name, url }) => [
      relative(fromFileUrl(IMP_LIBRARY_ROOT), fromFileUrl(url)).replaceAll('\\', '/'),
      { name, url },
    ]),
  )

const sameText = async (file, url) => {
  const [own, embedded] = await Promise.all([Deno.readTextFile(file), Deno.readTextFile(url)])
  return own === embedded
}

export async function skillCommandOf(root, file) {
  const sidecar = resolve(root, sidecarOf(file))
  if (!await fileExists(sidecar)) return null
  const standard = (await readStandardSidecars()).get(sidecarOf(file))
  const isStandard = standard !== undefined && await sameText(sidecar, standard.url)
  return `imp skill ${isStandard ? standard.name : `./${componentModuleOf(file)}`}`
}

export const renderSkill = (skillText) =>
  marked.parse(retargetLinks(skillText.trimEnd()).retargeted)

export const renderDescription = (text) => marked.parse(text.trimEnd())

const withSkill = async (previewFile, source) => {
  let skillText
  try {
    skillText = await Deno.readTextFile(sidecarOf(previewFile))
  } catch {
    return source
  }
  return `${source}\nexport const ${PREVIEW_SKILL_EXPORT} = ${
    JSON.stringify(renderSkill(skillText))
  }\n`
}

const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0

const readPreviewSource = async (file) => {
  try {
    return await Deno.readTextFile(file)
  } catch {
    return ''
  }
}

const GROUP_SHAPE =
  "import { groups } from './preview-groups.js' and export const group = groups.widgets"

async function readGroupNames(groups) {
  if (groups === null) return null
  const names = scanGroupsModule(await readPreviewSource(groups.file))
  if (names === null) {
    logger.warn(
      `${groups.source} (preview.groups) must export an object named groups, like ` +
        "export const groups = { widgets: { name: 'Widgets', icon: luBox } }",
    )
    return new Map()
  }
  for (const [key, name] of names) {
    if (name === null) logger.warn(`${groups.source} (preview.groups): group '${key}' has no name`)
  }
  return names
}

async function resolveGroupName(root, file, reference, groups, names) {
  if (reference === undefined) return undefined
  const fallback = () => undefined
  if (reference.key === undefined) {
    logger.warn(`${file}: 'group' must be a key of the groups module, like ${GROUP_SHAPE}`)
    return fallback()
  }
  if (groups === null || names === null) {
    logger.warn(`${file}: 'group' needs 'preview.groups' in imp.json to name the groups module`)
    return fallback()
  }
  const imported = reference.specifier === null
    ? null
    : await resolveModuleFile(resolve(dirname(resolve(root, file)), reference.specifier))
  if (imported !== groups.file) {
    logger.warn(`${file}: 'group' must import groups from ${groups.source}, like ${GROUP_SHAPE}`)
    return fallback()
  }
  const name = names.get(reference.key)
  if (name === undefined || name === null) {
    logger.warn(`${file}: 'group' is groups.${reference.key}, which ${groups.source} does not name`)
    return fallback()
  }
  return name
}

export async function buildPreviewCatalog(root, files, groups = null) {
  const entries = []
  const names = await readGroupNames(groups)
  for (const file of files) {
    const absolute = resolve(root, file)
    const { scenarios, declared, code } = scanPreviewSource(await readPreviewSource(absolute))
    const group = await resolveGroupName(root, file, declared.group, groups, names)
    entries.push({
      ...previewIdentity(file, { name: declared.name, group, description: declared.description }),
      order: scenarios,
      code,
      skill: await skillCommandOf(root, file),
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
  { root, dependencies, catalog, themes = [], translations = [], groups = null, embedded = false },
) {
  const { mocks, failed } = await collectAppMocks(catalog, { root, dependencies })
  const mark = readImpMark()
  const favicon = await readImpFavicon()
  let entries = catalog.filter((entry) => !failed.some((failure) => failure.file === entry.file))
  for (let round = 0; round < BUILD_ROUNDS_LIMIT; round++) {
    const marked = catalog.map((entry) => {
      const failure = failed.find((candidate) => candidate.file === entry.file)
      return failure === undefined ? entry : { ...entry, error: failure.error }
    })
    try {
      const { plugin, groupEntryPoints } = previewEntryPlugin({
        root,
        catalog: marked,
        entries,
        themes,
        translations,
        groups,
        mark,
        favicon,
        embedded,
      })
      const result = await runEsbuild({
        plugins: [plugin, impResolverPlugin({ root, dependencies, mocks }), denoPlugin()],
        entryPoints: [{ in: ENTRY_NAMESPACE, out: APP_BUNDLE_NAME }, ...groupEntryPoints],
        absWorkingDir: root,
        ...(embedded ? { define: productionDefines() } : {}),
        bundle: true,
        splitting: true,
        minify: embedded,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        legalComments: embedded ? 'external' : 'none',
        metafile: embedded,
        write: false,
        outdir: BUNDLE_PREFIX,
        chunkNames: 'chunks/[name]-[hash]',
        loader: DATAURL_ASSET_LOADERS,
      })
      const { code, notices } = splitLicenseNotices(result.outputFiles)
      const files = new Map(code.map((file) => [file.path, file.text]))
      return { files, failed, metafile: result.metafile, embeddedNotices: notices }
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

const generatedShell = (title, body, favicon) =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="${favicon}">
<title>${escapeHtml(title)}</title>
</head>
<body>
${body}
</body>
</html>
`

const withTitleAndBody = (html, title, body) => {
  const document = readHtml(html)
  const titleTag = `<title>${escapeHtml(title)}</title>`
  const titleEdit = document.title
    ? { ...document.title, text: titleTag }
    : headEdit(document, titleTag)
  const bodyEdit = { start: document.bodyEnd, end: document.bodyEnd, text: `\n${body}\n` }
  return applyEdits(html, [titleEdit, bodyEdit])
}

export const entryShell = (entryHtml, title, body) => withTitleAndBody(entryHtml, title, body)

const PAGE_TITLE = 'imp preview'

const appPage = async (entryHtml) => {
  const body = `<script type="module" src="${APP_BUNDLE_PATH}"></script>`
  return entryHtml === null
    ? generatedShell(PAGE_TITLE, body, await readImpFavicon())
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

const previewCount = (previews) => `${previews.length} preview${previews.length === 1 ? '' : 's'}`

const resolvePreviewSettings = async (root, imp) => ({
  themes: await resolvePreviewThemes(root, imp.preview?.themes ?? []),
  translations: await resolvePreviewTranslations(root, imp.preview?.translations ?? {}),
  groups: await resolvePreviewGroups(root, imp.preview?.groups ?? null),
  entry: await resolvePreviewEntry(root, imp.preview?.entry ?? null),
})

const embeddedPage = async (entry, env) => {
  const body = `${
    envInjectionScript({ ...env, ...PREVIEW_ENV })
  }\n<script type="module" src="${PREVIEW_APP_MARK}"></script>`
  if (entry === null) return generatedShell(PAGE_TITLE, body, await readImpFavicon())
  return entryShell(await Deno.readTextFile(entry.file), PAGE_TITLE, body)
}

const insideOf = (folder, path) =>
  normalize(path) === normalize(folder) || normalize(path).startsWith(normalize(folder) + SEPARATOR)

async function exportPreview({ root, imp, previews, dependencies, output, env }) {
  const outdir = resolve(root, output)
  if (insideOf(outdir, root)) {
    throw new Error(`the output folder must not contain the project: ${output}`)
  }
  const { themes, translations, groups, entry } = await resolvePreviewSettings(root, imp)
  const resolvedEnv = await resolveEnvironment({ root, config: imp, requestedAlias: env })
  const catalog = await buildPreviewCatalog(root, previews, groups)
  let built
  try {
    built = await bundlePreviewApp({
      root,
      dependencies,
      catalog,
      themes,
      translations,
      groups,
      embedded: true,
    })
  } finally {
    await shutdownBundler()
  }
  if (built.failed.length) {
    throw new Error(
      `the export needs every preview file to build:\n${
        built.failed.map(({ file, error }) => `${file} failed to build - ${error}`).join('\n')
      }`,
    )
  }
  const page = await embeddedPage(entry, resolvedEnv)
  const { notices, unrecorded } = await collectLicenseNotices({
    root,
    dependencies,
    metafile: built.metafile,
    embedded: built.embeddedNotices,
  })
  if (unrecorded.length) logger.warn(unrecordedLicensesWarning(unrecorded))
  const noticeCount = licenseNoticeCount(notices)
  const withNoticeReference = (name, text) =>
    noticeCount && name.endsWith('.js')
      ? licenseNoticesReference(
        `${'../'.repeat(name.split('/').length - 1)}${LICENSE_NOTICES_FILE}`,
      ) +
        text
      : text
  await Deno.remove(outdir, { recursive: true }).catch(() => {})
  await Deno.mkdir(outdir, { recursive: true })
  const written = []
  const write = async (name, text) => {
    const path = join(outdir, name)
    await Deno.mkdir(dirname(path), { recursive: true })
    await Deno.writeTextFile(path, withNoticeReference(name, text))
    written.push(name)
  }
  await write(PREVIEW_ELEMENT_FILE, previewElementScript(page))
  if (noticeCount) await write(LICENSE_NOTICES_FILE, licenseNoticesFile(notices))
  for (const [path, code] of built.files) await write(path.slice(BUNDLE_PREFIX.length), code)
  const shown = relative(Deno.cwd(), outdir).replaceAll('\\', '/') || '.'
  logger.info(`imp preview exported ${previewCount(previews)} -> ${shown}/`)
  console.log(
    dim(
      `  <script type="module" src="/${PREVIEW_ELEMENT_FILE}"></script> loads it, ` +
        `<${PREVIEW_ELEMENT}></${PREVIEW_ELEMENT}> shows it`,
    ),
  )
  console.log(dim(`  #/<group>/<name> in the address of the page opens a component`))
  if (entry !== null) console.log(dim(`  entry -> ${entry.source}`))
  written.sort()
  for (const name of written) {
    const { size } = await Deno.stat(join(outdir, name))
    console.log(`  ${name} (${formatSize(size)})`)
  }
}

export async function preview(
  {
    root,
    paths = [],
    port = null,
    env = null,
    list = false,
    json = false,
    mocks = null,
    output = null,
  } = {},
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

  if (output !== null) {
    await exportPreview({ root, imp, previews, dependencies, output, env })
    return
  }

  const { themes, translations, groups, entry } = await resolvePreviewSettings(root, imp)
  const app = await loadApp(resolve(root, 'index.html'), {
    envAlias: env,
    mocks,
    themeEditor: false,
  })
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

  let catalog = await buildPreviewCatalog(root, previews, groups)

  const broadcast = createBroadcaster(clients)
  watchForChanges(root, async () => {
    cache.build = null
    previews = await discover().catch(() => previews)
    catalog = await buildPreviewCatalog(root, previews, groups)
    logger.debug('change detected -> reload')
    broadcast('reload')
  })

  const openPath = paths.length === 1 && previews.length === 1
    ? previewHref(previewSlugs(catalog).get(previews[0]))
    : '/'

  const server = Deno.serve(
    {
      port: listenPort,
      onListen: ({ port }) => {
        logger.info(`imp preview serving ${previewCount(previews)} from ${root}`)
        console.log(`  -> http://localhost:${port}${openPath}`)
        console.log(dim('  logs -> imp logs (-f follows the session)'))
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
