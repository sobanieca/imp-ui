import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  toFileUrl,
} from '@std/path'
import { encodeBase64 } from '@std/encoding/base64'
import { denoPlugin } from '@deno/esbuild-plugin'
import { loadImpConfig } from './config.js'
import { collectFiles } from './walk.js'
import { runEsbuild, shutdownBundler } from './deps.js'
import { createRequestHandler, loadApp } from './start.js'
import { createClock } from './test_clock.js'
import { dim, green, red, yellow } from './colors.js'
import { logger } from './logger.js'

const IMP_LIBRARY_URL = import.meta.resolve('../../lib/src/imp.js')
const TEST_LIBRARY_URL = import.meta.resolve('./test_library.js')

const REGISTRY_KEY = Symbol.for('imp.test.registry')

const UNIT_TIMEOUT = 5_000
const E2E_TIMEOUT = 30_000

const TEST_EXTENSIONS = new Set(['js', 'mjs'])

const MODULE_EXTENSIONS = ['.js', '.mjs']
const MOCK_NAMESPACE = 'imp-mock'

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

const isIdentChar = (char) => /[\w$]/.test(char ?? '')

function skipStringLiteral(source, index) {
  const quote = source[index]
  index++
  while (index < source.length) {
    const char = source[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (quote === '`' && char === '$' && source[index + 1] === '{') {
      index += 2
      let depth = 1
      while (index < source.length && depth > 0) {
        const inner = source[index]
        if (inner === '{') depth++
        else if (inner === '}') depth--
        else if (inner === '"' || inner === "'" || inner === '`') {
          index = skipStringLiteral(source, index)
          continue
        }
        index++
      }
      continue
    }
    if (char === quote) return index + 1
    index++
  }
  return source.length
}

function scanForFirstTopLevelComma(source) {
  let depth = 0
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index++
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++
      index += 2
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      index = skipStringLiteral(source, index)
      continue
    }
    if ('([{'.includes(char)) depth++
    else if (')]}'.includes(char)) depth--
    else if (char === ',' && depth === 0) return index
    index++
  }
  return -1
}

function parseStringLiteral(text) {
  const trimmed = text.trim()
  const quote = trimmed[0]
  if ((quote === '"' || quote === "'" || quote === '`') && trimmed.endsWith(quote)) {
    try {
      return JSON.parse(`"${trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')}"`)
    } catch {
      return trimmed.slice(1, -1)
    }
  }
  return null
}

function parseMockCall(source, parenIndex) {
  let index = parenIndex + 1
  let depth = 0
  const start = index
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index++
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++
      index += 2
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      index = skipStringLiteral(source, index)
      continue
    }
    if ('([{'.includes(char)) {
      depth++
      index++
      continue
    }
    if (')]}'.includes(char)) {
      if (depth === 0 && char === ')') {
        const inner = source.slice(start, index)
        const comma = scanForFirstTopLevelComma(inner)
        const specifierText = comma === -1 ? inner : inner.slice(0, comma)
        const specifier = parseStringLiteral(specifierText)
        if (specifier === null) {
          throw new Error('mockModule(specifier, …) — specifier must be a string literal')
        }
        const factorySource = comma === -1 ? '' : inner.slice(comma + 1).trim()
        return { specifier, factorySource, end: index + 1 }
      }
      depth--
      index++
      continue
    }
    index++
  }
  return null
}

function extractMockModuleCalls(source) {
  const calls = []
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index++
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++
      index += 2
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      index = skipStringLiteral(source, index)
      continue
    }
    if (isIdentChar(char) && !isIdentChar(source[index - 1])) {
      let end = index
      while (end < source.length && isIdentChar(source[end])) end++
      if (source.slice(index, end) === 'mockModule') {
        let cursor = end
        while (cursor < source.length && /\s/.test(source[cursor])) cursor++
        if (source[cursor] === '(') {
          const call = parseMockCall(source, cursor)
          if (call) {
            calls.push(call)
            index = call.end
            continue
          }
        }
      }
      index = end
      continue
    }
    index++
  }
  return calls
}

async function resolveModuleFile(candidate) {
  const attempts = [candidate]
  if (!extname(candidate)) {
    for (const extension of MODULE_EXTENSIONS) attempts.push(candidate + extension)
    for (const extension of MODULE_EXTENSIONS) attempts.push(join(candidate, `index${extension}`))
  }
  for (const attempt of attempts) {
    try {
      const info = await Deno.stat(attempt)
      if (info.isFile) return await Deno.realPath(attempt)
    } catch { /* try the next candidate */ }
  }
  return null
}

async function resolveMockTarget(specifier, { testFile, root, dependencies }) {
  if (specifier.startsWith('.') || isAbsolute(specifier)) {
    const realFile = await resolveModuleFile(resolve(dirname(testFile), specifier))
    if (!realFile) throw new Error(`mockModule('${specifier}') — module not found`)
    return { id: realFile, realFile }
  }
  if (!Object.hasOwn(dependencies, specifier)) {
    throw new Error(
      `mockModule('${specifier}') — not a relative module or a dependency declared in imp.json`,
    )
  }
  const realFile = await resolveModuleFile(join(root, 'dependencies', specifier, `${specifier}.js`))
  if (!realFile) {
    throw new Error(
      `mockModule('${specifier}') — dependency '${specifier}' is not vendored; run 'imp install'`,
    )
  }
  return { id: specifier, realFile }
}

async function discoverModuleExports(realFile, { root, dependencies }) {
  const result = await runEsbuild({
    plugins: [testResolverPlugin({ root, dependencies }), denoPlugin()],
    entryPoints: [toFileUrl(realFile).href],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    metafile: true,
    logLevel: 'silent',
    outdir: '/imp-mock',
    loader: DATAURL_ASSET_LOADERS,
  })
  const output = Object.values(result.metafile.outputs).find((entry) => entry.entryPoint)
  const names = output?.exports ?? []
  return {
    named: names.filter((name) => name !== 'default'),
    hasDefault: names.includes('default'),
  }
}

function generateMockModule(mock) {
  const usesOrig = mock.factorySource ? /\borig\b/.test(mock.factorySource) : false
  const lines = ["import { spy as __spy } from 'imp/test'"]
  if (usesOrig) {
    lines.push(`import * as __real from ${JSON.stringify(toFileUrl(mock.realFile).href)}`)
  }
  const helpers = usesOrig ? '{ spy: __spy, orig: () => __real }' : '{ spy: __spy }'
  if (mock.factorySource) {
    lines.push(`const __exports = (${mock.factorySource})(${helpers})`)
  } else {
    lines.push('const __exports = {}')
  }
  lines.push(
    'const __pick = (name) => (__exports != null && name in __exports) ? __exports[name] : __spy()',
  )
  for (const name of mock.named) {
    lines.push(`export const ${name} = __pick(${JSON.stringify(name)})`)
  }
  if (mock.hasDefault) lines.push("export default __pick('default')")
  return `${lines.join('\n')}\n`
}

async function collectMocks(file, { root, dependencies }) {
  const calls = extractMockModuleCalls(await Deno.readTextFile(file))
  const mocks = new Map()
  for (const { specifier, factorySource } of calls) {
    const target = await resolveMockTarget(specifier, { testFile: file, root, dependencies })
    if (mocks.has(target.id)) {
      throw new Error(`mockModule('${specifier}') — this module is mocked more than once`)
    }
    const exports = await discoverModuleExports(target.realFile, { root, dependencies })
    mocks.set(target.id, { ...target, factorySource: factorySource || null, ...exports })
  }
  return mocks
}

function testResolverPlugin({ root, dependencies, mocks }) {
  const aliases = Object.keys(dependencies)
  const escapeForRegExp = (text) => text.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  return {
    name: 'imp-test',
    setup(build) {
      if (mocks?.size) {
        build.onResolve({ filter: /.*/ }, async (args) => {
          if (args.namespace && args.namespace !== 'file') return
          if (mocks.has(args.path)) return { path: args.path, namespace: MOCK_NAMESPACE }
          if (args.path.startsWith('.') || isAbsolute(args.path)) {
            const realFile = await resolveModuleFile(resolve(args.resolveDir, args.path))
            if (realFile && mocks.has(realFile)) {
              return { path: realFile, namespace: MOCK_NAMESPACE }
            }
          }
        })
        build.onLoad({ filter: /.*/, namespace: MOCK_NAMESPACE }, (args) => ({
          contents: generateMockModule(mocks.get(args.path)),
          loader: 'js',
          resolveDir: root,
        }))
      }
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
  const mocks = await collectMocks(file, { root, dependencies })
  const result = await runEsbuild({
    plugins: [testResolverPlugin({ root, dependencies, mocks }), denoPlugin()],
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
    spies: [],
    restores: [],
    running: false,
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

const errorMessage = (error) => {
  const message = String(error?.message ?? error)
  const name = error?.name
  return name && name !== 'Error' && name !== 'ExpectationError' ? `${name}: ${message}` : message
}

const indentMessage = (error) =>
  errorMessage(error).split('\n').map((line) => `      ${line}`).join('\n')

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
  const counts = { passed: 0, failed: 0, skipped: 0, results: [] }
  const record = (name, status, durationMs, message) =>
    counts.results.push(
      message === undefined ? { name, status, durationMs } : {
        name,
        status,
        durationMs,
        message,
      },
    )

  const runHooks = async (hooks, hookContext = context) => {
    for (const hook of hooks) await runWithTimeout(hook, defaultTimeout, hookContext)
  }

  try {
    await runHooks(registry.beforeAll)
  } catch (error) {
    console.log(`  ${red('✗')} beforeAll hook failed`)
    console.log(red(indentMessage(error)))
    counts.failed += registry.tests.length || 1
    record('beforeAll hook', 'failed', 0, errorMessage(error))
    return counts
  }

  for (const entry of registry.tests) {
    const excluded = entry.mode === 'skip' || (registry.focused && entry.mode !== 'only') ||
      (filter && !entry.name.includes(filter))
    if (excluded) {
      counts.skipped++
      record(entry.name, 'skipped', 0)
      console.log(`  ${yellow('-')} ${entry.name} ${dim('(skipped)')}`)
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
      } catch { /* already restored */ }
    }
    for (const spy of registry.spies) spy.calls.length = 0
    try {
      clock?.restore()
    } catch { /* already restored */ }
    const durationMs = Math.round(performance.now() - startedAt)
    const duration = `(${durationMs}ms)`
    if (failure === null) {
      counts.passed++
      record(entry.name, 'passed', durationMs)
      console.log(`  ${green('✓')} ${entry.name} ${dim(duration)}`)
    } else {
      counts.failed++
      record(entry.name, 'failed', durationMs, errorMessage(failure))
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
    record('afterAll hook', 'failed', 0, errorMessage(error))
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
      context: {},
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

async function runSpecFile(file, { root, code, filter, browserPath, app, screenshotDir }) {
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
      onFailure: screenshotDir
        ? async (entry) => {
          const dir = resolve(root, screenshotDir)
          const path = join(dir, `${slug(basename(file))}-${slug(entry.name)}.png`)
          try {
            await Deno.mkdir(dir, { recursive: true })
            await page.screenshot({ path })
            console.log(dim(`      screenshot: ${relative(root, path)}`))
          } catch { /* page may be gone */ }
        }
        : undefined,
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

function printRunPlan({ unitFiles, specFiles, toRelative }) {
  console.log(
    'imp runs one test file per process so the caller controls parallelism — no tests were run.',
  )
  const section = (heading, testFiles) => {
    if (!testFiles.length) return
    console.log(`\n${heading}`)
    for (const file of testFiles) console.log(`  imp test ${toRelative(file)}`)
  }
  section('Run each unit test separately:', unitFiles)
  section('Run each e2e test separately:', specFiles)
  console.log('\nTo run them in parallel from a shell:')
  console.log("  imp test --list | jq -r '.[]' | xargs -P4 -n1 imp test")
}

const REPORTERS = new Set(['junit', 'json'])

const XML_ENTITIES = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }
const xmlEscape = (text) => String(text).replace(/[<>&"']/g, (char) => XML_ENTITIES[char])

function renderJunit(fileReports, totals, elapsedMs) {
  const total = totals.passed + totals.failed + totals.skipped
  const seconds = (ms) => (ms / 1000).toFixed(3)
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>']
  lines.push(
    `<testsuites name="imp" tests="${total}" failures="${totals.failed}" ` +
      `skipped="${totals.skipped}" time="${seconds(elapsedMs)}">`,
  )
  for (const report of fileReports) {
    lines.push(
      `  <testsuite name="${xmlEscape(report.file)}" tests="${report.results.length}" ` +
        `failures="${report.failed}" skipped="${report.skipped}" time="${
          seconds(report.durationMs)
        }">`,
    )
    for (const result of report.results) {
      const head = `    <testcase name="${xmlEscape(result.name)}" time="${
        seconds(result.durationMs)
      }"`
      if (result.status === 'passed') {
        lines.push(`${head} />`)
      } else if (result.status === 'skipped') {
        lines.push(`${head}><skipped /></testcase>`)
      } else {
        const summary = xmlEscape((result.message ?? '').split('\n')[0])
        lines.push(
          `${head}><failure message="${summary}">${
            xmlEscape(result.message ?? '')
          }</failure></testcase>`,
        )
      }
    }
    lines.push('  </testsuite>')
  }
  lines.push('</testsuites>')
  return lines.join('\n')
}

const renderJsonResults = (fileReports, totals, elapsedMs) =>
  JSON.stringify(
    {
      tool: 'imp',
      passed: totals.passed,
      failed: totals.failed,
      skipped: totals.skipped,
      durationMs: elapsedMs,
      files: fileReports,
    },
    null,
    2,
  )

const renderReport = (reporter, fileReports, totals, elapsedMs) =>
  reporter === 'junit'
    ? renderJunit(fileReports, totals, elapsedMs)
    : renderJsonResults(fileReports, totals, elapsedMs)

export async function runTests(
  {
    root,
    paths,
    list = false,
    unit = false,
    e2e = false,
    filter = null,
    reporter = null,
    screenshotDir = null,
  },
) {
  const imp = await loadImpConfig(root)
  const testConfig = imp.test ?? {}
  const dependencies = imp.dependencies ?? {}

  if (reporter && !REPORTERS.has(reporter)) {
    throw new Error(`unknown --reporter '${reporter}' — use 'junit' or 'json'`)
  }

  const { unitFiles, specFiles } = await selectFiles({
    root,
    paths,
    unit,
    e2e,
    exclude: testConfig.exclude ?? [],
  })

  const toRelative = (file) => relative(root, file).replaceAll('\\', '/')

  if (list) {
    console.log(JSON.stringify([...unitFiles, ...specFiles].map(toRelative)))
    return 0
  }

  const files = [...unitFiles, ...specFiles]
  if (!files.length) {
    console.log('no test files found (unit tests end with .test.js, e2e specs with .spec.js)')
    return 0
  }

  if (files.length > 1) {
    printRunPlan({ unitFiles, specFiles, toRelative })
    return 0
  }

  const originalConsoleLog = console.log
  if (reporter) console.log = (...args) => console.error(...args)

  const totals = { passed: 0, failed: 0, skipped: 0 }
  const fileReports = []
  const startedAt = performance.now()
  const recordFile = (file, counts, fileStartedAt) =>
    fileReports.push({
      file: toRelative(file),
      passed: counts.passed,
      failed: counts.failed,
      skipped: counts.skipped,
      durationMs: Math.round(performance.now() - fileStartedAt),
      results: counts.results,
    })

  try {
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
        logger.warn(`dependency '${alias}' is declared but not vendored — run 'imp install'`)
      }
      const { resolveBrowser } = await import('./test_browser.js')
      e2eRun = { app, browserPath: await resolveBrowser(testConfig.browser) }
    }

    const addCounts = (counts) => {
      totals.passed += counts.passed
      totals.failed += counts.failed
      totals.skipped += counts.skipped
    }

    for (const file of files) {
      const fileStartedAt = performance.now()
      console.log(relative(root, file))
      const { code, error } = bundles.get(file)
      if (error) {
        totals.failed++
        console.log(`  ${red('✗')} failed to load`)
        console.log(red(indentMessage(error)))
        recordFile(file, {
          passed: 0,
          failed: 1,
          skipped: 0,
          results: [{
            name: '(failed to load)',
            status: 'failed',
            durationMs: 0,
            message: errorMessage(error),
          }],
        }, fileStartedAt)
        continue
      }
      try {
        const counts = isUnitFile(file)
          ? await runUnitFile({ code, filter })
          : await runSpecFile(file, { root, code, filter, ...e2eRun, screenshotDir })
        addCounts(counts)
        recordFile(file, counts, fileStartedAt)
      } catch (error) {
        totals.failed++
        console.log(`  ${red('✗')} failed to run`)
        console.log(red(indentMessage(error)))
        recordFile(file, {
          passed: 0,
          failed: 1,
          skipped: 0,
          results: [{
            name: '(failed to run)',
            status: 'failed',
            durationMs: 0,
            message: errorMessage(error),
          }],
        }, fileStartedAt)
      }
    }

    const parts = [`${totals.passed} passed`]
    if (totals.failed) parts.push(red(`${totals.failed} failed`))
    if (totals.skipped) parts.push(`${totals.skipped} skipped`)
    const fileCount = `${files.length} ${files.length === 1 ? 'file' : 'files'}`
    const elapsed = Math.round(performance.now() - startedAt)
    console.log(`\nimp test: ${parts.join(', ')} ${dim(`(${fileCount}, ${elapsed}ms)`)}`)
  } finally {
    if (reporter) console.log = originalConsoleLog
  }

  if (reporter) {
    console.log(
      renderReport(reporter, fileReports, totals, Math.round(performance.now() - startedAt)),
    )
  }
  return totals.failed ? 1 : 0
}
