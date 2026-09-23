import { dirname, extname, fromFileUrl, join, relative } from '@std/path'
import { denoPlugin } from '@deno/esbuild-plugin'
import { runEsbuild, shutdownBundler } from '../cli/src/deps.js'
import { impResolverPlugin } from '../cli/src/bundling.js'
import { resolveBrowser } from '../cli/src/test-browser.js'
import { scenarios } from './scenarios.js'
import { writeReport } from './report.js'

const PERF_DIR = fromFileUrl(new URL('.', import.meta.url))
const REPO_DIR = dirname(PERF_DIR.replace(/[/\\]$/, ''))
const APPS_DIR = join(PERF_DIR, 'apps')
const DIST_DIR = join(PERF_DIR, 'dist')
const RESULTS_DIR = join(PERF_DIR, 'results')
const IMP_BINARY = join(REPO_DIR, Deno.build.os === 'windows' ? 'imp.exe' : 'imp')

const DEFAULT_SAMPLES = 10
const WARMUP_SAMPLES = 2

const NPM_DEFINES = {
  'process.env.NODE_ENV': '"production"',
  '__VUE_OPTIONS_API__': 'false',
  '__VUE_PROD_DEVTOOLS__': 'false',
  '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

const readVersion = async (path) => JSON.parse(await Deno.readTextFile(path)).version

const IMPORTS_FILE = join(APPS_DIR, 'imports.json')

const npmVersion = async (name) => {
  const { imports } = JSON.parse(await Deno.readTextFile(IMPORTS_FILE))
  return imports[name].match(/@([\d.]+)$/)[1]
}

const FRAMEWORKS = {
  imp: {
    version: () => readVersion(join(REPO_DIR, 'deno.json')),
    build: (readable) => (readable ? buildReadableImpApp() : buildImpApp()),
  },
  react: {
    version: () => npmVersion('react'),
    build: (readable) => buildNpmApp('react', readable),
  },
  vue: {
    version: () => npmVersion('vue'),
    build: (readable) => buildNpmApp('vue', readable),
  },
}

function parseArguments(args) {
  const options = {
    frameworks: Object.keys(FRAMEWORKS),
    samples: DEFAULT_SAMPLES,
    filter: null,
    build: true,
    profile: false,
  }
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--frameworks') options.frameworks = args[++index].split(',')
    else if (arg === '--samples') options.samples = Number(args[++index])
    else if (arg === '--filter') options.filter = args[++index]
    else if (arg === '--skip-build') options.build = false
    else if (arg === '--profile') options.profile = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  for (const name of options.frameworks) {
    if (!FRAMEWORKS[name]) throw new Error(`unknown framework: ${name}`)
  }
  return options
}

async function buildImpApp() {
  const outdir = join(DIST_DIR, 'imp')
  const { success, stderr } = await new Deno.Command(IMP_BINARY, {
    args: ['build', '--output', outdir],
    cwd: join(APPS_DIR, 'imp'),
    stdout: 'null',
    stderr: 'piped',
  }).output()
  if (!success) throw new Error(`imp build failed:\n${new TextDecoder().decode(stderr)}`)
}

async function writeBundle(name, result) {
  const outdir = join(DIST_DIR, name)
  await Deno.mkdir(outdir, { recursive: true })
  for (const file of result.outputFiles) {
    await Deno.writeFile(join(outdir, file.path.slice('/bundle/'.length)), file.contents)
  }
  await Deno.copyFile(join(APPS_DIR, name, 'index.html'), join(outdir, 'index.html'))
}

const bundleOptions = (name, readable) => ({
  entryPoints: [new URL(`./apps/${name}/app.js`, import.meta.url).href],
  bundle: true,
  minify: !readable,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  legalComments: 'none',
  define: NPM_DEFINES,
  write: false,
  outdir: '/bundle',
  entryNames: 'app',
})

async function buildNpmApp(name, readable) {
  const result = await runEsbuild({
    plugins: [denoPlugin({ configPath: IMPORTS_FILE })],
    ...bundleOptions(name, readable),
  })
  await writeBundle(name, result)
}

async function buildReadableImpApp() {
  const result = await runEsbuild({
    plugins: [impResolverPlugin({ root: join(APPS_DIR, 'imp'), dependencies: {} }), denoPlugin()],
    ...bundleOptions('imp', true),
  })
  await writeBundle('imp', result)
}

function serveDist() {
  return Deno.serve({ port: 0, hostname: '127.0.0.1', onListen: () => {} }, async (request) => {
    const { pathname } = new URL(request.url)
    if (pathname === '/favicon.ico') return new Response(null, { status: 204 })
    const path = join(DIST_DIR, decodeURIComponent(pathname))
    const info = await Deno.stat(path).catch(() => null)
    const file = info?.isDirectory ? join(path, 'index.html') : info?.isFile ? path : null
    if (!file) return new Response('Not found', { status: 404 })
    return new Response(await Deno.readFile(file), {
      headers: {
        'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      },
    })
  })
}

async function launchBrowser() {
  const { default: puppeteer } = await import('../cli/src/vendor/puppeteer-core.js')
  const args = ['--disable-dev-shm-usage', '--disable-background-timer-throttling']
  try {
    if (Deno.uid() === 0) args.push('--no-sandbox')
  } catch {
    // uid is not available on every platform
  }
  const executablePath = await resolveBrowser(null)
  return puppeteer.launch({ executablePath, headless: true, args })
}

const runSteps = (page, steps) =>
  page.evaluate(async (steps) => {
    const start = performance.now()
    for (const [op, ...args] of steps) await globalThis.__bench.ops[op](...args)
    const scripted = performance.now()
    document.body.offsetHeight
    const end = performance.now()
    return { total: end - start, layout: end - scripted }
  }, steps)

const snapshot = (page) =>
  page.evaluate(() => {
    const collect = (root, tag, found) => {
      for (const node of root.querySelectorAll('*')) {
        if (node.localName === tag) found.push(node)
        if (node.shadowRoot) collect(node.shadowRoot, tag, found)
      }
      return found
    }
    const rows = collect(document.body, 'li', [])
    const spans = collect(document.body, 'span', [])
    return {
      rows: rows.length,
      selected: rows.filter((row) => row.classList.contains('selected')).length,
      firstLabel: rows[0]?.querySelector('.label')?.textContent ?? null,
      middleLabel: rows[rows.length >> 1]?.querySelector('.label')?.textContent ?? null,
      lastLabel: rows.at(-1)?.querySelector('.label')?.textContent ?? null,
      text: spans.filter((span) => !span.classList.contains('label')).map((span) =>
        span.textContent
      )
        .join('|'),
    }
  })

async function memoryProbe(page, session) {
  await session.send('HeapProfiler.collectGarbage')
  await session.send('HeapProfiler.collectGarbage')
  const metrics = await page.metrics()
  return {
    nodes: metrics.Nodes,
    listeners: metrics.JSEventListeners,
    heap: metrics.JSHeapUsedSize,
  }
}

const delta = (after, before) => ({
  nodes: after.nodes - before.nodes,
  listeners: after.listeners - before.listeners,
  heap: after.heap - before.heap,
})

const repeated = (steps, times) => Array.from({ length: times }, () => steps).flat()

const slug = (text) => text.replaceAll(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')

async function profiled(session, name, scenario, run) {
  await session.send('Profiler.enable')
  await session.send('Profiler.setSamplingInterval', { interval: 100 })
  await session.send('Profiler.start')
  const result = await run()
  const { profile } = await session.send('Profiler.stop')
  await session.send('Profiler.disable')
  await Deno.mkdir(RESULTS_DIR, { recursive: true })
  const path = join(RESULTS_DIR, `${name}-${slug(scenario.name)}.cpuprofile`)
  await Deno.writeTextFile(path, JSON.stringify(profile))
  return result
}

async function runScenario(page, session, name, scenario, options) {
  const samples = scenario.samples ?? options.samples
  const durations = []
  const layouts = []
  const memory = []
  let dom = null
  for (let sample = 0; sample < samples + WARMUP_SAMPLES; sample++) {
    await page.reload({ waitUntil: 'load' })
    await page.waitForFunction(() => Boolean(globalThis.__bench))
    const baseline = scenario.memory ? await memoryProbe(page, session) : null
    await runSteps(page, scenario.prepare)
    const mounted = scenario.memory ? await memoryProbe(page, session) : null
    const measure = () => runSteps(page, repeated(scenario.measure, scenario.repeat ?? 1))
    const lastSample = sample === samples + WARMUP_SAMPLES - 1
    const duration = options.profile && lastSample
      ? await profiled(session, name, scenario, measure)
      : await measure()
    if (dom === null) dom = await snapshot(page)
    await runSteps(page, scenario.finish)
    if (sample < WARMUP_SAMPLES) continue
    durations.push(duration.total)
    layouts.push(duration.layout)
    if (scenario.memory) {
      const settled = await memoryProbe(page, session)
      memory.push({ mounted: delta(mounted, baseline), leaked: delta(settled, baseline) })
    }
  }
  return { name: scenario.name, group: scenario.group, durations, layouts, memory, dom }
}

async function runFramework(browser, url, name, options) {
  const page = await browser.newPage()
  page.on('pageerror', (error) => console.error(`  ${name}: page error: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`  ${name}: console: ${message.text()}`)
  })
  const session = await page.createCDPSession()
  await session.send('HeapProfiler.enable')
  await page.goto(url, { waitUntil: 'load' })
  const results = []
  for (const scenario of scenarios) {
    if (options.filter && !scenario.name.includes(options.filter)) continue
    if (scenario.frameworks && !scenario.frameworks.includes(name)) continue
    const result = await runScenario(page, session, name, scenario, options)
    const median = [...result.durations].sort((a, b) => a - b)[result.durations.length >> 1]
    console.log(`  ${name}: ${scenario.name}: ${median.toFixed(2)} ms`)
    results.push(result)
  }
  await page.close()
  return results
}

async function main() {
  const options = parseArguments(Deno.args)
  const versions = {}
  for (const name of options.frameworks) versions[name] = await FRAMEWORKS[name].version()
  if (options.build) {
    await Deno.remove(DIST_DIR, { recursive: true }).catch(() => {})
    for (const name of options.frameworks) {
      console.log(`building ${name} ${versions[name]}`)
      await FRAMEWORKS[name].build(options.profile)
    }
    await shutdownBundler()
  }
  const server = serveDist()
  const browser = await launchBrowser()
  const chrome = await browser.version()
  const run = {
    date: new Date().toISOString(),
    browser: chrome,
    platform: `${Deno.build.os} ${Deno.build.arch}`,
    samples: options.samples,
    versions,
    frameworks: {},
  }
  try {
    for (const name of options.frameworks) {
      console.log(`running ${name}`)
      const url = `http://127.0.0.1:${server.addr.port}/${name}/`
      run.frameworks[name] = await runFramework(browser, url, name, options)
    }
  } finally {
    await browser.close()
    await server.shutdown()
  }
  await Deno.mkdir(RESULTS_DIR, { recursive: true })
  const stamp = run.date.replaceAll(':', '-').slice(0, 19)
  const jsonPath = join(RESULTS_DIR, `${stamp}.json`)
  const markdownPath = join(RESULTS_DIR, 'latest.md')
  await Deno.writeTextFile(jsonPath, JSON.stringify(run, null, 2) + '\n')
  await Deno.writeTextFile(markdownPath, writeReport(run))
  console.log(`results: ${relative(REPO_DIR, jsonPath)} and ${relative(REPO_DIR, markdownPath)}`)
}

await main()
