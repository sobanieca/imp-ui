import { fromFileUrl, isAbsolute, join, relative, SEPARATOR, toFileUrl } from '@std/path'
import { encodeBase64 } from '@std/encoding/base64'
import { denoPlugin } from '@deno/esbuild-plugin'
import { DATAURL_ASSET_LOADERS, runEsbuild } from './deps.js'
import { impResolverPlugin } from './bundling.js'
import { isMockFile } from './project-files.js'
import { logger } from './logger.js'

export const MOCK_ENDPOINT = '/@imp/mock'

const MOCK_VERDICT_HEADER = 'x-imp-mock'

const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', '.imp'])

const ENTRY_NAMESPACE = 'imp-mocks-entry'

const EMPTY_BODY_STATUSES = new Set([204, 205, 304])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const importCode = (code) => import(`data:text/javascript;base64,${encodeBase64(code)}`)

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

async function bundleMockFiles(files, { root, dependencies = {} } = {}) {
  const result = await runEsbuild({
    plugins: [
      mocksEntryPlugin({ contents: entrySource(files), root }),
      impResolverPlugin({ root, dependencies }),
      denoPlugin(),
    ],
    entryPoints: [ENTRY_NAMESPACE],
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
  return { source: result.outputFiles[0].text, inputs: inputFiles(result.metafile) }
}

const inputFiles = (metafile) =>
  Object.keys(metafile.inputs).flatMap((input) => {
    if (input.startsWith('file://')) return [fromFileUrl(input)]
    if (/^[a-z][\w-]*:/i.test(input)) return []
    const file = [input, SEPARATOR + input].find((candidate) => isAbsolute(candidate))
    return file ? [file] : []
  })

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

const locate = (file, root) => {
  for (const candidate of [file, SEPARATOR + file]) {
    if (isAbsolute(candidate)) return asPosix(relative(root, candidate))
  }
  return asPosix(file)
}

export function describeBundleProblem(error, root) {
  const reported = error?.errors?.map((issue) => {
    const file = issue.location?.file
    const where = file ? `${locate(file, root)}:${issue.location.line} - ` : ''
    return `${where}${issue.text}`
  })
  return reported?.length ? reported.join('; ') : (error?.message ?? String(error))
}

function collectEntries(modules, files, root) {
  const problems = []
  const entries = modules.flatMap((module, fileIndex) => {
    const file = asPosix(relative(root, files[fileIndex]))
    const declared = module.mocks ?? module.default
    if (!Array.isArray(declared)) {
      problems.push(`${file} must export 'mocks' - an array of { match, handler }`)
      return []
    }
    return declared.flatMap((entry, index) => {
      const source = `${file} #${index + 1}`
      if (typeof entry?.match !== 'function' || typeof entry?.handler !== 'function') {
        problems.push(`${source} must be { match, handler }, both functions`)
        return []
      }
      return [{ match: entry.match, handler: entry.handler, delay: entry.delay ?? 0, source }]
    })
  })
  return { entries, problems }
}

async function loadMockSet(files, { root, dependencies }) {
  let bundle
  try {
    bundle = await bundleMockFiles(files, { root, dependencies })
  } catch (error) {
    return { inputs: [], entries: [], problems: [describeBundleProblem(error, root)] }
  }
  try {
    const { default: modules } = await importCode(bundle.source)
    return { inputs: bundle.inputs, ...collectEntries(modules, files, root) }
  } catch (error) {
    return {
      inputs: bundle.inputs,
      entries: [],
      problems: [`evaluation failed - ${messageOf(error)}`],
    }
  }
}

const isRawBody = (body) =>
  body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body) ||
  body instanceof FormData || body instanceof URLSearchParams || body instanceof ReadableStream

function mockResponse(result) {
  if (result instanceof Response) return result
  const descriptor = result || {}
  const status = descriptor.status ?? 200
  const headers = new Headers(descriptor.headers || {})
  let body = descriptor.body
  if (body === undefined || body === null || EMPTY_BODY_STATUSES.has(status)) {
    body = null
  } else if (typeof body === 'string') {
    if (!headers.has('content-type')) headers.set('content-type', 'text/plain;charset=utf-8')
  } else if (!isRawBody(body)) {
    body = JSON.stringify(body)
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  }
  return new Response(body, { status, statusText: descriptor.statusText || '', headers })
}

const verdictHeaders = (verdict) => ({
  [MOCK_VERDICT_HEADER]: encodeURIComponent(JSON.stringify(verdict)),
  'cache-control': 'no-store',
})

async function answerFromEntry(entry, description) {
  try {
    if (entry.delay) await sleep(entry.delay)
    const response = mockResponse(await entry.handler(description))
    const verdict = {
      source: entry.source,
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers],
    }
    return new Response(response.body, { headers: verdictHeaders(verdict) })
  } catch (error) {
    return new Response(null, {
      headers: verdictHeaders({ source: entry.source, error: messageOf(error) }),
    })
  }
}

export function createMocks({ root, directory, dependencies = {}, onChange = () => {} }) {
  let current = { key: null, inputs: [], files: [], entries: [], problems: [] }
  let refreshing = null

  const settle = (next) => {
    const changed = current.key !== next.key
    current = next
    if (changed) onChange(current)
    return current
  }

  const rebuild = async () => {
    let files
    try {
      files = await findMockFiles(directory)
    } catch {
      return settle({
        key: 'missing',
        inputs: [],
        files: [],
        entries: [],
        problems: [`${asPosix(relative(root, directory))}/ does not exist`],
      })
    }
    const watched = (inputs) => [...new Set([...files, ...inputs])].sort()
    if (current.key === await stampOf(watched(current.inputs))) return current
    const loaded = files.length
      ? await loadMockSet(files, { root, dependencies })
      : { inputs: [], entries: [], problems: [] }
    return settle({ key: await stampOf(watched(loaded.inputs)), files, ...loaded })
  }

  const refresh = () => (refreshing ??= rebuild().finally(() => refreshing = null))

  const answer = async (request) => {
    let description
    try {
      description = await request.json()
    } catch {
      return new Response('mocks - the request description could not be read', { status: 400 })
    }
    const { entries } = await refresh()
    for (const entry of entries) {
      let matched = false
      try {
        matched = await entry.match(description)
      } catch (error) {
        logger.error(`mocks - ${entry.source} match() threw: ${messageOf(error)}`)
      }
      if (matched) return answerFromEntry(entry, description)
    }
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
  }

  return { refresh, answer }
}
