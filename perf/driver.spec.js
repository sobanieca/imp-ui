import { test } from 'imp/test'
import { scenarios } from './scenarios.js'
import { writeReport } from './report.js'
import { base, options, versions } from './run-options.js'

const WARMUP_SAMPLES = 2

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
      text: spans
        .filter((span) => !span.classList.contains('label'))
        .map((span) => span.textContent)
        .join('|'),
    }
  })

const memoryProbe = async (page, session) => {
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

const profiled = async (session, profiles, name, scenario, run) => {
  await session.send('Profiler.enable')
  await session.send('Profiler.setSamplingInterval', { interval: 100 })
  await session.send('Profiler.start')
  const result = await run()
  const { profile } = await session.send('Profiler.stop')
  await session.send('Profiler.disable')
  profiles[`${name}-${slug(scenario.name)}.cpuprofile`] = profile
  return result
}

const runScenario = async (page, session, profiles, name, scenario) => {
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
    const duration =
      options.profile && lastSample
        ? await profiled(session, profiles, name, scenario, measure)
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

const runFramework = async (browser, profiles, name) => {
  const page = await browser.newPage()
  page.on('pageerror', (error) => console.error(`  ${name}: page error: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`  ${name}: console: ${message.text()}`)
  })
  const session = await page.createCDPSession()
  await session.send('HeapProfiler.enable')
  await page.goto(`${base}/${name}/`, { waitUntil: 'load' })
  const results = []
  for (const scenario of scenarios) {
    if (options.filter && !scenario.name.includes(options.filter)) continue
    if (scenario.frameworks && !scenario.frameworks.includes(name)) continue
    const result = await runScenario(page, session, profiles, name, scenario)
    const median = [...result.durations].sort((a, b) => a - b)[result.durations.length >> 1]
    console.log(`  ${name}: ${scenario.name}: ${median.toFixed(2)} ms`)
    results.push(result)
  }
  await page.close()
  return results
}

test(
  'performance scenarios',
  async ({ page: host }) => {
    const browser = host.browser()
    const run = {
      date: new Date().toISOString(),
      browser: await browser.version(),
      platform: options.platform,
      samples: options.samples,
      versions,
      frameworks: {},
    }
    const profiles = {}
    for (const name of options.frameworks) {
      console.log(`running ${name}`)
      run.frameworks[name] = await runFramework(browser, profiles, name)
    }
    const report = { run, markdown: writeReport(run), profiles }
    console.log(`IMP-REPORT-BEGIN\n${JSON.stringify(report)}\nIMP-REPORT-END`)
  },
  { timeout: 4 * 60 * 60 * 1000 },
)
