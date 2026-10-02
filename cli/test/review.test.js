import { join } from '@std/path'
import { assertSnapshot } from './snapshot.js'
import { formatReview, isLocalRequest, reviewFileName } from '../src/review.js'
import {
  copyDirectory,
  fixture,
  normalize,
  runImp,
  section,
  startPreviewServer,
  startServer,
  tempDir,
} from './helpers.js'

Deno.test('a review file names itself by timestamp and records the page it came from', async () => {
  const at = new Date('2026-08-25T12:10:36.682Z')
  const address = (hostname) => ({ remoteAddr: { transport: 'tcp', hostname } })
  const report = [
    `file name: ${reviewFileName(at)}`,
    `file name when that one exists: ${reviewFileName(at, 2)}`,
    `from 127.0.0.1: ${isLocalRequest(address('127.0.0.1'))}`,
    `from ::1: ${isLocalRequest(address('::1'))}`,
    `from ::ffff:127.0.0.1: ${isLocalRequest(address('::ffff:127.0.0.1'))}`,
    `from 192.168.1.20: ${isLocalRequest(address('192.168.1.20'))}`,
    `with no address at all: ${isLocalRequest(undefined)}`,
    '',
    formatReview(
      {
        page: 'http://localhost:4517/preview/components/counter.preview.js',
        title: 'imp preview - Widgets / Counter',
        viewport: '900x700 at 2x',
        scroll: '0,1240',
        scheme: 'dark',
        motion: 'reduce',
        lang: 'en',
        dir: 'ltr',
        element: {
          path: 'body > imp-preview-page >> demo-counter >> span#value',
          rect: '10x19 at 371,485',
          text: 'Total 0',
          html: '<span id="value">0</span>',
        },
        state: [{ name: 'demo.count', value: 0 }, { name: 'demo.filter', value: 'done' }],
        controls: [
          { name: 'input[name=title]', value: 'Buy milk' },
          { name: 'input[name=done]', value: 'checked', disabled: true },
          { name: 'input[name=secret]', value: null, length: 8 },
        ],
        comment: 'The count is cut off.\n\nIt needs more room at 320px.',
      },
      at.toISOString(),
      [
        '[BROWSER:error] TypeError: todo is undefined',
        '[HTTP] GET /api/todos -> 500 12ms',
      ],
    ),
    formatReview(
      { element: { path: 'body' }, comment: 'a review with no page around it' },
      at.toISOString(),
    ),
  ].join('\n')
  await assertSnapshot('review-file', report)
})

Deno.test('imp start saves a review under .imp/reviews', async () => {
  const dir = await tempDir()
  await copyDirectory(fixture('basic'), dir)
  const server = await startServer(dir)
  const endpoint = `http://127.0.0.1:${server.port}/@imp/review`
  const post = (body) =>
    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  try {
    const saved = await post({
      page: `http://localhost:${server.port}/`,
      title: 'basic app',
      viewport: '900x700',
      element: { path: 'body > div#app > h1', text: 'hello', html: '<h1>hello</h1>' },
      comment: 'the heading should be quieter',
    })
    const { path } = await saved.json()
    const written = await Deno.readTextFile(join(dir, path))
    const blank = await post({ element: { path: 'body' }, comment: '   ' })
    const malformed = await post('not json at all')
    await post({
      element: { path: 'body > footer' },
      comment: 'the year in the footer is stale',
    })
    const listed = await runImp(['review'], dir)
    const fromSubdirectory = await runImp(['review'], join(dir, 'public'))
    const cleared = await runImp(['review', 'clear'], dir)
    const afterClearing = await runImp(['review'], dir)
    const clearedAgain = await runImp(['review', 'clear'], dir)
    const maskTimestamps = (text) =>
      normalize(text)
        .replaceAll(/[\d-]+T[\d:.-]+Z/g, '<timestamp>')
        .replaceAll(`:${server.port}`, ':<port>')
        .replaceAll(dir, '<tmp>')
    const report = [
      `POST /@imp/review: ${saved.status} ${saved.headers.get('content-type')}`,
      `path: ${path.replace(/[\d-]+T[\d-]+Z/, '<timestamp>')}`,
      `on a blank comment: ${blank.status} ${JSON.stringify(await blank.json())}`,
      `on a malformed body: ${malformed.status} ${JSON.stringify(await malformed.json())}`,
      '',
      maskTimestamps(written),
      section('imp review', maskTimestamps(listed.stdout)),
      section(
        'imp review (cwd: public/)',
        maskTimestamps(fromSubdirectory.stdout).trimEnd().split('\n').at(-1),
      ),
      section('imp review clear', normalize(cleared.stdout)),
      section('imp review after clearing', normalize(afterClearing.stdout)),
      section('imp review clear again', normalize(clearedAgain.stdout)),
      `reviews folder left behind: ${await Deno.stat(join(dir, '.imp', 'reviews')).then(
        () => true,
        () => false,
      )}`,
    ].join('\n')
    await assertSnapshot('start-review-saved', report + '\n')
  } finally {
    await server.stop()
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('the review widget picks an element in the preview page', async () => {
  const dir = await tempDir()
  await copyDirectory(fixture('preview'), dir)
  const server = await startPreviewServer(dir)
  const { resolveBrowser } = await import('../src/test-browser.js')
  const { default: puppeteer } = await import('../src/vendor/puppeteer-core.js')
  const args = ['--disable-dev-shm-usage']
  try {
    if (Deno.uid() === 0) args.push('--no-sandbox')
  } catch { /* not available on this platform */ }
  const browser = await puppeteer.launch({
    executablePath: await resolveBrowser(),
    headless: true,
    args,
  })
  try {
    const page = await browser.newPage()
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
    await page.setViewport({ width: 900, height: 700 })
    await page.goto(
      `http://localhost:${server.port}/widgets/counter`,
      { waitUntil: 'load' },
    )
    await page.waitForFunction(() => document.getElementById('imp-review')?.shadowRoot)
    const flow = await page.evaluate(async () => {
      const shadow = document.getElementById('imp-review').shadowRoot
      const view = () =>
        [...shadow.querySelectorAll('.view')].find((panel) => !panel.hidden).dataset.view
      const deep = (root, name) => {
        for (const element of root.querySelectorAll('*')) {
          if (element.localName === name) return element
          const found = element.shadowRoot ? deep(element.shadowRoot, name) : null
          if (found) return found
        }
        return null
      }
      const outline = () => shadow.querySelector('.outline')
      const waitFor = async (description, ready) => {
        const deadline = Date.now() + 10000
        while (!ready()) {
          if (Date.now() > deadline) throw new Error(`timed out waiting for ${description}`)
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
      }
      const steps = {
        hiddenAtFirst: shadow.querySelector('.panel').hidden &&
          shadow.querySelector('.actions').hidden,
        markShown: Boolean(shadow.querySelector('.toggle svg use')),
      }
      shadow.querySelector('.toggle').click()
      steps.actionsShown = !shadow.querySelector('.actions').hidden
      steps.actionLabels = [...shadow.querySelectorAll('.action')]
        .map((button) => button.getAttribute('aria-label')).join(', ')
      steps.panelStillHidden = shadow.querySelector('.panel').hidden
      steps.expanded = shadow.querySelector('.toggle').getAttribute('aria-expanded')
      await waitFor(
        'the demo component to render',
        () => deep(document, 'demo-counter')?.shadowRoot?.querySelector('#value'),
      )
      const target = deep(document, 'demo-counter').shadowRoot.querySelector('#value')
      shadow.querySelector('[data-action="pick"]').click()
      steps.pickingView = view()
      await waitFor('the element picker to start listening', () => {
        target.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, composed: true }))
        return !outline().hidden
      })
      steps.highlighted = !outline().hidden
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
      await waitFor('the commenting view', () => view() === 'commenting')
      steps.commentingView = view()
      steps.outlineKept = !outline().hidden
      steps.locatorShown = shadow.textContent.includes('>>')
      const field = shadow.querySelector('textarea')
      field.value = 'The value is cut off below 320px.'
      shadow.querySelector('[data-action="save"]').click()
      await waitFor('the review to be saved', () => shadow.querySelector('.status').textContent)
      steps.status = shadow.querySelector('.status').textContent
      steps.viewAfterSaving = view()
      steps.outlineGone = outline().hidden
      console.warn('widget check')
      globalThis.__impFlushTelemetry()
      await new Promise((resolve) => setTimeout(resolve, 300))
      shadow.querySelector('[data-action="console"]').click()
      await waitFor(
        'the console lines',
        () => shadow.querySelector('.lines').textContent.includes('widget check'),
      )
      steps.consoleView = view()
      steps.consoleTitle = shadow.querySelector('[data-log-title]').textContent
      steps.consolePressed = shadow.querySelector('[data-action="console"]')
        .getAttribute('aria-pressed')
      steps.consoleLine = [...shadow.querySelectorAll('.entry')]
        .find((item) => item.textContent.includes('widget check'))?.className
      console.error('arrived live')
      globalThis.__impFlushTelemetry()
      await waitFor(
        'the live line',
        () => shadow.querySelector('.lines').textContent.includes('arrived live'),
      )
      steps.liveLine = [...shadow.querySelectorAll('.entry')]
        .find((item) => item.textContent.includes('arrived live'))?.className
      const entry = shadow.querySelector('.entry')
      steps.collapsedAtFirst = entry.getAttribute('aria-expanded')
      entry.click()
      steps.expandedOnClick = entry.getAttribute('aria-expanded')
      const chip = (name) => shadow.querySelector(`.chip[data-filter="${name}"]`)
      steps.consoleChips = [...shadow.querySelectorAll('.chip')]
        .map((button) => button.textContent).join(', ')
      chip('Error').click()
      steps.filtered = [...shadow.querySelectorAll('.entry .text')]
        .map((text) => text.textContent).join(' | ')
      steps.pressedChip = chip('Error').getAttribute('aria-pressed')
      chip('Info').click()
      steps.noMatch = shadow.querySelector('.lines').textContent.trim()
      chip('All').click()
      const clear = shadow.querySelector('[data-action="clear"]')
      const inPage = () => globalThis.__impTelemetry.entries()
      const netCount = () => inPage().filter((item) => item.type === 'net').length
      const netBefore = netCount()
      steps.clearLabel = `${clear.getAttribute('aria-label')} (disabled ${clear.disabled})`
      clear.click()
      steps.afterClear = shadow.querySelector('.lines').textContent.trim()
      steps.clearedInPage = inPage().filter((item) => item.type === 'console').length
      steps.clearDisabled = clear.disabled
      steps.networkUntouched = netCount() === netBefore
      console.log('after clear')
      await waitFor(
        'the line after the clear',
        () => shadow.querySelector('.lines').textContent.includes('after clear'),
      )
      steps.linesAfterClear = [...shadow.querySelectorAll('.entry .text')]
        .map((text) => text.textContent).join(' | ')
      steps.clearEnabledAgain = !clear.disabled
      shadow.querySelector('[data-action="network"]').click()
      await waitFor(
        'the network title',
        () => shadow.querySelector('[data-log-title]').textContent === 'Network logs',
      )
      steps.networkView = view()
      steps.networkChips = [...shadow.querySelectorAll('[data-group]')]
        .map((row) =>
          [...row.querySelectorAll('.chip')]
            .map((button) =>
              button.getAttribute('aria-pressed') === 'true'
                ? `[${button.textContent}]`
                : button.textContent
            ).join(', ')
        ).join(' / ')
      const toggle = shadow.querySelector('.toggle')
      const pointer = (type, x, y) =>
        toggle.dispatchEvent(
          new PointerEvent(type, {
            clientX: x,
            clientY: y,
            button: 0,
            pointerId: 1,
            bubbles: true,
          }),
        )
      const before = document.getElementById('imp-review').getBoundingClientRect()
      pointer('pointerdown', before.left + 20, before.top + 20)
      pointer('pointermove', before.left - 300, before.top - 200)
      pointer('pointerup', before.left - 300, before.top - 200)
      toggle.click()
      const after = document.getElementById('imp-review').getBoundingClientRect()
      steps.moved = `${Math.round(before.left - after.left)},${Math.round(before.top - after.top)}`
      steps.collapsedByDrag = shadow.querySelector('.actions').hidden
      steps.remembered = localStorage.getItem('imp-review-position')
      return steps
    })
    const files = []
    for await (const entry of Deno.readDir(join(dir, '.imp', 'reviews'))) files.push(entry.name)
    const written = await Deno.readTextFile(join(dir, '.imp', 'reviews', files[0]))
    const report = [
      `widget collapsed before the toggle: ${flow.hiddenAtFirst}`,
      `imp mark on the toggle: ${flow.markShown}`,
      `actions shown after the toggle: ${flow.actionsShown} (aria-expanded ${flow.expanded})`,
      `actions: ${flow.actionLabels}`,
      `panel still hidden: ${flow.panelStillHidden}`,
      `view after Add review: ${flow.pickingView}`,
      `element highlighted on hover: ${flow.highlighted}`,
      `view after clicking the element: ${flow.commentingView}`,
      `picked element stays outlined while commenting: ${flow.outlineKept}`,
      `element locator shown to the reviewer: ${flow.locatorShown}`,
      `view after saving: ${flow.viewAfterSaving}`,
      `outline cleared after saving: ${flow.outlineGone}`,
      `status after saving: ${flow.status.replace(/[\d-]+T[\d-]+Z/, '<timestamp>')}`,
      `console view: ${flow.consoleView} titled ${flow.consoleTitle} (aria-pressed ${flow.consolePressed})`,
      `console warning listed with tone: ${flow.consoleLine}`,
      `line that arrived live, with tone: ${flow.liveLine}`,
      `entry collapsed at first: aria-expanded ${flow.collapsedAtFirst}, after a click: ${flow.expandedOnClick}`,
      `console filters: ${flow.consoleChips}`,
      `filtered to Error (aria-pressed ${flow.pressedChip}): ${flow.filtered}`,
      `filter with no match: ${flow.noMatch}`,
      `clear button: ${flow.clearLabel}`,
      `after clear: ${flow.afterClear}, console entries left in the page: ${flow.clearedInPage}, ` +
      `button disabled: ${flow.clearDisabled}, network entries untouched: ${flow.networkUntouched}`,
      `lines after clear: ${flow.linesAfterClear}, button enabled again: ${flow.clearEnabledAgain}`,
      `network view: ${flow.networkView}, filters: ${flow.networkChips}`,
      `moved by a drag: ${flow.moved}, collapsed: ${flow.collapsedByDrag}`,
      `position remembered: ${flow.remembered !== null}`,
      `review files written: ${files.length}`,
      '',
      written
        .replace(/^ *\[HTTP\] .*\n/gm, '')
        .replace(/^time: .*$/m, 'time: <timestamp>')
        .replace(/^element: .*(?=demo-counter)/m, 'element: ... ')
        .replace(/^rect: \d+x\d+ at \d+,\d+$/m, 'rect: <w>x<h> at <x>,<y>')
        .replaceAll(`:${server.port}`, ':<port>')
        .replaceAll(dir, '<tmp>')
        .replaceAll(dir.replaceAll('/', '\\'), '<tmp>'),
    ].join('\n')
    await assertSnapshot('preview-review-widget', report)
  } finally {
    await browser.close().catch(() => {})
    await server.stop()
    await Deno.remove(dir, { recursive: true })
  }
})

Deno.test('the review widget edits the applied theme of an app, and the draft survives a reload', async () => {
  const dir = await tempDir()
  await Deno.writeTextFile(join(dir, 'imp.json'), '{ "name": "themed" }\n')
  await Deno.writeTextFile(
    join(dir, 'index.html'),
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>themed</title></head>' +
      '<body><div id="app"></div><script type="module" src="/app.js"></script></body></html>\n',
  )
  await Deno.writeTextFile(
    join(dir, 'app.js'),
    "import { init, mount } from 'imp'\nimport { button } from 'imp/std'\n" +
      "await init({ theme: 'imp-light' })\nmount('#app', () => button('hello'))\n",
  )
  const server = await startServer(dir)
  const { resolveBrowser } = await import('../src/test-browser.js')
  const { default: puppeteer } = await import('../src/vendor/puppeteer-core.js')
  const args = ['--disable-dev-shm-usage']
  try {
    if (Deno.uid() === 0) args.push('--no-sandbox')
  } catch { /* not available on this platform */ }
  const browser = await puppeteer.launch({
    executablePath: await resolveBrowser(),
    headless: true,
    args,
  })
  const widgetReady = () => document.getElementById('imp-review')?.shadowRoot
  const primaryToken = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--imp-color-primary').trim()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 900, height: 700 })
    await page.goto(`http://localhost:${server.port}/`, { waitUntil: 'load' })
    await page.waitForFunction(widgetReady)
    const edited = await page.evaluate(async () => {
      const shadow = document.getElementById('imp-review').shadowRoot
      const waitFor = async (description, ready) => {
        const deadline = Date.now() + 10000
        while (!ready()) {
          if (Date.now() > deadline) throw new Error(`timed out waiting for ${description}`)
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
      }
      const token = (name) =>
        getComputedStyle(document.documentElement).getPropertyValue(`--imp-${name}`).trim()
      const labelled = (root, tag, label) => {
        for (const element of root.querySelectorAll('*')) {
          if (
            element.localName === tag &&
            element.shadowRoot?.querySelector('label')?.textContent.trim() === label
          ) {
            return element.shadowRoot.querySelector('input, select, textarea')
          }
          const found = element.shadowRoot ? labelled(element.shadowRoot, tag, label) : null
          if (found) return found
        }
        return null
      }
      const change = (node, value) => {
        node.value = value
        node.dispatchEvent(new Event(node.localName === 'select' ? 'change' : 'input'))
      }
      const steps = { before: token('color-primary') }
      shadow.querySelector('.toggle').click()
      steps.actions = [...shadow.querySelectorAll('.action')]
        .map((button) => button.getAttribute('aria-label')).join(', ')
      shadow.querySelector('[data-action="theme"]').click()
      const probe = document.body.appendChild(document.createElement('div'))
      probe.style.background = 'var(--imp-color-surface)'
      steps.panel = getComputedStyle(shadow.querySelector('.panel')).backgroundColor ===
          getComputedStyle(probe).backgroundColor
        ? `the surface of the theme, ${token('color-surface')}`
        : getComputedStyle(shadow.querySelector('.panel')).backgroundColor
      probe.remove()
      steps.view = [...shadow.querySelectorAll('.view')].find((panel) => !panel.hidden).dataset.view
      steps.pressed = shadow.querySelector('[data-action="theme"]').getAttribute('aria-pressed')
      await waitFor(
        'the theme editor to load',
        () => labelled(shadow.querySelector('.card'), 'imp-code-editor', 'Tokens'),
      )
      steps.editor = shadow.querySelector('.card').firstElementChild.localName
      const knobHosts = []
      const walkKnobs = (root) => {
        for (const element of root.querySelectorAll('*')) {
          const knobNames = ['imp-tabs', 'imp-color-picker', 'imp-combo-box', 'imp-segmented']
          if (knobNames.includes(element.localName)) knobHosts.push(element.localName)
          if (element.shadowRoot) walkKnobs(element.shadowRoot)
        }
      }
      walkKnobs(shadow.querySelector('.card'))
      steps.knobs = knobHosts.length === 0 ? 'none' : knobHosts.join(', ')
      const editor = labelled(shadow.querySelector('.card'), 'imp-code-editor', 'Tokens')
      const shown = JSON.parse(editor.value)
      steps.json = `${Object.keys(shown).length} tokens, primary ${shown['color-primary']}`
      change(
        editor,
        JSON.stringify({ ...shown, 'color-primary': '#0f766e', 'color-surface': '#fff7ed' }),
      )
      steps.jsonSurface = token('color-surface')
      steps.jsonPrimary = token('color-primary')
      change(editor, '{ not json')
      steps.jsonBroken = token('color-surface')
      steps.draftKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith('imp.theme-draft.')
      )
        .join(', ')
      shadow.querySelector('[data-action="theme"]').click()
      steps.closed = shadow.querySelector('.card').childElementCount
      return steps
    })
    await page.reload({ waitUntil: 'load' })
    await page.waitForFunction(widgetReady)
    await page.waitForFunction(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--imp-color-primary').trim() ===
        '#0f766e'
    )
    const afterReload = await page.evaluate(primaryToken)
    const findResetButton = () => {
      const deep = (root) => {
        for (const element of root.querySelectorAll('*')) {
          if (
            element.localName === 'imp-button' && element.shadowRoot.textContent.trim() === 'reset'
          ) {
            return element
          }
          const found = element.shadowRoot ? deep(element.shadowRoot) : null
          if (found) return found
        }
        return null
      }
      return deep(document.getElementById('imp-review').shadowRoot.querySelector('.card'))
    }
    await page.evaluate(() => {
      const shadow = document.getElementById('imp-review').shadowRoot
      shadow.querySelector('.toggle').click()
      shadow.querySelector('[data-action="theme"]').click()
    })
    const resetButton = await page.waitForFunction(findResetButton)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      resetButton.evaluate((host) => host.shadowRoot.querySelector('button').click()),
    ])
    await page.waitForFunction(widgetReady)
    const afterReset = await page.evaluate(() => ({
      primary: getComputedStyle(document.documentElement).getPropertyValue('--imp-color-primary')
        .trim(),
      draftKeys: Object.keys(localStorage).filter((key) => key.startsWith('imp.theme-draft.'))
        .length,
    }))
    const report = [
      `primary before editing: ${edited.before}`,
      `actions: ${edited.actions}`,
      `view after Theme editor: ${edited.view} (aria-pressed ${edited.pressed})`,
      `panel background: ${edited.panel}`,
      `editor mounted in the panel: ${edited.editor}`,
      `knobs in the panel: ${edited.knobs}`,
      `tokens editor shows: ${edited.json}`,
      `after editing the JSON: surface ${edited.jsonSurface}, primary ${edited.jsonPrimary}`,
      `surface while the JSON is broken: ${edited.jsonBroken}`,
      `draft stored under: ${edited.draftKeys}`,
      `editor removed when closed: ${edited.closed === 0}`,
      `primary after a reload: ${afterReload}`,
      `primary after reset: ${afterReset.primary}, drafts left: ${afterReset.draftKeys}`,
    ].join('\n')
    await assertSnapshot('start-theme-editor-widget', report + '\n')
  } finally {
    await browser.close().catch(() => {})
    await server.stop()
    await Deno.remove(dir, { recursive: true })
  }
})
