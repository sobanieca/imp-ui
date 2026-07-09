import { builtinModules } from 'node:module'
import { dirname, fromFileUrl, join, toFileUrl } from '@std/path'
import { denoPlugin } from '@deno/esbuild-plugin'
import { runEsbuild, shutdownBundler } from '../cli/src/deps.js'

const VENDOR_DIR = fromFileUrl(new URL('../cli/src/vendor/', import.meta.url))

const VERSIONS = {
  'happy-dom': '20.10.6',
  'puppeteer-core': '24.43.1',
  'eslint': '10.6.0',
  '@eslint/js': '10.0.1',
  'globals': '17.7.0',
  'jpeg-js': '0.4.4',
  'gifenc': '1.0.3',
  'jsonc-parser': '3.3.1',
}

const PREBUNDLES = [
  {
    file: 'happy_dom.js',
    packages: ['happy-dom'],
    entryCode: (v) => `export { Window } from 'npm:happy-dom@${v['happy-dom']}'\n`,
  },
  {
    file: 'puppeteer_core.js',
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
]

const versionBanner = (packages) =>
  `// ${packages.map((name) => `${name}@${VERSIONS[name]}`).join(' ')}`

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
  return output.contents.length
}

const pending = []
for (const spec of PREBUNDLES) {
  const existing = await firstLine(join(VENDOR_DIR, spec.file))
  if (existing !== versionBanner(spec.packages)) pending.push(spec)
}

if (pending.length) {
  const entryDir = await Deno.makeTempDir()
  try {
    for (const spec of pending) {
      console.error(`prebundling ${spec.file}…`)
      const size = await prebundle(spec, entryDir)
      console.error(`  ${spec.file} (${(size / 1024 / 1024).toFixed(2)} MB)`)
    }
  } finally {
    await shutdownBundler()
    await Deno.remove(entryDir, { recursive: true })
  }
}
