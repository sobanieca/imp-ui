import { createClock } from './test-clock.js'
import { piercingBrowser, piercingPage } from './test-page.js'

const REGISTRY_KEY = Symbol.for('imp.test.registry')

const nativeSetTimeout = globalThis.setTimeout
const nativeClearTimeout = globalThis.clearTimeout
const nativeConsole = { ...console }
const nativeFetch = globalThis.fetch.bind(globalThis)
const nativeStringify = JSON.stringify

const post = (path, body) =>
  nativeFetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: nativeStringify(body),
  })

let pending = []
let sending = Promise.resolve()

const flush = () => {
  if (!pending.length) return sending
  const lines = pending
  pending = []
  sending = sending.then(() => post('/@imp/out', { lines })).catch(() => {})
  return sending
}

const out = (text) => {
  pending.push(text)
  if (pending.length === 1) nativeSetTimeout(flush, 0)
}

const describe = (value, seen = new Set()) => {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`
  if (typeof value === 'function') return `[Function: ${value.name || '(anonymous)'}]`
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'symbol') return value.toString()
  if (value === null || typeof value !== 'object') return String(value)
  if (value instanceof Node) return value.outerHTML ?? `#${value.nodeName.toLowerCase()}`
  if (seen.has(value)) return '[Circular]'
  try {
    return JSON.stringify(value, (_key, entry) => (typeof entry === 'bigint' ? `${entry}n` : entry))
  } catch {
    return String(value)
  }
}

const describeArguments = (args) => args.map((value) => describe(value)).join(' ')

for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
  console[level] = (...args) => {
    out(describeArguments(args))
    nativeConsole[level](...args)
  }
}

addEventListener('error', (event) => {
  out(`Uncaught ${describe(event.error ?? event.message)}`)
})

addEventListener('unhandledrejection', (event) => {
  out(`Uncaught (in promise) ${describe(event.reason)}`)
})

const run = await (await nativeFetch('/@imp/run.json')).json()

const paint = (code) => (text) => (run.color ? `\x1b[${code}m${text}\x1b[0m` : text)
const red = paint(31)
const green = paint(32)
const yellow = paint(33)
const dim = paint(2)

const freshRegistry = () => {
  const registry = {
    tests: [],
    focused: false,
    beforeAll: [],
    beforeEach: [],
    afterEach: [],
    afterAll: [],
    spies: [],
    restores: [],
    running: false,
  }
  globalThis[REGISTRY_KEY] = registry
  return registry
}

async function runWithTimeout(task, timeoutMs, context) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = nativeSetTimeout(
      () => reject(new Error(`test timed out after ${timeoutMs}ms`)),
      timeoutMs,
    )
  })
  try {
    await Promise.race([Promise.resolve(task(context)), timeout])
  } finally {
    nativeClearTimeout(timer)
  }
}

const errorMessage = (error) => {
  const message = String(error?.message ?? error)
  const name = error?.name
  return name && name !== 'Error' && name !== 'ExpectationError' ? `${name}: ${message}` : message
}

const indentMessage = (error) =>
  errorMessage(error)
    .split('\n')
    .map((line) => `      ${line}`)
    .join('\n')

const createTestClock = (fakeTimers, environment) => {
  if (!fakeTimers) return null
  if (environment === 'e2e') {
    throw new Error(
      'fakeTimers is only available in unit tests (*.test.js) - e2e specs drive the app in its own page; control time through the Puppeteer page instead',
    )
  }
  return createClock(fakeTimers === true ? undefined : fakeTimers)
}

async function runRegistry(registry, { context, defaultTimeout, filter, onFailure, environment }) {
  const counts = { passed: 0, failed: 0, skipped: 0 }

  const runHooks = async (hooks, hookContext = context) => {
    for (const hook of hooks) await runWithTimeout(hook, defaultTimeout, hookContext)
  }

  try {
    await runHooks(registry.beforeAll)
  } catch (error) {
    out(`  ${red('✗')} beforeAll hook failed`)
    out(red(indentMessage(error)))
    counts.failed += registry.tests.length || 1
    return counts
  }

  for (const entry of registry.tests) {
    const excluded =
      entry.mode === 'skip'
      || (registry.focused && entry.mode !== 'only')
      || (filter && !entry.name.includes(filter))
    if (excluded) {
      counts.skipped++
      out(`  ${yellow('-')} ${entry.name} ${dim('(skipped)')}`)
      continue
    }
    const startedAt = performance.now()
    let failure = null
    let clock = null
    registry.running = true
    try {
      clock = createTestClock(entry.fakeTimers, environment)
      const testContext = clock ? { ...context, clock } : context
      await runHooks(registry.beforeEach, testContext)
      await runWithTimeout(entry.run, entry.timeout ?? defaultTimeout, testContext)
    } catch (error) {
      failure = error
    }
    try {
      await runHooks(registry.afterEach, clock ? { ...context, clock } : context)
    } catch (error) {
      failure ??= error
    }
    registry.running = false
    for (const restore of registry.restores.splice(0)) {
      try {
        restore()
      } catch {
        /* already restored */
      }
    }
    for (const spy of registry.spies) spy.calls.length = 0
    try {
      clock?.restore()
    } catch {
      /* already restored */
    }
    const duration = `(${Math.round(performance.now() - startedAt)}ms)`
    if (failure === null) {
      counts.passed++
      out(`  ${green('✓')} ${entry.name} ${dim(duration)}`)
    } else {
      counts.failed++
      out(`  ${red('✗')} ${entry.name} ${dim(duration)}`)
      out(red(indentMessage(failure)))
      await onFailure?.(entry)
    }
  }

  try {
    await runHooks(registry.afterAll)
  } catch (error) {
    out(`  ${red('✗')} afterAll hook failed`)
    out(red(indentMessage(error)))
    counts.failed++
  }

  return counts
}

const importTests = () => import('/@imp/test.js')

const keepRunnerPage = () => {
  navigation.addEventListener('navigate', (event) => {
    if (event.canIntercept && !event.hashChange && !event.downloadRequest) {
      event.intercept({ handler: () => Promise.resolve() })
    }
  })
}

async function connectBrowser(defaultViewport) {
  const { default: puppeteer } = await import('/@imp/puppeteer/puppeteer.js')
  const browserWSEndpoint = await (await nativeFetch('/@imp/devtools')).text()
  return puppeteer.connect({ browserWSEndpoint, defaultViewport })
}

async function runUnit() {
  keepRunnerPage()
  const registry = freshRegistry()
  await importTests()
  return runRegistry(registry, {
    context: {},
    defaultTimeout: run.unitTimeout,
    filter: run.filter,
    environment: 'unit',
  })
}

async function startScreencast(page, options) {
  const client = await page.createCDPSession()
  const frames = []
  const onFrame = async ({ data, sessionId, metadata }) => {
    frames.push({ data, timestamp: metadata.timestamp })
    try {
      await client.send('Page.screencastFrameAck', { sessionId })
    } catch {
      /* session may be gone */
    }
  }
  client.on('Page.screencastFrame', onFrame)
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: options.quality,
    maxWidth: options.width,
    maxHeight: options.width,
    everyNthFrame: 1,
  })
  return { client, frames, onFrame }
}

async function stopScreencast({ client, frames, onFrame }) {
  try {
    await client.send('Page.stopScreencast')
  } catch {
    /* session may be gone */
  }
  client.off('Page.screencastFrame', onFrame)
  try {
    await client.detach()
  } catch {
    /* already detached */
  }
  return frames
}

async function runSpec() {
  const browser = await connectBrowser({ width: 800, height: 600 })
  let page = null
  let recording = null
  try {
    page = await browser.newPage()
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
    await page.goto(run.baseUrl, { waitUntil: 'load' })
    if (run.mockServer) {
      await page.waitForFunction(() =>
        navigator.serviceWorker
          .getRegistration()
          .then((registration) => Boolean(registration?.active)),
      )
      await page.goto(run.baseUrl, { waitUntil: 'load' })
    }
    if (run.video) recording = await startScreencast(page, run.video)
    const registry = freshRegistry()
    await importTests()
    return await runRegistry(registry, {
      context: {
        page: piercingPage(page, { save: savePageScreenshot }),
        browser: piercingBrowser(browser, { save: savePageScreenshot }),
        baseUrl: run.baseUrl,
      },
      defaultTimeout: run.e2eTimeout,
      filter: run.filter,
      environment: 'e2e',
      onFailure: run.screenshots
        ? async (entry) => {
            try {
              const data = await page.screenshot({ encoding: 'base64' })
              await post('/@imp/screenshot', { test: entry.name, data })
            } catch {
              /* page may be gone */
            }
          }
        : undefined,
    })
  } finally {
    if (recording) {
      const frames = await stopScreencast(recording).catch(() => [])
      await post('/@imp/video', { frames }).catch(() => {})
    }
    if (page) {
      await page.evaluate(() => globalThis.__impFlushTelemetry?.()).catch(() => {})
      await new Promise((done) => nativeSetTimeout(done, 120))
      await page.close().catch(() => {})
    }
    await browser.disconnect().catch(() => {})
  }
}

async function savePageScreenshot(path, data) {
  await post('/@imp/save', { path, data })
}

let counts
try {
  counts = run.mode === 'e2e' ? await runSpec() : await runUnit()
} catch (error) {
  out(`  ${red('✗')} failed to run`)
  out(red(indentMessage(error)))
  counts = { passed: 0, failed: 1, skipped: 0 }
}
await flush()
await post('/@imp/done', counts)
