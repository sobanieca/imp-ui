import { join, relative, toFileUrl } from '@std/path'
import { encodeBase64 } from '@std/encoding/base64'
import { denoPlugin } from '@deno/esbuild-plugin'
import { bundledFiles, DATAURL_ASSET_LOADERS, runEsbuild } from './deps.js'
import { impResolverPlugin } from './bundling.js'
import { isMockFile } from './project-files.js'
import { logger } from './logger.js'

export const MOCK_ENDPOINT = '/@imp/mock'

const MOCK_VERDICT_HEADER = 'x-imp-mock'

const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', '.imp'])

const ENTRY_NAMESPACE = 'imp-mocks-entry'

const MOCK_WORKER_URL = new URL('./mock-worker.js', import.meta.url)

const moduleUrl = (code) => `data:text/javascript;base64,${encodeBase64(code)}`

const messageOf = (error) => String(error?.message || error)

async function findMockFiles(directory) {
  const found = []
  const walk = async (current) => {
    for await (const entry of Deno.readDir(current)) {
      const path = join(current, entry.name)
      if (entry.isDirectory) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) await walk(path)
      } else if (entry.isFile && isMockFile(entry.name)) {
        found.push(path)
      }
    }
  }
  await walk(directory)
  found.sort()
  return found
}

const asPosix = (path) => path.replaceAll('\\', '/')

function entrySource(files) {
  const imported = (index) => `mockFile${index}`
  const lines = files.map((file, index) =>
    `import * as ${imported(index)} from ${JSON.stringify(toFileUrl(file).href)}`
  )
  lines.push(`export default [${files.map((_, index) => imported(index)).join(', ')}]`)
  return lines.join('\n')
}

function mocksEntryPlugin({ contents, root }) {
  return {
    name: 'imp-mocks-entry',
    setup(build) {
      build.onResolve({ filter: new RegExp(`^${ENTRY_NAMESPACE}$`) }, () => ({
        path: ENTRY_NAMESPACE,
        namespace: ENTRY_NAMESPACE,
      }))
      build.onLoad({ filter: /.*/, namespace: ENTRY_NAMESPACE }, () => ({
        contents,
        loader: 'js',
        resolveDir: root,
      }))
    },
  }
}

export async function bundleMockFiles(files, { root, dependencies = {} } = {}) {
  const result = await runEsbuild({
    plugins: [
      mocksEntryPlugin({ contents: entrySource(files), root }),
      impResolverPlugin({ root, dependencies }),
      denoPlugin(),
    ],
    entryPoints: [ENTRY_NAMESPACE],
    absWorkingDir: root,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    legalComments: 'none',
    metafile: true,
    write: false,
    outdir: '/imp-mocks',
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

export function describeBundleProblem(error) {
  const reported = error?.errors?.map((issue) => {
    const file = issue.location?.file
    const where = file ? `${file}:${issue.location.line} - ` : ''
    return `${where}${issue.text}`
  })
  return reported?.length ? reported.join('; ') : (error?.message ?? String(error))
}

function startMockWorker({ onStop }) {
  const worker = new Worker(MOCK_WORKER_URL, { type: 'module' })
  const pending = new Map()
  const streams = new Set()
  let nextId = 0
  let retired = false
  let stopped = false
  const stop = (reason) => {
    if (stopped) return
    stopped = true
    worker.terminate()
    for (const settle of pending.values()) settle({ failure: reason })
    pending.clear()
    for (const stream of streams) stream.abort(new Error(reason))
    streams.clear()
  }
  const stopWhenIdle = () => {
    if (retired && pending.size === 0 && streams.size === 0) stop('the mocks were replaced')
  }
  const relayed = (body) => {
    if (!body) return null
    const { readable, writable } = new TransformStream()
    const stream = new AbortController()
    streams.add(stream)
    body.pipeTo(writable, { signal: stream.signal }).catch(() => {}).finally(() => {
      streams.delete(stream)
      stopWhenIdle()
    })
    return readable
  }
  worker.onmessage = ({ data }) => {
    if (data.problem) {
      logger.error(`mocks - ${data.problem}`)
      return
    }
    const settle = pending.get(data.id)
    pending.delete(data.id)
    settle?.({ ...data, body: relayed(data.body) })
    stopWhenIdle()
  }
  worker.onerror = (event) => {
    event.preventDefault()
    const failure = messageOf(event.message)
    logger.error(`mocks - ${failure}`)
    stop(failure)
    onStop()
  }
  const call = (message) => {
    if (stopped) return Promise.resolve({ failure: 'the mocks stopped' })
    const id = nextId++
    return new Promise((resolve) => {
      pending.set(id, resolve)
      worker.postMessage({ ...message, id })
    })
  }
  return {
    load: (code, files) => call({ url: moduleUrl(code), files }),
    answer: (description) => call({ description }),
    retire: () => {
      retired = true
      stopWhenIdle()
    },
  }
}

async function bundleMockSet(files, { root, dependencies, watched, bundle }) {
  try {
    return { ...await bundle(files, { root, dependencies }), problems: [] }
  } catch (error) {
    const failing = (error?.errors ?? []).map((issue) => issue.location?.file)
      .filter((file) => file && !/^[^/]*:/.test(file))
    return {
      source: null,
      inputs: [...new Set([...watched, ...failing.map((file) => join(root, file))])],
      problems: [describeBundleProblem(error)],
    }
  }
}

async function evaluateMockSet({ source, inputs }, files, { root, onStop }) {
  const worker = startMockWorker({ onStop: () => onStop(worker) })
  const loaded = await worker.load(source, files.map((file) => asPosix(relative(root, file))))
  if (loaded.body) await new Response(loaded.body).arrayBuffer()
  const sources = loaded.sources ?? []
  if (!sources.length) worker.retire()
  return {
    inputs,
    entries: sources,
    problems: loaded.failure ? [`evaluation failed - ${loaded.failure}`] : loaded.problems,
    worker: sources.length ? worker : null,
  }
}

const verdictHeaders = (verdict) => ({
  [MOCK_VERDICT_HEADER]: encodeURIComponent(JSON.stringify(verdict)),
  'cache-control': 'no-store',
})

const MISSING_FOLDER = 'missing'

const NO_FILES = 'none'

const unanswered = () =>
  new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })

export function createMocks(
  { root, directory, dependencies = {}, onChange = () => {}, bundle = bundleMockFiles },
) {
  const empty = { key: null, inputs: [], files: [], entries: [], problems: [], worker: null }
  let current = empty
  let running = null
  let queued = null

  const settle = (next) => {
    const previous = current
    current = next
    if (previous.worker !== next.worker) previous.worker?.retire()
    if (previous.key !== next.key) onChange(current)
    return current
  }

  const onStop = (worker) => {
    if (current.worker === worker) current = { ...current, key: null, worker: null }
  }

  const rebuild = async () => {
    let files
    try {
      files = await findMockFiles(directory)
    } catch {
      return settle({
        ...empty,
        key: MISSING_FOLDER,
        problems: [`${asPosix(relative(root, directory))}/ does not exist`],
      })
    }
    if (!files.length) {
      return current.key === NO_FILES ? current : settle({ ...empty, key: NO_FILES })
    }
    const watched = (inputs) => [...new Set([...files, ...inputs])].sort()
    let known = current.inputs
    for (;;) {
      const before = await stampOf(watched(known))
      if (before === current.key) return current
      const bundled = await bundleMockSet(files, { root, dependencies, watched: known, bundle })
      const after = await stampOf(watched(bundled.inputs))
      if (after !== before) {
        known = bundled.inputs
        continue
      }
      const loaded = bundled.source
        ? await evaluateMockSet(bundled, files, { root, onStop })
        : { inputs: bundled.inputs, entries: [], problems: bundled.problems, worker: null }
      return settle({ ...loaded, key: after, files })
    }
  }

  const refresh = () => {
    if (!running) {
      running = rebuild().finally(() => running = null)
      return running
    }
    queued ??= running.catch(() => {}).then(() => {
      queued = null
      return refresh()
    })
    return queued
  }

  const answer = async (request) => {
    let description
    try {
      description = await request.json()
    } catch {
      return new Response('mocks - the request description could not be read', { status: 400 })
    }
    const { worker } = await refresh()
    if (!worker) return unanswered()
    const reply = await worker.answer(description)
    if (reply.failure) {
      return new Response(null, {
        headers: verdictHeaders({ source: 'mocks', error: reply.failure }),
      })
    }
    if (!reply.verdict) return unanswered()
    return new Response(reply.body, { headers: verdictHeaders(reply.verdict) })
  }

  return { refresh, answer }
}
