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
import { loadImpConfig, mocksSetting, publicDirectory } from './config.js'
import { resolveEntryPath } from './entry.js'
import { basePathOf, siteUrl } from './base_path.js'
import { envInjectionScript, resolveEnvironment } from './environments.js'
import { foldFlagCalls, splitEnvAndFlags } from './flags.js'
import { formatSize } from './file_size.js'
import { ASSET_LOADERS, runEsbuild, shutdownBundler } from './deps.js'
import { resolveDependencyAliases, resolveImpLibrary } from './bundling.js'
import { skillFileFor } from './skill.js'
import {
  APPLE_TOUCH_ICON,
  buildManifest,
  buildServiceWorker,
  cacheVersion,
  pwaHeadTags,
  renderIconSet,
  validatePwaBuild,
} from './pwa.js'

const SCRIPT_TAG = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi

const FLAGS_GLOBAL = 'globalThis.__IMP_FLAGS__'

const INLINE_ENTRY_SCHEME = 'imp-inline:'
const inlineModuleName = (index) => `.imp-inline-${index}.js`
const INLINE_MODULE_PATH = /[/\\]\.imp-inline-(\d+)\.js$/

function attributeValue(attributes, name) {
  const pattern = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i')
  const match = attributes.match(pattern)
  return match ? match[1] ?? match[2] ?? match[3] : null
}

const isLocalSource = (src) => !/^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith('//')

const isModuleScript = (attributes) =>
  attributeValue(attributes, 'type')?.toLowerCase() === 'module'

function parseHtmlEntryPoints(html, root, entryName) {
  const scripts = []
  const inlineSources = []
  for (const [, attributes, content] of html.matchAll(SCRIPT_TAG)) {
    if (!isModuleScript(attributes)) continue
    const src = attributeValue(attributes, 'src')
    if (src) {
      if (!isLocalSource(src)) continue
      const path = decodeURIComponent(src.split(/[?#]/)[0])
      const filePath = normalize(join(root, path.startsWith('/') ? path.slice(1) : path))
      if (!filePath.startsWith(normalize(root))) {
        throw new Error(`${entryName} references a script outside the project: ${src}`)
      }
      if (!scripts.includes(filePath)) scripts.push(filePath)
    } else if (content.trim()) {
      inlineSources.push(content)
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

async function buildEntryPoints(
  { root, entryPoints, dependencies, inlineSources, outdir, impProvidedByHost, isHtmlEntry, flags },
) {
  try {
    return await runEsbuild({
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
      bundle: true,
      splitting: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      legalComments: 'none',
      write: false,
      outdir,
      chunkNames: 'chunks/[name]-[hash]',
      assetNames: 'assets/[name]-[hash]',
      loader: ASSET_LOADERS,
    })
  } finally {
    await shutdownBundler()
  }
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

function replaceInlineScripts(html, inlineOutputs) {
  let index = 0
  return html.replace(SCRIPT_TAG, (tag, attributes, content) => {
    if (!isModuleScript(attributes) || attributeValue(attributes, 'src') || !content.trim()) {
      return tag
    }
    const bundled = inlineOutputs[index++].trim().replace(/<\/script/gi, '<\\/script')
    return `<script${attributes}>\n${bundled}\n</script>`
  })
}

async function copyPublicFiles({ publicDir, outdir, written }) {
  let publicStat
  try {
    publicStat = await Deno.stat(publicDir)
  } catch {
    return
  }
  if (!publicStat.isDirectory) {
    throw new Error(`public must be a folder, not a file: ${publicDir}`)
  }
  const generated = new Set(written)
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

const ROOT_ABSOLUTE_URL_ATTRIBUTE = /\b(href|src)(\s*=\s*)(["'])(\/(?!\/)[^"']*)\3/gi

function rewriteRootAbsoluteUrls(html, base) {
  if (!base) return html
  const prefix = (text) =>
    text.replace(
      ROOT_ABSOLUTE_URL_ATTRIBUTE,
      (_match, attribute, equals, quote, path) =>
        `${attribute}${equals}${quote}${base}${path}${quote}`,
    )
  let result = ''
  let lastIndex = 0
  for (const match of html.matchAll(SCRIPT_TAG)) {
    const [tag, , content] = match
    const openTagEnd = tag.indexOf('>') + 1
    result += prefix(html.slice(lastIndex, match.index))
    result += prefix(tag.slice(0, openTagEnd)) + content + tag.slice(openTagEnd + content.length)
    lastIndex = match.index + tag.length
  }
  return result + prefix(html.slice(lastIndex))
}

function injectHead(html, headTags) {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}\n${headTags}`)
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (open) => `${open}\n<head>${headTags}</head>`)
  }
  return `${headTags}\n${html}`
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

  let html = null
  let scripts = [entryPath]
  let inlineSources = []
  if (isHtmlEntry) {
    html = await Deno.readTextFile(entryPath)
    const parsed = parseHtmlEntryPoints(html, root, entryName)
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
      out: withoutExtension(inlineModuleName(index)),
    })),
  ]

  const result = await buildEntryPoints({
    root,
    entryPoints,
    dependencies,
    inlineSources,
    outdir: outdirPath,
    impProvidedByHost,
    isHtmlEntry,
    flags,
  })

  assertEveryFlagFolded(result.outputFiles)

  await Deno.remove(outdirPath, { recursive: true }).catch(() => {})
  const written = []
  const inlineOutputs = []
  for (const file of result.outputFiles) {
    const inline = file.path.match(INLINE_MODULE_PATH)
    if (inline) {
      inlineOutputs[Number(inline[1])] = file.text
      continue
    }
    await Deno.mkdir(dirname(file.path), { recursive: true })
    await Deno.writeFile(file.path, file.contents)
    written.push(asPosix(relative(outdirPath, file.path)))
  }

  const base = basePathOf(resolvedEnv)
  if (isHtmlEntry) {
    let builtHtml = rewriteRootAbsoluteUrls(replaceInlineScripts(html, inlineOutputs), base)
    const envTag = envInjectionScript(resolvedEnv)
    if (envTag) builtHtml = injectHead(builtHtml, envTag)
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
      builtHtml = injectHead(
        builtHtml,
        pwaHeadTags({
          manifestHref: siteUrl(base, 'manifest.webmanifest'),
          themeColor: impPwa.themeColor,
          appleTouchHref: siteUrl(base, APPLE_TOUCH_ICON),
          swHref: siteUrl(base, 'sw.js'),
        }),
      )
    }
    await Deno.mkdir(outdirPath, { recursive: true })
    await Deno.writeTextFile(join(outdirPath, entryName), builtHtml)
    written.push(entryName)
    await copyPublicFiles({ publicDir: publicDirectory(root), outdir: outdirPath, written })
    if (pwa) {
      const precache = written.filter((name) => name !== 'sw.js' && !name.endsWith('.map'))
      const files = await Promise.all(
        precache.map(async (name) => ({
          path: siteUrl(base, name),
          bytes: await Deno.readFile(join(outdirPath, name)),
        })),
      )
      const serviceWorker = buildServiceWorker({
        cacheName: `imp-pwa-${await cacheVersion(files)}`,
        precache: precache.map((name) => siteUrl(base, name)),
        shell: siteUrl(base, entryName),
      })
      await Deno.writeTextFile(join(outdirPath, 'sw.js'), serviceWorker)
      written.push('sw.js')
    }
  }

  console.log(`built ${entryName} → ${relative(Deno.cwd(), outdirPath) || '.'}/`)
  const mocksFolder = mocksSetting(imp)?.folder
  if (mocksFolder && isHtmlEntry) {
    console.log(`  ${mocksFolder}/ left out - mocks serve in imp start`)
  }
  if (base && isHtmlEntry) {
    console.log(`  base path ${base} - root-absolute urls prefixed for a sub-path deployment`)
  }
  const flagNames = Object.keys(flags)
  if (flagNames.length) {
    const states = flagNames.map((flagName) => `${flagName} ${flags[flagName] ? 'on' : 'off'}`)
    console.log(`  flags folded in - ${states.join(', ')}`)
  }
  if (pwa) {
    console.log('  PWA: manifest, icons (192, 512, maskable, apple-touch), offline service worker')
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
