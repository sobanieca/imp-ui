import { basename, isAbsolute } from '@std/path'
import * as esbuild from 'esbuild-wasm/esm/browser.js'
import { denoPlugin } from '@deno/esbuild-plugin'
import { esbuildOptions, nativeResult } from './esbuild-paths.js'

const ESBUILD_WASM_URL = import.meta.resolve('esbuild-wasm/esbuild.wasm')

let esbuildReady = null
function initEsbuild() {
  if (!esbuildReady) {
    esbuildReady = (async () => {
      const wasmModule = await WebAssembly.compile(await Deno.readFile(new URL(ESBUILD_WASM_URL)))
      await esbuild.initialize({ wasmModule, worker: false })
    })()
  }
  return esbuildReady
}

export const BINARY_ASSET_EXTENSIONS = [
  '.wasm',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
]

const TEXT_ASSET_EXTENSIONS = ['.css', '.txt', '.json']

const loadersFor = (extensions, loader) =>
  Object.fromEntries(extensions.map((extension) => [extension, loader]))

export const ASSET_LOADERS = loadersFor(BINARY_ASSET_EXTENSIONS, 'file')

export const DATAURL_ASSET_LOADERS = loadersFor(
  [...BINARY_ASSET_EXTENSIONS, ...TEXT_ASSET_EXTENSIONS],
  'dataurl',
)

const NPM_CACHE_PATH = /[/\\]npm[/\\][^/\\]+[/\\](@[^/\\]+[/\\][^/\\]+|[^/\\]+)[/\\]([^/\\]+)[/\\]/
const JSR_CACHE_PATH = /jsr\.io\/(@[^/]+\/[^/]+)\/([^/]+)\//

export const packageId = ({ name, version }) => `${name}@${version}`

function packageRecord(input) {
  const npm = input.match(NPM_CACHE_PATH)
  if (npm) {
    return {
      registry: 'npm',
      name: npm[1].replaceAll('\\', '/'),
      version: npm[2].split('_')[0],
      directory: input.slice(0, npm.index + npm[0].length),
    }
  }
  const jsr = input.match(JSR_CACHE_PATH)
  if (jsr) {
    return {
      registry: 'jsr',
      name: jsr[1],
      version: jsr[2],
      directory: null,
    }
  }
  return null
}

const packageFile = (record, input) =>
  record.directory ? input.slice(record.directory.length).replaceAll('\\', '/') : null

export function bundledPackages(metafile) {
  const packages = new Map()
  for (const input of Object.keys(metafile.inputs)) {
    const record = packageRecord(input)
    if (!record) continue
    const id = packageId(record)
    if (!packages.has(id)) packages.set(id, { ...record, files: [] })
    const file = packageFile(record, input)
    if (file && !packages.get(id).files.includes(file)) packages.get(id).files.push(file)
  }
  return [...packages.values()].sort((a, b) => packageId(a).localeCompare(packageId(b)))
}

export const bundledFiles = (metafile) =>
  Object.keys(metafile.inputs).filter((input) => isAbsolute(input))

export async function runEsbuild(options, { os = Deno.build.os } = {}) {
  await initEsbuild()
  const translated = esbuildOptions(options, { os, cwd: Deno.cwd() })
  const result = await esbuild.build(translated)
  return nativeResult(result, { os, absWorkingDir: translated.absWorkingDir })
}

function keptImpImports(metafile) {
  const kept = new Set()
  for (const output of Object.values(metafile.outputs)) {
    for (const imported of output.imports ?? []) {
      if (imported.external && (imported.path === 'imp' || imported.path.startsWith('imp/'))) {
        kept.add(imported.path)
      }
    }
  }
  return [...kept].sort()
}

export async function bundleDependency({ specifier, alias }) {
  const result = await runEsbuild({
    plugins: [denoPlugin()],
    entryPoints: [specifier],
    external: ['imp', 'imp/*'],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    legalComments: 'inline',
    metafile: true,
    write: false,
    outdir: '/bundle',
    entryNames: alias,
    assetNames: '[name]-[hash]',
    publicPath: `/dependencies/${alias}`,
    loader: ASSET_LOADERS,
  })
  const files = result.outputFiles.map((file) => ({
    name: basename(file.path),
    contents: file.contents,
  }))
  return {
    files,
    entry: Object.values(result.metafile.outputs).find((output) => output.entryPoint)
      ?.entryPoint ?? null,
    packages: bundledPackages(result.metafile),
    impImports: keptImpImports(result.metafile),
  }
}

export async function shutdownBundler() {
  if (!esbuildReady) return
  const ready = esbuildReady
  esbuildReady = null
  await ready
  await esbuild.stop()
}
