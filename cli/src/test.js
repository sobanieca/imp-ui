import { basename, fromFileUrl, join, relative, resolve, toFileUrl } from '@std/path'
import { encodeBase64 } from '@std/encoding/base64'
import { denoPlugin } from '@deno/esbuild-plugin'
import { loadImpConfig } from './config.js'
import { collectFiles } from './walk.js'
import { DATAURL_ASSET_LOADERS, runEsbuild, shutdownBundler } from './deps.js'
import { collectMocks, impResolverPlugin } from './bundling.js'
import { createRequestHandler, loadApp } from './start.js'
import { createClock } from './test-clock.js'
import { piercingBrowser, piercingPage } from './test-page.js'
import { encodeGif, resolveVideoOptions, startScreencast, stopScreencast } from './test-video.js'
import { bold, dim, green, red, yellow } from './colors.js'
import { logger } from './logger.js'
import { isSpecFile, isTestFile, isUnitFile } from './project-files.js'

const REGISTRY_KEY = Symbol.for('imp.test.registry')

const UNIT_TIMEOUT = 5_000
const E2E_TIMEOUT = 30_000

const TEST_EXTENSIONS = new Set(['js', 'mjs'])

async function bundleTestFile(file, { root, dependencies }) {
  const mocks = await collectMocks(file, { root, dependencies })
  const result = await runEsbuild({
    plugins: [impResolverPlugin({ root, dependencies, mocks }), denoPlugin()],
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
      'fakeTimers is only available in unit tests (*.test.js) - e2e specs run in a real browser; control time through the Puppeteer page instead',
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
  const { installDomEnvironment } = await import('./test-dom.js')
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
  const { default: puppeteer } = await import('./vendor/puppeteer-core.js')
  const args = ['--disable-dev-shm-usage']
  try {
    if (Deno.uid() === 0) args.push('--no-sandbox')
  } catch { /* not available on this platform */ }
  return puppeteer.launch({ executablePath, headless: true, args })
}

async function saveRecording(recording, { root, file, videoDir, videoOptions }) {
  const frames = await stopScreencast(recording)
  if (!frames.length) return
  const bytes = encodeGif(frames, videoOptions)
  if (!bytes) return
  const dir = resolve(root, videoDir)
  const path = join(dir, `${slug(basename(file))}.gif`)
  await Deno.mkdir(dir, { recursive: true })
  await Deno.writeFile(path, bytes)
  console.log(dim(`  video: ${relative(root, path)}`))
}

async function runSpecFile(
  file,
  { root, code, filter, browserPath, app, screenshotDir, videoDir, videoOptions },
) {
  const clients = new Set()
  const server = Deno.serve(
    { port: 0, hostname: '127.0.0.1', onListen: () => {} },
    createRequestHandler({ ...app, clients }),
  )
  const baseUrl = `http://127.0.0.1:${server.addr.port}/`

  let browser = null
  let page = null
  let recording = null
  try {
    browser = await launchBrowser(browserPath)
    page = await browser.newPage()
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
    await page.goto(baseUrl, { waitUntil: 'load' })
    if (videoDir) recording = await startScreencast(page, videoOptions)

    const registry = freshRegistry()
    await importCode(code)
    return await runRegistry(registry, {
      context: { page: piercingPage(page), browser: piercingBrowser(browser), baseUrl },
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
    if (recording) {
      await saveRecording(recording, { root, file, videoDir, videoOptions }).catch((error) =>
        logger.warn(`failed to write video for ${relative(root, file)}: ${error.message}`)
      )
    }
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
        `not a test file: ${target} - unit tests end with .test.js, e2e specs with .spec.js`,
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

function printChooseLevel() {
  console.log(
    'imp test needs a single file, or a level to run every file of that kind in parallel:',
  )
  console.log(`  ${bold('imp test --unit')}   run every *.test.js file, each in its own process`)
  console.log(`  ${bold('imp test --e2e')}    run every *.spec.js file, each in its own process`)
  console.log(`  ${bold('imp test <file>')}   run a single test file in this process`)
  console.log(
    `\nNarrow discovery with a path (${dim('imp test --e2e checkout/')}), cap parallelism`,
  )
  console.log(`with ${dim('--jobs <n>')}, or filter tests with ${dim('--filter <text>')}.`)
}

const defaultJobs = () => Math.max(1, navigator.hardwareConcurrency || 4)

function impReinvocation(extraArgs) {
  const execPath = Deno.execPath()
  const denoBinary = Deno.build.os === 'windows' ? 'deno.exe' : 'deno'
  if (basename(execPath).toLowerCase() === denoBinary) {
    return { command: execPath, args: ['run', '-A', fromFileUrl(Deno.mainModule), ...extraArgs] }
  }
  return { command: execPath, args: extraArgs }
}

async function runTestSubprocess(relativeFile, { root, passthroughArgs }) {
  const { command, args } = impReinvocation(['test', relativeFile, ...passthroughArgs])
  const { code, stdout, stderr } = await new Deno.Command(command, {
    args,
    cwd: root,
    stdout: 'piped',
    stderr: 'piped',
  }).output()
  const decoder = new TextDecoder()
  return { file: relativeFile, code, output: decoder.decode(stdout) + decoder.decode(stderr) }
}

async function runInPool(items, concurrency, worker) {
  const results = new Array(items.length)
  let next = 0
  const runner = async () => {
    while (true) {
      const index = next++
      if (index >= items.length) return
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, runner),
  )
  return results
}

const indentBlock = (text) => text.split('\n').map((line) => `    ${line}`).join('\n')

async function orchestrate({ root, files, jobs, passthroughArgs, toRelative }) {
  const startedAt = performance.now()
  const relativeFiles = files.map(toRelative)
  const fileCount = `${files.length} ${files.length === 1 ? 'file' : 'files'}`
  console.log(`imp test: running ${fileCount} in parallel\n`)

  const results = await runInPool(
    relativeFiles,
    jobs,
    (relativeFile) => runTestSubprocess(relativeFile, { root, passthroughArgs }),
  )

  let failed = 0
  for (const result of results) {
    if (result.code === 0) {
      console.log(`${green('✓')} ${result.file}`)
    } else {
      failed++
      console.log(`${red('✗')} ${result.file}`)
      const output = result.output.trimEnd()
      if (output) console.log(indentBlock(output))
    }
  }

  const parts = [`${results.length - failed} passed`]
  if (failed) parts.push(red(`${failed} failed`))
  const elapsed = Math.round(performance.now() - startedAt)
  console.log(`\nimp test: ${parts.join(', ')} ${dim(`(${fileCount}, ${elapsed}ms)`)}`)
  return failed ? 1 : 0
}

export async function runTests(
  {
    root,
    paths,
    list = false,
    unit = false,
    e2e = false,
    jobs = null,
    filter = null,
    screenshotDir = null,
    videoDir = null,
    mocks = null,
  },
) {
  const imp = await loadImpConfig(root)
  const testConfig = imp.test ?? {}
  const dependencies = imp.dependencies ?? {}
  const videoConfig = testConfig.video ?? {}
  const resolvedVideoDir = (videoDir !== null || videoConfig.enable === true)
    ? (videoDir ?? '.imp/videos')
    : null
  const videoOptions = resolveVideoOptions(videoConfig)

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

  if (unit || e2e) {
    const passthroughArgs = []
    if (filter) passthroughArgs.push('--filter', filter)
    if (screenshotDir) passthroughArgs.push('--screenshots', screenshotDir)
    if (videoDir) passthroughArgs.push('--video', videoDir)
    return await orchestrate({
      root,
      files,
      jobs: jobs ?? defaultJobs(),
      passthroughArgs,
      toRelative,
    })
  }

  if (files.length > 1) {
    printChooseLevel()
    return 1
  }

  const totals = { passed: 0, failed: 0, skipped: 0 }
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
        `e2e entry not found: ${entry} - each *.spec.js runs against your served app; set "test": { "entry": "<page>.html" } in imp.json if it is not index.html`,
      )
    }
    const app = await loadApp(entryPath, { mocks })
    for (const alias of app.missingDependencies) {
      logger.warn(`dependency '${alias}' is declared but not vendored - run 'imp install'`)
    }
    const { resolveBrowser } = await import('./test-browser.js')
    e2eRun = { app, browserPath: await resolveBrowser(testConfig.browser) }
  }

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
        : await runSpecFile(file, {
          root,
          code,
          filter,
          ...e2eRun,
          screenshotDir,
          videoDir: resolvedVideoDir,
          videoOptions,
        })
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
  const fileCount = `${files.length} ${files.length === 1 ? 'file' : 'files'}`
  const elapsed = Math.round(performance.now() - startedAt)
  console.log(`\nimp test: ${parts.join(', ')} ${dim(`(${fileCount}, ${elapsed}ms)`)}`)

  return totals.failed ? 1 : 0
}
