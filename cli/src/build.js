import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  relative,
  resolve,
  SEPARATOR,
  toFileUrl,
} from '@std/path'
import { denoPlugin } from '@deno/esbuild-plugin'
import { licensePolicy, loadImpConfig, mocksSetting, publicDirectory } from './config.js'
import { resolveEntryPath } from './entry.js'
import {
  applyEdits,
  headEdit,
  isLocalScriptSource,
  isModuleType,
  readHtml,
} from './html-document.js'
import { basePathOf, siteUrl } from './base-path.js'
import { envValuesScript, resolveEnvironment } from './environments.js'
import { foldFlagCalls, splitEnvAndFlags } from './flags.js'
import { formatSize } from './file-size.js'
import { ASSET_LOADERS, runEsbuild, shutdownBundler } from './deps.js'
import { namesSameFile, withoutUnreachableChunks } from './unreachable-chunks.js'
import { resolveDependencyAliases, resolveImpLibrary } from './bundling.js'
import { skillFileFor } from './skill.js'
import {
  LICENSE_NOTICES_FILE,
  licenseNoticeCount,
  licenseNoticesFile,
  licenseNoticesReference,
  splitLicenseNotices,
} from './license-notices.js'
import { readDependencyManifest, recordedNotices } from './dependency-manifest.js'
import { licenseViolationProblem, reviewLicenses } from './license-policy.js'
import { logger } from './logger.js'
import { productionDefines } from './development-checks.js'
import {
  assertServiceWorkerSource,
  OFFLINE_WORKER_SOURCE,
  precacheValues,
  runtimeValues,
  WORKER_ENTRY,
  workerEntryPlugin,
} from './service-worker.js'
import {
  APPLE_TOUCH_ICON,
  buildManifest,
  cacheVersion,
  pwaHeadTags,
  renderIconSet,
  serviceWorkerRegistration,
  validatePwaBuild,
} from './pwa.js'

const FLAGS_GLOBAL = 'globalThis.__IMP_FLAGS__'

const HASHED_FOLDER = 'chunks'

const HASHED_NAMES = `${HASHED_FOLDER}/[name]-[hash]`

const INLINE_ENTRY_SCHEME = 'imp-inline:'
const inlineModuleName = (index) => `.imp-inline-${index}.js`
const INLINE_MODULE_PATH = /[/\\]\.imp-inline-(\d+)\.js$/

const moduleScriptsOf = (document) => document.scripts.filter((script) => isModuleType(script.type))

const isInlineModule = (script) => script.src === null && script.text.trim() !== ''

function scriptPathOf(src, root) {
  const path = decodeURIComponent(src.split(/[?#]/)[0])
  return normalize(join(root, path.startsWith('/') ? path.slice(1) : path))
}

function parseHtmlEntryPoints(document, root, entryName) {
  const scripts = []
  const inlineSources = []
  for (const script of moduleScriptsOf(document)) {
    if (script.src !== null) {
      if (!isLocalScriptSource(script.src)) continue
      const filePath = scriptPathOf(script.src, root)
      if (!filePath.startsWith(normalize(root))) {
        throw new Error(`${entryName} references a script outside the project: ${script.src}`)
      }
      if (!scripts.includes(filePath)) scripts.push(filePath)
    } else if (isInlineModule(script)) {
      inlineSources.push(script.text)
    }
  }
  return { scripts, inlineSources }
}

const withoutExtension = (path) => path.slice(0, path.length - extname(path).length)

const asPosix = (path) => path.replaceAll('\\', '/')

const DECLARES_IMP_SKILL = /^\s*export\s+(?:const|let|var)\s+impSkill\b/m

const IMP_SKILL_INITIALIZER =
  /(\bexport\s+(?:const|let|var)\s+impSkill\s*=\s*)(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)/g

const EXPORT_CLAUSE = /\bexport\s*\{([^{}]*)\}/g

const exportedName = (specifier) => {
  const renamed = specifier.split(/\s+as\s+/)
  return (renamed[1] ?? renamed[0]).trim()
}

function withoutComponentSkill(source) {
  if (!source.includes('impSkill')) return source
  return source
    .replace(IMP_SKILL_INITIALIZER, '$1""')
    .replace(EXPORT_CLAUSE, (clause, specifiers) => {
      if (!specifiers.includes('impSkill')) return clause
      const kept = specifiers.split(',')
        .filter((specifier) => specifier.trim() && exportedName(specifier) !== 'impSkill')
      return `export{${kept.join(',')}}`
    })
}

async function withComponentSkill(path) {
  const source = await Deno.readTextFile(path)
  let skill
  try {
    skill = await Deno.readTextFile(skillFileFor(path))
  } catch {
    return source
  }
  if (DECLARES_IMP_SKILL.test(source)) {
    throw new Error(
      `${basename(path)} exports impSkill itself - a component's skill belongs in ${
        basename(skillFileFor(path))
      } next to it`,
    )
  }
  return `${source}\nexport const impSkill = ${JSON.stringify(skill.trimEnd())}\n`
}

function impResolverPlugin(
  { root, dependencies, inlineSources, impProvidedByHost, isHtmlEntry, flags },
) {
  return {
    name: 'imp',
    setup(build) {
      if (!impProvidedByHost) resolveImpLibrary(build, { tooling: false })
      resolveDependencyAliases(build, { root, dependencies })
      build.onResolve({ filter: new RegExp(`^${INLINE_ENTRY_SCHEME}\\d+$`) }, (args) => ({
        path: join(root, inlineModuleName(args.path.slice(INLINE_ENTRY_SCHEME.length))),
        namespace: 'file',
      }))
      build.onLoad({ filter: INLINE_MODULE_PATH, namespace: 'file' }, (args) => {
        const index = Number(args.path.match(INLINE_MODULE_PATH)[1])
        return {
          contents: foldFlagCalls(inlineSources[index], {
            flags,
            file: `inline script ${index + 1}`,
          }),
          loader: 'js',
        }
      })
      build.onLoad({ filter: /\.js$/, namespace: 'file' }, async (args) => ({
        contents: foldFlagCalls(
          isHtmlEntry
            ? withoutComponentSkill(await Deno.readTextFile(args.path))
            : await withComponentSkill(args.path),
          { flags, file: relative(root, args.path) },
        ),
        loader: 'js',
      }))
    },
  }
}

const publicPathOf = ({ isHtmlEntry, base }) => isHtmlEntry ? { publicPath: `${base}/` } : {}

function buildEntryPoints(
  {
    root,
    entryPoints,
    dependencies,
    inlineSources,
    outdir,
    impProvidedByHost,
    isHtmlEntry,
    flags,
    base,
  },
) {
  return runEsbuild({
    plugins: [
      impResolverPlugin({
        root,
        dependencies,
        inlineSources,
        impProvidedByHost,
        isHtmlEntry,
        flags,
      }),
      denoPlugin(),
    ],
    entryPoints,
    external: impProvidedByHost ? ['imp', 'imp/*'] : [],
    define: productionDefines(),
    bundle: true,
    splitting: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    legalComments: 'external',
    metafile: true,
    write: false,
    outdir,
    ...publicPathOf({ isHtmlEntry, base }),
    entryNames: isHtmlEntry ? HASHED_NAMES : '[dir]/[name]',
    chunkNames: HASHED_NAMES,
    assetNames: HASHED_NAMES,
    loader: ASSET_LOADERS,
  })
}

const SERVICE_WORKER_FILE = 'sw.js'

function buildServiceWorkerEntry({ root, worker, dependencies, outdir, flags, base }) {
  return runEsbuild({
    plugins: [
      workerEntryPlugin(root, OFFLINE_WORKER_SOURCE),
      impResolverPlugin({
        root,
        dependencies,
        inlineSources: [],
        impProvidedByHost: false,
        isHtmlEntry: true,
        flags,
      }),
      denoPlugin(),
    ],
    entryPoints: [{
      in: worker ? toFileUrl(worker).href : WORKER_ENTRY,
      out: withoutExtension(SERVICE_WORKER_FILE),
    }],
    define: productionDefines(),
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    legalComments: 'external',
    metafile: true,
    write: false,
    outdir,
    assetNames: HASHED_NAMES,
    publicPath: `${base}/`,
    loader: ASSET_LOADERS,
  })
}

function entryOutputs({ metafile, outputFiles }, inputs) {
  const outputs = new Map()
  for (const [output, { entryPoint }] of Object.entries(metafile.outputs)) {
    const input = entryPoint && inputs.find((path) => namesSameFile(path, entryPoint))
    const file = input && outputFiles.find(({ path }) => namesSameFile(path, output))
    if (file) outputs.set(input, file.path)
  }
  return outputs
}

async function bundleApp(options, { inputs, serviceWorker, offlineWorker }) {
  try {
    const bundled = await buildEntryPoints(options)
    const entries = entryOutputs(bundled, inputs)
    const page = { ...withoutUnreachableChunks(bundled, [...entries.values()]), entries }
    if (!serviceWorker && !offlineWorker) return page
    const worker = await buildServiceWorkerEntry({ ...options, worker: serviceWorker })
    return {
      ...page,
      outputFiles: [...page.outputFiles, ...worker.outputFiles],
      metafile: {
        inputs: { ...page.metafile.inputs, ...worker.metafile.inputs },
        outputs: page.metafile.outputs,
      },
    }
  } finally {
    await shutdownBundler()
  }
}

async function bundledDependencyManifests({ root, dependencies, metafile }) {
  const inputs = Object.keys(metafile.inputs).map(asPosix)
  const manifests = []
  const unrecorded = []
  for (const alias of Object.keys(dependencies)) {
    if (!inputs.some((input) => input.endsWith(`dependencies/${alias}/${alias}.js`))) continue
    const manifest = await readDependencyManifest(root, alias)
    if (manifest) manifests.push(manifest)
    else unrecorded.push(alias)
  }
  return { manifests, unrecorded }
}

function assertEveryFlagFolded(outputFiles) {
  const unfolded = outputFiles.find((file) =>
    file.path.endsWith('.js') && file.text.includes(FLAGS_GLOBAL)
  )
  if (unfolded) {
    throw new Error(
      `${
        basename(unfolded.path)
      } still reads a feature flag at runtime - every flag must be called as flag('NAME') with a literal name, from a module that imports flag from 'imp', so the build can fold it away`,
    )
  }
}

function inlineScriptEdits(document, { inlineOutputs, outdir, base }) {
  return moduleScriptsOf(document).filter(isInlineModule).flatMap((script, index) => {
    const src = siteUrl(base, asPosix(relative(outdir, inlineOutputs[index])))
    return [
      { start: script.start - 1, end: script.start - 1, text: ` src="${src}"` },
      { start: script.start, end: script.end, text: '' },
    ]
  })
}

const contentHash = async (text) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(
    new Uint8Array(digest).slice(0, 4),
    (byte) => byte.toString(16).padStart(2, '0'),
  )
    .join('').toUpperCase()
}

async function writeHashedScript({ outdir, name, text, written }) {
  const file = `${HASHED_FOLDER}/${name}-${await contentHash(text)}.js`
  await Deno.mkdir(join(outdir, HASHED_FOLDER), { recursive: true })
  await Deno.writeTextFile(join(outdir, file), text)
  written.push(file)
  return file
}

async function copyPublicFiles({ publicDir, outdir, written, reserved }) {
  let publicStat
  try {
    publicStat = await Deno.stat(publicDir)
  } catch {
    return
  }
  if (!publicStat.isDirectory) {
    throw new Error(`public must be a folder, not a file: ${publicDir}`)
  }
  const generated = new Set([...written, ...reserved])
  const hashedFolder = await Deno.stat(join(publicDir, HASHED_FOLDER)).catch(() => null)
  if (hashedFolder) {
    throw new Error(
      `public/${HASHED_FOLDER}/ is reserved - imp writes the hashed files of the build there, and a host caches that folder for a year; move the files to another folder`,
    )
  }
  const copy = async (directory, prefix) => {
    for await (const entry of Deno.readDir(directory)) {
      const path = join(directory, entry.name)
      const name = `${prefix}${entry.name}`
      if (entry.isDirectory) {
        await copy(path, `${name}/`)
      } else if (entry.isFile) {
        if (generated.has(name)) {
          throw new Error(`public file would overwrite a generated file: ${name}`)
        }
        const target = join(outdir, name)
        await Deno.mkdir(dirname(target), { recursive: true })
        await Deno.copyFile(path, target)
        written.push(name)
      }
    }
  }
  await copy(publicDir, '')
}

const isRootAbsolute = (url) => url.startsWith('/') && !url.startsWith('//')

function renamedScripts(document, root, outdir, entries) {
  const renamed = new Map()
  for (const script of moduleScriptsOf(document)) {
    if (script.src === null || !isLocalScriptSource(script.src)) continue
    const output = entries.get(scriptPathOf(script.src, root))
    if (!output || !script.srcAttribute) continue
    const suffix = script.src.match(/[?#].*$/)?.[0] ?? ''
    renamed.set(script.srcAttribute.start, `/${asPosix(relative(outdir, output))}${suffix}`)
  }
  return renamed
}

function urlEdits(document, { base, renamed }) {
  return document.urlAttributes.flatMap((attribute) => {
    const renamedValue = renamed.get(attribute.start)
    const value = renamedValue ?? attribute.value
    const prefix = base && isRootAbsolute(value) ? base : ''
    if (renamedValue !== undefined) {
      return [{ start: attribute.start, end: attribute.end, text: prefix + renamedValue }]
    }
    return prefix ? [{ start: attribute.start, end: attribute.start, text: prefix }] : []
  })
}

function staticImportsOf(metafile, entryOutputs) {
  const outputs = metafile.outputs
  const keyOf = (path) => Object.keys(outputs).find((key) => namesSameFile(path, key))
  const pending = entryOutputs.map(keyOf).filter(Boolean)
  const entries = new Set(pending)
  const reached = new Set()
  while (pending.length) {
    const key = pending.pop()
    for (const imported of outputs[key]?.imports ?? []) {
      if (imported.kind !== 'import-statement' || imported.external) continue
      if (reached.has(imported.path) || entries.has(imported.path)) continue
      reached.add(imported.path)
      pending.push(imported.path)
    }
  }
  return [...reached]
}

function modulePreloadTags({ metafile, outputFiles, entries, outdir, base }) {
  return staticImportsOf(metafile, [...entries.values()]).flatMap((key) => {
    const file = outputFiles.find(({ path }) => namesSameFile(path, key))
    if (!file) return []
    const href = siteUrl(base, asPosix(relative(outdir, file.path)))
    return [`<link rel="modulepreload" href="${href}">`]
  })
}

async function assertWithinBudget({ imp, outdirPath, written }) {
  const budget = imp.build?.maxSize
  if (budget === undefined) return
  const sizes = await Promise.all(
    written.map(async (name) => ({ name, size: (await Deno.stat(join(outdirPath, name))).size })),
  )
  const total = sizes.reduce((sum, { size }) => sum + size, 0)
  if (total <= budget) return
  await Deno.remove(outdirPath, { recursive: true }).catch(() => {})
  const largest = sizes.sort((one, other) => other.size - one.size).slice(0, 5)
    .map(({ name, size }) => `  ${name} (${formatSize(size)})`).join('\n')
  throw new Error(
    `the build is ${formatSize(total)}, over the budget of ${
      formatSize(budget)
    } that 'build.maxSize' sets in imp.json. imp wrote nothing. The largest files:\n${largest}`,
  )
}

async function precacheOfBuild({ outdirPath, base, written, shell }) {
  const precached = written.filter((name) => name !== SERVICE_WORKER_FILE)
  const files = await Promise.all(
    precached.map(async (name) => ({
      path: siteUrl(base, name),
      bytes: await Deno.readFile(join(outdirPath, name)),
    })),
  )
  return precacheValues({
    version: await cacheVersion(files),
    files: precached.map((name) => siteUrl(base, name)),
    shell: siteUrl(base, shell),
  })
}

export async function build(
  { entry = 'index.html', output = 'dist', pwa = false, env = null } = {},
) {
  const entryPath = await resolveEntryPath(entry, { expected: 'an HTML or JS file' })
  const root = dirname(entryPath)
  const entryName = basename(entryPath)
  const outdirPath = resolve(output)
  const insideOutdir = (path) =>
    normalize(path) === normalize(outdirPath) ||
    normalize(path).startsWith(normalize(outdirPath) + SEPARATOR)
  if (insideOutdir(root)) {
    throw new Error(`output directory must not contain the project: ${output}`)
  }

  const imp = await loadImpConfig(root)
  const dependencies = imp.dependencies ?? {}
  const selectedEnv = await resolveEnvironment({ root, config: imp, requestedAlias: env })
  const { env: resolvedEnv, flags } = splitEnvAndFlags({ config: imp, env: selectedEnv })
  const isHtmlEntry = ['.html', '.htm'].includes(extname(entryName).toLowerCase())
  const targetImpHost = imp.targetImpHost === true
  const impProvidedByHost = targetImpHost && !isHtmlEntry
  const impPwa = imp.pwa ?? null
  if (pwa) await validatePwaBuild(impPwa, isHtmlEntry, root)
  const serviceWorker = imp.serviceWorker && isHtmlEntry ? resolve(root, imp.serviceWorker) : null
  if (serviceWorker) await assertServiceWorkerSource(serviceWorker, imp.serviceWorker)

  let html = null
  let document = null
  let scripts = [entryPath]
  let inlineSources = []
  if (isHtmlEntry) {
    html = await Deno.readTextFile(entryPath)
    document = readHtml(html)
    const parsed = parseHtmlEntryPoints(document, root, entryName)
    scripts = parsed.scripts
    inlineSources = parsed.inlineSources
  }
  if (!scripts.length && !inlineSources.length) {
    throw new Error(`${entryName} has no module scripts to bundle`)
  }

  const entryPoints = [
    ...scripts.map((path) => ({
      in: toFileUrl(path).href,
      out: asPosix(withoutExtension(relative(root, path))),
    })),
    ...inlineSources.map((_, index) => ({
      in: `${INLINE_ENTRY_SCHEME}${index}`,
      out: `inline-${index + 1}`,
    })),
  ]

  const base = basePathOf(resolvedEnv)
  const result = await bundleApp({
    root,
    entryPoints,
    dependencies,
    inlineSources,
    outdir: outdirPath,
    impProvidedByHost,
    isHtmlEntry,
    flags,
    base,
  }, {
    inputs: [...scripts, ...inlineSources.map((_, index) => join(root, inlineModuleName(index)))],
    serviceWorker,
    offlineWorker: pwa && isHtmlEntry,
  })

  assertEveryFlagFolded(result.outputFiles)

  const { code: outputFiles, notices: embedded } = splitLicenseNotices(result.outputFiles)
  const { manifests, unrecorded } = await bundledDependencyManifests({
    root,
    dependencies,
    metafile: result.metafile,
  })
  if (unrecorded.length) {
    logger.warn(
      `no manifest.json for ${unrecorded.join(', ')} - the licenses of ${
        unrecorded.length === 1 ? 'that dependency are' : 'those dependencies are'
      } missing from ${LICENSE_NOTICES_FILE}; run 'imp install' to record them`,
    )
  }
  const policy = licensePolicy(imp)
  const { violations } = reviewLicenses(manifests, policy)
  if (violations.length) throw new Error(licenseViolationProblem(violations, policy))
  const notices = { recorded: recordedNotices(manifests), embedded }
  const noticeCount = licenseNoticeCount(notices)
  const noticeReference = noticeCount
    ? licenseNoticesReference(siteUrl(base, LICENSE_NOTICES_FILE))
    : ''
  const withNoticeReference = (text) => new TextEncoder().encode(noticeReference + text)
  const workerPath = join(outdirPath, SERVICE_WORKER_FILE)
  const workerFile = isHtmlEntry ? outputFiles.find((file) => file.path === workerPath) : null

  await Deno.remove(outdirPath, { recursive: true }).catch(() => {})
  await Deno.mkdir(outdirPath, { recursive: true })
  const written = []
  const inlineOutputs = inlineSources.map((_, index) =>
    result.entries.get(join(root, inlineModuleName(index)))
  )
  for (const file of outputFiles) {
    if (file === workerFile) continue
    await Deno.mkdir(dirname(file.path), { recursive: true })
    await Deno.writeFile(
      file.path,
      file.path.endsWith('.js') ? withNoticeReference(file.text) : file.contents,
    )
    written.push(asPosix(relative(outdirPath, file.path)))
  }
  if (noticeCount) {
    await Deno.writeTextFile(join(outdirPath, LICENSE_NOTICES_FILE), licenseNoticesFile(notices))
    written.push(LICENSE_NOTICES_FILE)
  }
  if (isHtmlEntry) {
    const headTags = modulePreloadTags({
      metafile: result.metafile,
      outputFiles,
      entries: result.entries,
      outdir: outdirPath,
      base,
    })
    if (Object.keys(resolvedEnv).length) {
      const file = await writeHashedScript({
        outdir: outdirPath,
        name: 'env',
        text: envValuesScript(resolvedEnv),
        written,
      })
      headTags.push(`<script src="${siteUrl(base, file)}"></script>`)
    }
    if (pwa) {
      for (const icon of await renderIconSet({ root, pwa: impPwa })) {
        const path = join(outdirPath, icon.file)
        await Deno.mkdir(dirname(path), { recursive: true })
        await Deno.writeFile(path, icon.bytes)
        written.push(icon.file)
      }
      await Deno.writeTextFile(
        join(outdirPath, 'manifest.webmanifest'),
        buildManifest(impPwa, {
          iconBase: `${base}/`,
          startUrl: `${base}/`,
          scope: `${base}/`,
        }),
      )
      written.push('manifest.webmanifest')
      headTags.push(pwaHeadTags({
        manifestHref: siteUrl(base, 'manifest.webmanifest'),
        themeColor: impPwa.themeColor,
        appleTouchHref: siteUrl(base, APPLE_TOUCH_ICON),
      }))
      const registration = await writeHashedScript({
        outdir: outdirPath,
        name: 'register-service-worker',
        text: serviceWorkerRegistration(siteUrl(base, SERVICE_WORKER_FILE)),
        written,
      })
      headTags.push(`<script src="${siteUrl(base, registration)}"></script>`)
    }
    const edits = [
      ...inlineScriptEdits(document, { inlineOutputs, outdir: outdirPath, base }),
      ...urlEdits(document, {
        base,
        renamed: renamedScripts(document, root, outdirPath, result.entries),
      }),
    ]
    const head = headTags.filter(Boolean).join('\n')
    if (head) edits.push(headEdit(document, head))
    const builtHtml = applyEdits(html, edits)
    await Deno.writeTextFile(join(outdirPath, entryName), builtHtml)
    written.push(entryName)
    await copyPublicFiles({
      publicDir: publicDirectory(root),
      outdir: outdirPath,
      written,
      reserved: workerFile ? [SERVICE_WORKER_FILE] : [],
    })
    if (workerFile) {
      const precache = pwa
        ? await precacheOfBuild({ outdirPath, base, written, shell: entryName })
        : ''
      const values = serviceWorker ? runtimeValues({ env: resolvedEnv }) : ''
      await Deno.writeFile(workerPath, withNoticeReference(values + precache + workerFile.text))
      written.push(SERVICE_WORKER_FILE)
    }
  }

  await assertWithinBudget({ imp, outdirPath, written })

  console.log(`built ${entryName} -> ${relative(Deno.cwd(), outdirPath) || '.'}/`)
  const mocksFolder = mocksSetting(imp)?.folder
  if (mocksFolder && isHtmlEntry) {
    console.log(`  ${mocksFolder}/ left out - mocks serve in imp start`)
  }
  if (base && isHtmlEntry) {
    console.log(`  base path ${base} - root-absolute urls prefixed for a sub-path deployment`)
  }
  if (noticeCount) {
    const count = `${noticeCount} third-party license notice${noticeCount === 1 ? '' : 's'}`
    console.log(`  ${LICENSE_NOTICES_FILE} - ${count}, referenced from every script emitted`)
  }
  const flagNames = Object.keys(flags)
  if (flagNames.length) {
    const states = flagNames.map((flagName) => `${flagName} ${flags[flagName] ? 'on' : 'off'}`)
    console.log(`  flags folded in - ${states.join(', ')}`)
  }
  if (serviceWorker && isHtmlEntry) {
    console.log(`  ${SERVICE_WORKER_FILE} - your service worker, bundled from ${imp.serviceWorker}`)
  }
  if (pwa) {
    console.log(
      serviceWorker
        ? '  PWA: manifest, icons (192, 512, maskable, apple-touch), your service worker registered'
        : '  PWA: manifest, icons (192, 512, maskable, apple-touch), offline service worker',
    )
    console.log('  installable - name, 192 + 512 icons, display, start_url all present')
  }
  if (impProvidedByHost) {
    console.log('  imp imports kept bare - resolved by the imp host at runtime')
  } else if (targetImpHost && isHtmlEntry) {
    console.log('  targetImpHost ignored - an HTML page is its own host, imp is bundled in')
  }
  written.sort()
  for (const name of written) {
    const { size } = await Deno.stat(join(outdirPath, name))
    console.log(`  ${name} (${formatSize(size)})`)
  }
}
