import { test } from 'imp/test'
import { base } from './server.js'

test('the review widget edits the applied theme of an app', async ({ page: host }) => {
  const browser = host.browser()
  const widgetReady = () => document.getElementById('imp-review')?.shadowRoot
  const primaryToken = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--imp-color-primary').trim()
  const page = await browser.newPage()
  await page.setViewport({ width: 900, height: 700 })
  await page.goto(`${base}/`, { waitUntil: 'load' })
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
    const deepFind = (root, tag) => {
      for (const element of root.querySelectorAll('*')) {
        if (element.localName === tag) return element
        const found = element.shadowRoot ? deepFind(element.shadowRoot, tag) : null
        if (found) return found
      }
      return null
    }
    const card = shadow.querySelector('.card')
    steps.themeRow = deepFind(card, 'imp-segmented') ? 'shown' : 'none'
    walkKnobs(deepFind(card, 'imp-theme-editor').shadowRoot)
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
    `row of the themes to edit: ${edited.themeRow}`,
    `knobs in the editor: ${edited.knobs}`,
    `tokens editor shows: ${edited.json}`,
    `after editing the JSON: surface ${edited.jsonSurface}, primary ${edited.jsonPrimary}`,
    `surface while the JSON is broken: ${edited.jsonBroken}`,
    `draft stored under: ${edited.draftKeys}`,
    `editor removed when closed: ${edited.closed === 0}`,
    `primary after a reload: ${afterReload}`,
    `primary after reset: ${afterReset.primary}, drafts left: ${afterReset.draftKeys}`,
  ].join('\n')
  console.log(`IMP-REPORT-BEGIN\n${report}\nIMP-REPORT-END`)
  await page.close()
}, { timeout: 120000 })
