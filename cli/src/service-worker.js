import { toFileUrl } from '@std/path'
import { denoPlugin } from '@deno/esbuild-plugin'
import { bundledFiles, DATAURL_ASSET_LOADERS, runEsbuild } from './deps.js'
import { impResolverPlugin } from './bundling.js'
import { describeBundleProblem } from './mocks.js'

export const SERVICE_WORKER_PATH = '/sw.js'

const DEV_ENTRY_SOURCE = `import { startDevMode } from 'imp/service-worker'\nstartDevMode()\n`

export const runtimeValues = ({ env = {}, flags = {} }) => {
  const lines = []
  if (Object.keys(env).length) lines.push(`globalThis.__IMP_ENV__ = ${JSON.stringify(env)}`)
  if (Object.keys(flags).length) lines.push(`globalThis.__IMP_FLAGS__ = ${JSON.stringify(flags)}`)
  return lines.map((line) => `${line};\n`).join('')
}

export async function assertServiceWorkerSource(path, declared) {
  let stat
  try {
    stat = await Deno.stat(path)
  } catch {
    throw new Error(`serviceWorker - ${declared} does not exist`)
  }
  if (!stat.isFile) throw new Error(`serviceWorker - ${declared} is not a file`)
}

const mockEndpointValue = (endpoint) =>
  endpoint ? `globalThis.__IMP_MOCK_ENDPOINT__ = ${JSON.stringify(endpoint)};\n` : ''

export const assembleServiceWorker = ({ worker, mockEndpoint = null, env, flags }) =>
  `${runtimeValues({ env, flags })}${mockEndpointValue(mockEndpoint)}${worker}`

export const WORKER_ENTRY = 'imp-worker-entry'

export const OFFLINE_WORKER_SOURCE =
  `import { precacheBuild } from 'imp/service-worker'\nprecacheBuild()\n`

export function workerEntryPlugin(root, source) {
  return {
    name: WORKER_ENTRY,
    setup(build) {
      build.onResolve({ filter: new RegExp(`^${WORKER_ENTRY}$`) }, () => ({
        path: WORKER_ENTRY,
        namespace: WORKER_ENTRY,
      }))
      build.onLoad({ filter: /.*/, namespace: WORKER_ENTRY }, () => ({
        contents: source,
        loader: 'js',
        resolveDir: root,
      }))
    },
  }
}

export const precacheValues = (precache) =>
  `globalThis.__IMP_PRECACHE__ = ${JSON.stringify(precache)};\n`

const HOST_FILES = new Set([
  '404.html',
  'CNAME',
  '_headers',
  '_redirects',
  '_routes.json',
  'netlify.toml',
  'staticwebapp.config.json',
  'vercel.json',
])

export const precachedPublicFile = (name) =>
  !HOST_FILES.has(name) && !name.split('/').some((part) => part.startsWith('.'))

export const precacheUrl = (base, name) =>
  `${base}/${name.split('/').map((part) => encodeURIComponent(part)).join('/')}`

async function bundleWorker({ root, entry, dependencies }) {
  const result = await runEsbuild({
    plugins: [
      workerEntryPlugin(root, DEV_ENTRY_SOURCE),
      impResolverPlugin({ root, dependencies }),
      denoPlugin(),
    ],
    entryPoints: [entry ? toFileUrl(entry).href : WORKER_ENTRY],
    absWorkingDir: root,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    legalComments: 'none',
    metafile: true,
    write: false,
    outdir: '/imp-service-worker',
    loader: DATAURL_ASSET_LOADERS,
  })
  return { source: result.outputFiles[0].text, inputs: bundledFiles(result.metafile) }
}

const stampOf = async (files) => {
  const stamps = await Promise.all(files.map(async (file) => {
    try {
      const { mtime, size } = await Deno.stat(file)
      return `${file}:${mtime?.getTime() ?? 0}:${size}`
    } catch {
      return `${file}:missing`
    }
  }))
  return stamps.join('|')
}

export function createServiceWorkerBundler({ root, entry = null, dependencies = {} }) {
  let cache = null
  const currentState = async () => {
    if (cache && (!entry || cache.key === await stampOf(cache.inputs))) return cache
    try {
      const { source, inputs } = await bundleWorker({ root, entry, dependencies })
      const files = entry ? [entry, ...inputs.filter((input) => input !== entry)] : []
      return { key: await stampOf(files), inputs: files, source, problem: null }
    } catch (error) {
      return {
        key: entry ? `${await stampOf([entry])}!` : '',
        inputs: entry ? [entry] : [],
        source: '',
        problem: describeBundleProblem(error),
      }
    }
  }
  return async () => {
    const state = await currentState()
    const changed = cache?.key !== state.key
    cache = state
    return { ...state, changed }
  }
}
