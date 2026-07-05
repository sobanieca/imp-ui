import {
  basename,
  dirname,
  extname,
  fromFileUrl,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  SEPARATOR,
  toFileUrl,
} from '@std/path'
import { denoPlugin } from '@deno/esbuild-plugin'
import { loadImpConfig } from './config.js'
import { ASSET_LOADERS, runEsbuild, shutdownBundler } from './deps.js'

const IMP_LIBRARY_URL = import.meta.resolve('../imp.js')

const SCRIPT_TAG = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi

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

function impResolverPlugin({ root, dependencies, inlineSources, impProvidedByHost }) {
  const aliases = Object.keys(dependencies)
  const escapeForRegExp = (text) => text.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  return {
    name: 'imp',
    setup(build) {
      if (!impProvidedByHost) {
        build.onResolve({ filter: /^imp$/ }, () => ({
          path: IMP_LIBRARY_URL,
          namespace: 'imp-library',
        }))
        build.onResolve({ filter: /.*/, namespace: 'imp-library' }, (args) => ({
          path: new URL(args.path, args.importer).href,
          namespace: 'imp-library',
        }))
        build.onLoad({ filter: /.*/, namespace: 'imp-library' }, async (args) => ({
          contents: await Deno.readTextFile(new URL(args.path)),
          loader: 'js',
        }))
      }
      if (aliases.length) {
        const aliasFilter = new RegExp(`^(${aliases.map(escapeForRegExp).join('|')})$`)
        build.onResolve({ filter: aliasFilter }, async (args) => {
          const path = join(root, 'dependencies', args.path, `${args.path}.js`)
          try {
            await Deno.stat(path)
          } catch {
            throw new Error(
              `dependency '${args.path}' is declared but not vendored — run 'imp install'`,
            )
          }
          return { path }
        })
      }
      build.onResolve({ filter: new RegExp(`^${INLINE_ENTRY_SCHEME}\\d+$`) }, (args) => ({
        path: join(root, inlineModuleName(args.path.slice(INLINE_ENTRY_SCHEME.length))),
        namespace: 'file',
      }))
      build.onLoad({ filter: INLINE_MODULE_PATH, namespace: 'file' }, (args) => ({
        contents: inlineSources[Number(args.path.match(INLINE_MODULE_PATH)[1])],
        loader: 'js',
      }))
    },
  }
}

async function buildEntryPoints(
  { root, entryPoints, dependencies, inlineSources, outdir, impProvidedByHost },
) {
  try {
    return await runEsbuild({
      plugins: [
        impResolverPlugin({ root, dependencies, inlineSources, impProvidedByHost }),
        denoPlugin(),
      ],
      entryPoints,
      external: impProvidedByHost ? ['imp'] : [],
      bundle: true,
      splitting: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      legalComments: 'none',
      metafile: true,
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

function bundledInputPaths(metafile) {
  const paths = new Set()
  for (const key of Object.keys(metafile.inputs)) {
    if (key.startsWith('file://')) {
      paths.add(normalize(fromFileUrl(key)))
      continue
    }
    for (const candidate of [key, SEPARATOR + key]) {
      if (isAbsolute(candidate)) {
        paths.add(normalize(candidate))
        break
      }
    }
  }
  return paths
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

async function copyStaticFiles({ root, outdir, skipFiles, written }) {
  const skippedDirectories = new Set(['.git', '.imp', 'node_modules'])
  const skippedRootFiles = new Set(['imp.json', 'imp.lock'])
  const copy = async (directory, prefix) => {
    for await (const entry of Deno.readDir(directory)) {
      const path = join(directory, entry.name)
      if (entry.isDirectory) {
        if (skippedDirectories.has(entry.name) || normalize(path) === normalize(outdir)) continue
        await copy(path, `${prefix}${entry.name}/`)
      } else if (entry.isFile) {
        if (!prefix && skippedRootFiles.has(entry.name)) continue
        if (skipFiles.has(normalize(path))) continue
        const target = join(outdir, prefix, entry.name)
        await Deno.mkdir(dirname(target), { recursive: true })
        await Deno.copyFile(path, target)
        written.push(`${prefix}${entry.name}`)
      }
    }
  }
  await copy(root, '')
}

const formatSize = (bytes) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`

export async function bundle({ entry = 'index.html', outdir = 'dist' } = {}) {
  const entryPath = resolve(entry)
  let entryStat
  try {
    entryStat = await Deno.stat(entryPath)
  } catch {
    throw new Error(`file not found: ${entry}`)
  }
  if (entryStat.isDirectory) {
    throw new Error(`expected an HTML or JS file, got a directory: ${entry}`)
  }

  const root = dirname(entryPath)
  const entryName = basename(entryPath)
  const outdirPath = resolve(outdir)
  const insideOutdir = (path) =>
    normalize(path) === normalize(outdirPath) ||
    normalize(path).startsWith(normalize(outdirPath) + SEPARATOR)
  if (insideOutdir(root)) {
    throw new Error(`output directory must not contain the project: ${outdir}`)
  }

  const imp = await loadImpConfig(root)
  const dependencies = imp.dependencies ?? {}
  const isHtmlEntry = ['.html', '.htm'].includes(extname(entryName).toLowerCase())
  const targetImpHost = imp.targetImpHost === true
  const impProvidedByHost = targetImpHost && !isHtmlEntry

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
  })

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

  const skipFiles = bundledInputPaths(result.metafile)
  if (isHtmlEntry) {
    const builtHtml = replaceInlineScripts(html, inlineOutputs)
    await Deno.mkdir(outdirPath, { recursive: true })
    await Deno.writeTextFile(join(outdirPath, entryName), builtHtml)
    written.push(entryName)
    skipFiles.add(normalize(entryPath))
    await copyStaticFiles({ root, outdir: outdirPath, skipFiles, written })
  }

  console.log(`bundled ${entryName} → ${relative(Deno.cwd(), outdirPath) || '.'}/`)
  if (impProvidedByHost) {
    console.log('  imp imports kept bare — resolved by the imp host at runtime')
  } else if (targetImpHost && isHtmlEntry) {
    console.log('  targetImpHost ignored — an HTML page is its own host, imp is bundled in')
  }
  written.sort()
  for (const name of written) {
    const { size } = await Deno.stat(join(outdirPath, name))
    console.log(`  ${name} (${formatSize(size)})`)
  }
}
