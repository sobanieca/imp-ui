import { builtinModules } from 'node:module'
import { dirname, fromFileUrl, join, resolve, toFileUrl } from '@std/path'
import { denoPlugin } from '@deno/esbuild-plugin'
import { bundledPackages, packageId, runEsbuild, shutdownBundler } from '../cli/src/deps.js'
import { recordPackageLicenses } from '../cli/src/dependency-manifest.js'

const VENDOR_DIR = fromFileUrl(new URL('../cli/src/vendor/', import.meta.url))
const LICENSES_FILE = fromFileUrl(new URL('../THIRD-PARTY-LICENSES.md', import.meta.url))

const PACKAGES_HEADING = '## Packages inside the prebundled tools'
const PACKAGES_INTRO = [
  'Each prebundled tool below contains the npm packages that it depends on. This list is generated when',
  'the tool is bundled. Each line gives a package, its license, and its copyright lines. imp reads',
  'those lines from the license file and from the header comments of the bundled files of the package.',
  'The text of each license is above.',
].join('\n')
const TOOL_HEADING = '### '

const VERSIONS = {
  'happy-dom': '20.10.6',
  'puppeteer-core': '24.43.1',
  'eslint': '10.6.0',
  '@eslint/js': '10.0.1',
  'globals': '17.7.0',
  'jpeg-js': '0.4.4',
  'gifenc': '1.0.3',
  'jsonc-parser': '3.3.1',
  'marked': '18.0.12',
  'parse5': '8.0.1',
}

const PREBUNDLES = [
  {
    file: 'happy-dom.js',
    packages: ['happy-dom'],
    entryCode: (v) => `export { Window } from 'npm:happy-dom@${v['happy-dom']}'\n`,
  },
  {
    file: 'puppeteer-core.js',
    packages: ['puppeteer-core'],
    entryCode: (v) => `export { default } from 'npm:puppeteer-core@${v['puppeteer-core']}'\n`,
  },
  {
    file: 'eslint.js',
    packages: ['eslint', '@eslint/js', 'globals'],
    entryCode: (v) =>
      [
        `export { Linter } from 'npm:eslint@${v['eslint']}/universal'`,
        `import js from 'npm:@eslint/js@${v['@eslint/js']}'`,
        `import allGlobals from 'npm:globals@${v['globals']}'`,
        'export const recommendedRules = js.configs.recommended.rules',
        'export const browserGlobals = allGlobals.browser',
        '',
      ].join('\n'),
  },
  {
    file: 'video.js',
    packages: ['jpeg-js', 'gifenc'],
    entryCode: (v) =>
      [
        `import jpeg from 'npm:jpeg-js@${v['jpeg-js']}'`,
        `import { applyPalette, GIFEncoder, quantize } from 'npm:gifenc@${v['gifenc']}'`,
        'export const decodeJpeg = (bytes) => jpeg.decode(bytes, { useTArray: true })',
        'export const encodeJpeg = (image, quality) => jpeg.encode(image, quality).data',
        'export { applyPalette, GIFEncoder, quantize }',
        '',
      ].join('\n'),
  },
  {
    file: 'jsonc.js',
    packages: ['jsonc-parser'],
    entryCode: (v) =>
      `export { applyEdits, modify, parse, printParseErrorCode } from 'npm:jsonc-parser@${
        v['jsonc-parser']
      }'\n`,
  },
  {
    file: 'marked.js',
    packages: ['marked'],
    entryCode: (v) => `export { marked } from 'npm:marked@${v['marked']}'\n`,
  },
  {
    file: 'parse5.js',
    packages: ['parse5'],
    entryCode: (v) => `export { parse } from 'npm:parse5@${v['parse5']}'\n`,
  },
]

const toolName = (packages) => packages.map((name) => `${name}@${VERSIONS[name]}`).join(' ')

const versionBanner = (packages) => `// ${toolName(packages)}`

const COPYRIGHT_LINE = /copyright\s+\S|\(c\)\s*\d|©\s*\d/i
const LICENSE_TERMS =
  /(above|the|own) copyright|copyright (notice|holder|owner|license|statement|in it)|must retain|\[yyyy\]|\{yyyy\}/i

const LEADING_COMMENTS = /^(?:#![^\n]*)?((?:\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*))+)/

const copyrightLinesIn = (text) =>
  text.split('\n')
    .map((line) =>
      line.replace(/^[\s#*/-]+/, '').replace(/\*\/\s*$/, '').replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>').trim()
    )
    .filter((line) => COPYRIGHT_LINE.test(line) && !LICENSE_TERMS.test(line))

const readPackageFile = (directory, file) =>
  Deno.readTextFile(resolve('/', directory, file)).catch(() => '')

async function copyrightLines({ directory, files }, licenseText) {
  const headers = await Promise.all(
    files.map(async (file) =>
      (await readPackageFile(directory, file)).match(LEADING_COMMENTS)?.[1] ?? ''
    ),
  )
  const lines = [licenseText ?? '', ...headers].flatMap(copyrightLinesIn)
  if (!lines.length) lines.push(...copyrightLinesIn(await readPackageFile(directory, 'README.md')))
  return [...new Set(lines)]
}

const packageLine = ({ name, version, license, copyrights }) =>
  [packageId({ name, version }), license ?? 'license not declared', ...copyrights].join(' - ')

const toolSection = (spec, packages) =>
  [
    `${TOOL_HEADING}${toolName(spec.packages)}`,
    ['```', ...packages.map(packageLine), '```'].join('\n'),
  ]
    .join('\n\n')

async function readToolSections() {
  const text = await Deno.readTextFile(LICENSES_FILE)
  const start = text.indexOf(`\n${PACKAGES_HEADING}\n`)
  const handWritten = (start === -1 ? text : text.slice(0, start)).trimEnd().replace(/\n---$/, '')
  const sections = new Map()
  if (start !== -1) {
    const generated = text.slice(start + 1)
    for (const section of generated.split(`\n${TOOL_HEADING}`).slice(1)) {
      const name = section.slice(0, section.indexOf('\n'))
      sections.set(name, `${TOOL_HEADING}${section.trimEnd()}`)
    }
  }
  return { handWritten, sections }
}

async function writeToolSections({ handWritten, sections }) {
  const ordered = PREBUNDLES.map((spec) => sections.get(toolName(spec.packages)))
  const generated = [PACKAGES_HEADING, PACKAGES_INTRO, ...ordered].join('\n\n')
  await Deno.writeTextFile(LICENSES_FILE, `${handWritten}\n\n---\n\n${generated}\n`)
}

const REQUIRE_SHIM = [
  "import { createRequire as __impCreateRequire } from 'node:module'",
  'const require = __impCreateRequire(import.meta.url)',
].join('\n')

const firstLine = async (path) => {
  try {
    const text = await Deno.readTextFile(path)
    return text.slice(0, text.indexOf('\n'))
  } catch {
    return null
  }
}

const NODE_BUILTINS = new Set(builtinModules)
const OPTIONAL_NATIVE_ADDONS = new Set(['supports-color', 'utf-8-validate', 'bufferutil'])
const CJS_MAIN_REDIRECTS = { esquery: 'esquery/dist/esquery.min.js' }

const externalizePlugin = () => ({
  name: 'externalize',
  setup(build) {
    build.onResolve({ filter: /^node:/ }, (args) => ({ path: args.path, external: true }))
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      if (NODE_BUILTINS.has(args.path)) return { path: `node:${args.path}`, external: true }
      if (OPTIONAL_NATIVE_ADDONS.has(args.path)) return { path: args.path, external: true }
      const redirect = CJS_MAIN_REDIRECTS[args.path]
      if (redirect) {
        return build.resolve(redirect, {
          importer: args.importer,
          kind: args.kind,
          resolveDir: args.resolveDir,
        })
      }
      return null
    })
  },
})

const prebundle = async (spec, entryDir) => {
  const entryPath = join(entryDir, spec.file)
  await Deno.writeTextFile(entryPath, spec.entryCode(VERSIONS))
  const result = await runEsbuild({
    plugins: [externalizePlugin(), denoPlugin()],
    entryPoints: [toFileUrl(entryPath).href],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    legalComments: 'eof',
    metafile: true,
    banner: { js: `${versionBanner(spec.packages)}\n${REQUIRE_SHIM}` },
    write: false,
    outdir: '/prebundle',
  })
  const [output] = result.outputFiles
  const target = join(VENDOR_DIR, spec.file)
  await Deno.mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.tmp`
  await Deno.writeFile(temporary, output.contents)
  await Deno.rename(temporary, target)
  const bundled = bundledPackages(result.metafile)
  const licenses = await recordPackageLicenses(bundled)
  const packages = await Promise.all(
    bundled.map(async (entry, index) => ({
      ...licenses[index],
      copyrights: await copyrightLines(entry, licenses[index].licenseText),
    })),
  )
  return { size: output.contents.length, section: toolSection(spec, packages) }
}

const licenses = await readToolSections()
const pending = []
for (const spec of PREBUNDLES) {
  const existing = await firstLine(join(VENDOR_DIR, spec.file))
  const recorded = licenses.sections.has(toolName(spec.packages))
  if (existing !== versionBanner(spec.packages) || !recorded) pending.push(spec)
}

if (pending.length) {
  const entryDir = await Deno.makeTempDir()
  try {
    for (const spec of pending) {
      console.error(`prebundling ${spec.file}...`)
      const { size, section } = await prebundle(spec, entryDir)
      licenses.sections.set(toolName(spec.packages), section)
      console.error(`  ${spec.file} (${(size / 1024 / 1024).toFixed(2)} MB)`)
    }
    await writeToolSections(licenses)
  } finally {
    await shutdownBundler()
    await Deno.remove(entryDir, { recursive: true })
  }
}
