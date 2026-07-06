import { basename, join, relative, resolve, toFileUrl } from '@std/path'
import { encodeBase64 } from '@std/encoding/base64'
import { denoPlugin } from '@deno/esbuild-plugin'
import { loadImpConfig } from './config.js'
import { collectFiles } from './walk.js'
import { runEsbuild, shutdownBundler } from './deps.js'
import { createRequestHandler, loadApp } from './start.js'
import { createClock } from './test_clock.js'

const IMP_LIBRARY_URL = import.meta.resolve('../lib/imp.js')
const TEST_LIBRARY_URL = import.meta.resolve('./test_library.js')

const REGISTRY_KEY = Symbol.for('imp.test.registry')

const UNIT_TIMEOUT = 5_000
const E2E_TIMEOUT = 30_000

const TEST_EXTENSIONS = new Set(['js', 'mjs'])

const green = (s) => `\x1b[32m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

export const isUnitFile = (path) => path.endsWith('.test.js') || path.endsWith('.test.mjs')
export const isSpecFile = (path) => path.endsWith('.spec.js') || path.endsWith('.spec.mjs')
const isTestFile = (path) => isUnitFile(path) || isSpecFile(path)

const DATAURL_ASSET_LOADERS = Object.fromEntries(
  [
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
    '.css',
    '.txt',
    '.json',
  ]
    .map((extension) => [extension, 'dataurl']),
)

function testResolverPlugin({ root, dependencies }) {
  const aliases = Object.keys(dependencies)
  const escapeForRegExp = (text) => text.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  return {
    name: 'imp-test',
    setup(build) {
      build.onResolve({ filter: /^imp$/ }, () => ({
        path: IMP_LIBRARY_URL,
        namespace: 'imp-library',
      }))
      build.onResolve({ filter: /^imp\/test$/ }, () => ({
        path: TEST_LIBRARY_URL,
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
    },
  }
}

async function bundleTestFile(file, { root, dependencies }) {
  const result = await runEsbuild({
    plugins: [testResolverPlugin({ root, dependencies }), denoPlugin()],
    entryPoints: [toFileUrl(file).href],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    legalComments: 'none',
    write: false,
    outdir: '/imp-test',
    loader: DATAURL_ASSET_LOADERS,
  })
  return result.outputFiles[0].text
}

const importCode = (code) => import(`data:text/javascript;base64,${encodeBase64(code)}`)

const nativeSetTimeout = globalThis.setTimeout
const nativeClearTimeout = globalThis.clearTimeout

const freshRegistry = () => {
  const registry = {
    tests: [],
    focused: false,
    beforeAll: [],
    beforeEach: [],
    afterEach: [],
    afterAll: [],
  }
  globalThis[REGISTRY_KEY] = registry
  return registry
}

async function runWithTimeout(run, timeoutMs, context) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = nativeSetTimeout(
      () => reject(new Error(`test timed out after ${timeoutMs}ms`)),
      timeoutMs,
    )
  })
  try {
    await Promise.race([Promise.resolve(run(context)), timeout])
  } finally {
    nativeClearTimeout(timer)
  }
}

const indentMessage = (error) => {
  let message = String(error?.message ?? error)
  const name = error?.name
  if (name && name !== 'Error' && name !== 'ExpectationError') message = `${name}: ${message}`
  return message.split('\n').map((line) => `      ${line}`).join('\n')
}

const createTestClock = (fakeTimers, environment) => {
  if (!fakeTimers) return null
  if (environment === 'e2e') {
    throw new Error(
      'fakeTimers is only available in unit tests (*.test.js) — e2e specs run in a real browser; control time through the Puppeteer page instead',
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
    console.log(`  ${red('✗')} beforeAll hook failed`)
    console.log(red(indentMessage(error)))
    counts.failed += registry.tests.length || 1
    return counts
  }

  for (const entry of registry.tests) {
    const excluded = entry.mode === 'skip' || (registry.focused && entry.mode !== 'only') ||
      (filter && !entry.name.includes(filter))
    if (excluded) {
      counts.skipped++
      console.log(`  ${yellow('-')} ${entry.name} ${dim('(skipped)')}`)
      continue
    }
    const startedAt = performance.now()
    let failure = null
    let clock = null
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
    try {
      clock?.restore()
    } catch { /* already restored */ }
    const duration = `(${Math.round(performance.now() - startedAt)}ms)`
    if (failure === null) {
      counts.passed++
      console.log(`  ${green('✓')} ${entry.name} ${dim(duration)}`)
    } else {
      counts.failed++
      console.log(`  ${red('✗')} ${entry.name} ${dim(duration)}`)
      console.log(red(indentMessage(failure)))
      await onFailure?.(entry)
    }
  }

  try {
    await runHooks(registry.afterAll)
  } catch (error) {
    console.log(`  ${red('✗')} afterAll hook failed`)
    console.log(red(indentMessage(error)))
    counts.failed++
  }

  return counts
}

async function runUnitFile({ code, filter }) {
  const { installDomEnvironment } = await import('./test_dom.js')
  const restore = installDomEnvironment()
  try {
    const registry = freshRegistry()
    await importCode(code)
    return await runRegistry(registry, {
      context: { window: globalThis.window, document: globalThis.document },
      defaultTimeout: UNIT_TIMEOUT,
      filter,
      environment: 'unit',
    })
  } finally {
    delete globalThis[REGISTRY_KEY]
    await restore()
  }
}

const slug = (text) => text.replaceAll(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

async function launchBrowser(executablePath) {
  const { default: puppeteer } = await import('./vendor/puppeteer_core.js')
  const args = ['--disable-dev-shm-usage']
  try {
    if (Deno.uid() === 0) args.push('--no-sandbox')
  } catch { /* not available on this platform */ }
  return puppeteer.launch({ executablePath, headless: true, args })
}

async function runSpecFile(file, { root, code, filter, browserPath, app }) {
  const clients = new Set()
  const server = Deno.serve(
    { port: 0, hostname: '127.0.0.1', onListen: () => {} },
    createRequestHandler({ ...app, clients }),
  )
  const baseUrl = `http://127.0.0.1:${server.addr.port}/`

  let browser = null
  let page = null
  try {
    browser = await launchBrowser(browserPath)
    page = await browser.newPage()
    await page.goto(baseUrl, { waitUntil: 'load' })

    const registry = freshRegistry()
    await importCode(code)
    return await runRegistry(registry, {
      context: { page, browser, baseUrl },
      defaultTimeout: E2E_TIMEOUT,
      filter,
      environment: 'e2e',
      onFailure: async (entry) => {
        const path = join(
          root,
          '.imp',
          'screenshots',
          `${slug(basename(file))}-${slug(entry.name)}.png`,
        )
        try {
          await Deno.mkdir(join(root, '.imp', 'screenshots'), { recursive: true })
          await page.screenshot({ path })
          console.log(dim(`      screenshot: ${relative(root, path)}`))
        } catch { /* page may be gone */ }
      },
    })
  } finally {
    delete globalThis[REGISTRY_KEY]
    if (page) {
      await page.evaluate(() => globalThis.__impFlushTelemetry?.()).catch(() => {})
      await new Promise((done) => setTimeout(done, 120))
    }
    if (browser) await browser.close().catch(() => {})
    for (const controller of clients) {
      try {
        controller.close()
      } catch { /* already gone */ }
    }
    await server.shutdown()
  }
}

async function selectFiles({ root, paths, unit, e2e, exclude }) {
  for (const target of paths) {
    const path = resolve(root, target)
    let info = null
    try {
      info = await Deno.stat(path)
    } catch {
      throw new Error(`path not found: ${target}`)
    }
    if (info.isFile && !isTestFile(path)) {
      throw new Error(
        `not a test file: ${target} — unit tests end with .test.js, e2e specs with .spec.js`,
      )
    }
  }
  const files = (await collectFiles({ root, paths, extensions: TEST_EXTENSIONS, exclude }))
    .filter(isTestFile)
  const unitOnly = unit && !e2e
  const e2eOnly = e2e && !unit
  return {
    unitFiles: e2eOnly ? [] : files.filter(isUnitFile),
    specFiles: unitOnly ? [] : files.filter(isSpecFile),
  }
}

export async function runTests(
  { root, paths, list = false, unit = false, e2e = false, filter = null },
) {
  const imp = await loadImpConfig(root)
  const testConfig = imp.test ?? {}
  const dependencies = imp.dependencies ?? {}

  const { unitFiles, specFiles } = await selectFiles({
    root,
    paths,
    unit,
    e2e,
    exclude: testConfig.exclude ?? [],
  })

  if (list) {
    const toRelative = (file) => relative(root, file).replaceAll('\\', '/')
    console.log(JSON.stringify([...unitFiles, ...specFiles].map(toRelative)))
    return 0
  }

  const files = [...unitFiles, ...specFiles]
  if (!files.length) {
    console.log('no test files found (unit tests end with .test.js, e2e specs with .spec.js)')
    return 0
  }

  const startedAt = performance.now()
  const bundles = new Map()
  try {
    for (const file of files) {
      try {
        bundles.set(file, { code: await bundleTestFile(file, { root, dependencies }) })
      } catch (error) {
        bundles.set(file, { error })
      }
    }
  } finally {
    await shutdownBundler()
  }

  let e2eRun = null
  if (specFiles.some((file) => !bundles.get(file).error)) {
    const entry = testConfig.entry ?? 'index.html'
    const entryPath = resolve(root, entry)
    try {
      await Deno.stat(entryPath)
    } catch {
      throw new Error(
        `e2e entry not found: ${entry} — each *.spec.js runs against your served app; set "test": { "entry": "<page>.html" } in imp.json if it is not index.html`,
      )
    }
    const app = await loadApp(entryPath)
    for (const alias of app.missingDependencies) {
      console.log(
        yellow(`[imp] dependency '${alias}' is declared but not vendored — run 'imp install'`),
      )
    }
    const { resolveBrowser } = await import('./test_browser.js')
    e2eRun = { app, browserPath: await resolveBrowser(testConfig.browser) }
  }

  const totals = { passed: 0, failed: 0, skipped: 0 }
  const addCounts = (counts) => {
    totals.passed += counts.passed
    totals.failed += counts.failed
    totals.skipped += counts.skipped
  }

  for (const file of files) {
    console.log(relative(root, file))
    const { code, error } = bundles.get(file)
    if (error) {
      totals.failed++
      console.log(`  ${red('✗')} failed to load`)
      console.log(red(indentMessage(error)))
      continue
    }
    try {
      const counts = isUnitFile(file)
        ? await runUnitFile({ code, filter })
        : await runSpecFile(file, { root, code, filter, ...e2eRun })
      addCounts(counts)
    } catch (error) {
      totals.failed++
      console.log(`  ${red('✗')} failed to run`)
      console.log(red(indentMessage(error)))
    }
  }

  const parts = [`${totals.passed} passed`]
  if (totals.failed) parts.push(red(`${totals.failed} failed`))
  if (totals.skipped) parts.push(`${totals.skipped} skipped`)
  const elapsed = Math.round(performance.now() - startedAt)
  const fileCount = `${files.length} ${files.length === 1 ? 'file' : 'files'}`
  console.log(`\nimp test: ${parts.join(', ')} ${dim(`(${fileCount}, ${elapsed}ms)`)}`)
  return totals.failed ? 1 : 0
}
