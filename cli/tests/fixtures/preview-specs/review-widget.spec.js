import { test } from 'imp/test'
import { base } from './server.js'

test('the review widget picks an element in the preview page', async ({ page: host }) => {
  const browser = host.browser()
  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  await page.setViewport({ width: 900, height: 700 })
  await page.goto(
    `${base}/widgets/counter`,
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
  console.log(`IMP-REPORT-BEGIN\n${JSON.stringify(flow)}\nIMP-REPORT-END`)
  await page.close()
}, { timeout: 120000 })
