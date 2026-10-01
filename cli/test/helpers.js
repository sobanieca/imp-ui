import { fromFileUrl, join } from '@std/path'
import { readHtml } from '../src/html-document.js'
import { readWidgetMark } from '../src/review.js'
import { VERSION } from '../src/version.js'

export const widgetMark = await readWidgetMark()

export const ROOT = fromFileUrl(new URL('..', import.meta.url))

export const REPO_ROOT = fromFileUrl(new URL('../..', import.meta.url))

export const IMP = join(REPO_ROOT, Deno.build.os === 'windows' ? 'imp.exe' : 'imp')

export const fixture = (name) => join(ROOT, 'test', 'fixtures', name)

export async function listFiles(dir, prefix = '') {
  const found = []
  for await (const entry of Deno.readDir(dir)) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory) found.push(...await listFiles(join(dir, entry.name), path))
    else found.push(path)
  }
  return found
}

export const withoutDownloadNoise = (result) => ({
  ...result,
  stderr: result.stderr
    .split('\n')
    .filter((line) => !/^Download(ing)? /.test(line))
    .join('\n'),
})

export const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[a-zA-Z]`, 'g')

export const posixPath = (path) => path.replaceAll('\\', '/')

export const tempDir = async (options) => posixPath(await Deno.makeTempDir(options))

export const posixOutput = (text) =>
  Deno.build.os === 'windows' ? text.replace(/\\(?![n"\\])/g, '/') : text

export const normalize = (text) =>
  posixOutput(text.replaceAll(ANSI, '')).replaceAll(posixPath(ROOT), '<root>/')
    .replaceAll(VERSION, '<version>')
    .replace(/\b\d+ms\b/g, '*ms')
    .replace(/time="[\d.]+"/g, 'time="*"')
    .replace(/"durationMs": \d+/g, '"durationMs": *')
    .replace(/^( *)at .*:\d+:\d+\)?\n(?:\1at .*:\d+:\d+\)?\n?)*/gm, '$1at <stack frames>\n')

export const section = (label, text) =>
  `--- ${label} ---\n${text.trim() ? text.trimEnd() : '(empty)'}`

export const check = (condition, message) => {
  if (!condition) throw new Error(message)
}

export const commandTranscript = (display, { code, stdout, stderr }) =>
  `$ ${display}\nexit code: ${code}\n\n${section('stdout', stdout)}\n\n${
    section('stderr', stderr)
  }\n`

export async function runImp(args, cwd = ROOT) {
  const { code, stdout, stderr } = await new Deno.Command(IMP, {
    args,
    cwd,
    stdout: 'piped',
    stderr: 'piped',
  }).output()
  return {
    code,
    stdout: normalize(new TextDecoder().decode(stdout)),
    stderr: normalize(new TextDecoder().decode(stderr)),
  }
}

export async function withBuiltScripts(dist, html) {
  const texts = [html]
  for (const { src } of readHtml(html).scripts) {
    const file = src?.match(/chunks\/(env|register-service-worker)-[A-Z0-9]{8}\.js$/)?.[0]
    if (file) texts.push(await Deno.readTextFile(join(dist, file)))
  }
  return texts.join('\n')
}

export async function copyDirectory(source, destination) {
  await Deno.mkdir(destination, { recursive: true })
  for await (const entry of Deno.readDir(source)) {
    const from = join(source, entry.name)
    const to = join(destination, entry.name)
    if (entry.isDirectory) await copyDirectory(from, to)
    else await Deno.copyFile(from, to)
  }
}

export const workerReport = (source) => {
  const worker = runServiceWorker(source)
  const precache = worker.scope.__IMP_PRECACHE__
  return [
    `precache version: ${/^[0-9a-f]{16}$/.test(precache?.version) ? '<16 hex digits>' : '(none)'}`,
    `precache shell: ${JSON.stringify(precache?.shell ?? null)}`,
    `precache hashed: ${JSON.stringify(precache?.hashed ?? null)}`,
    `precache required: ${JSON.stringify(precache?.required ?? null)}`,
    `precache optional: ${JSON.stringify(precache?.optional ?? null)}`,
    `listeners: ${Object.keys(worker.listeners).sort().join(', ')}`,
  ].join('\n')
}

export async function startServer(cwd, extraArgs = [], command = ['start', 'index.html']) {
  const child = new Deno.Command(IMP, {
    args: [...command, '--port', '0', ...extraArgs],
    cwd,
    stdin: 'null',
    stdout: 'piped',
    stderr: 'null',
  }).spawn()
  const reader = child.stdout.getReader()
  const decoder = new TextDecoder()
  let banner = ''
  while (!banner.includes('imp auto-injected')) {
    const { value, done } = await reader.read()
    if (done) break
    banner += decoder.decode(value)
  }
  const port = Number(banner.match(/localhost:(\d+)\//)[1])
  return {
    port,
    banner,
    async stop() {
      await reader.cancel().catch(() => {})
      child.kill()
      await child.status
    },
  }
}

export const touch = async (file) => Deno.writeTextFile(file, `${await Deno.readTextFile(file)}\n`)

export const firstReloadEvent = async (port, wait) => {
  const response = await fetch(`http://127.0.0.1:${port}/@imp/events`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let received = ''
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), wait))
  const reload = (async () => {
    while (!received.includes('data: reload')) {
      const { value, done } = await reader.read()
      if (done) return null
      received += decoder.decode(value)
    }
    return 'reload'
  })()
  const result = await Promise.race([reload, timeout])
  await reader.cancel().catch(() => {})
  return result
}

export const HEADERS_OF_INTEREST = [
  'content-type',
  'location',
  'service-worker-allowed',
  'cache-control',
]

export const responseTranscript = (path, response, body) => {
  const lines = [`GET ${path}`, `status: ${response.status}`]
  for (const header of HEADERS_OF_INTEREST) {
    const value = response.headers.get(header)
    if (value) lines.push(`${header}: ${value}`)
  }
  return `${lines.join('\n')}\n\n${body.trimEnd()}\n`
}

export const DECLARED_MOCK_DELAY = 250

export function runServiceWorker(source, port = null) {
  const listeners = {}
  const telemetry = []
  const scope = {
    addEventListener: (type, handler) => {
      listeners[type] = handler
    },
    skipWaiting: () => {},
    clients: { claim: () => {} },
    registration: { scope: 'http://app.test/' },
    location: new URL('http://app.test/sw.js'),
  }
  const network = (input, init) => {
    if (input === '/@imp/log') {
      telemetry.push(...JSON.parse(init.body))
      return Promise.resolve(new Response('ok'))
    }
    if (input === '/@imp/mock') return fetch(`http://127.0.0.1:${port}${input}`, init)
    return Promise.resolve(
      new Response('from the network', { headers: { 'content-type': 'text/plain' } }),
    )
  }
  new Function('self', 'fetch', 'globalThis', source)(scope, network, scope)

  const send = async (path, init) => {
    let answered
    listeners.fetch({
      request: new Request(`http://app.test${path}`, init),
      respondWith: (value) => answered = value,
    })
    const started = Date.now()
    try {
      const response = await answered
      const type = response.headers.get('content-type') ?? '(none)'
      const slow = Date.now() - started >= DECLARED_MOCK_DELAY ? ' after the declared delay' : ''
      return `${init?.method ?? 'GET'} ${path} -> ${response.status} ${type} ${await response
        .text()}${slow}`
    } catch (error) {
      return `${init?.method ?? 'GET'} ${path} -> rejected: ${error.message}`
    }
  }

  return {
    mockEndpoint: scope.__IMP_MOCK_ENDPOINT__ ?? '(none)',
    send,
    telemetry,
    listeners,
    scope,
  }
}

export const startPreviewServer = (cwd, extraArgs = []) => startServer(cwd, extraArgs, ['preview'])
