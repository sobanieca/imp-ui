import { expect, test } from 'imp/test'

const treeOf = async (page, selector) => {
  const root = await page.$(selector)
  return await page.accessibility.snapshot({ root, interestingOnly: false })
}

const walk = (node, visit) => {
  if (!node) return
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

const collect = (tree, predicate) => {
  const found = []
  walk(tree, (node) => {
    if (predicate(node)) found.push(node)
  })
  return found
}

const first = (tree, predicate) => collect(tree, predicate)[0] ?? null

const byRole = (role) => (node) => node.role === role

const NAMED_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'combobox',
  'switch',
  'slider',
  'spinbutton',
  'tab',
  'menuitem',
  'treeitem',
  'option',
  'progressbar',
  'tree',
  'table',
  'navigation',
])

const SHOWCASES = ['#std', '#forms', '#shell', '#rail', '#a11y', '#image']

test('every control of a standard component carries an accessible name', async ({ page }) => {
  const unnamed = []
  for (const showcase of SHOWCASES) {
    const tree = await treeOf(page, showcase)
    for (const node of collect(tree, (node) => NAMED_ROLES.has(node.role))) {
      if (!node.name) unnamed.push(`${node.role} in ${showcase}`)
    }
  }
  expect(unnamed).toEqual([])
})

test('every control of a showcase has a role and an accessible name', async ({ page }) => {
  for (const showcase of SHOWCASES) {
    await expect(await page.$(showcase)).toHaveAccessibleControls()
  }
})

test('the accessibility matcher names each control with no name or no role', async ({ page }) => {
  await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.id = 'a11y-probe'
    probe.innerHTML = '<button class="bare"></button><div class="card" tabindex="0">Open</div>' +
      '<div role="button" tabindex="0">Named</div><button>Named</button>'
    document.body.append(probe)
  })
  const probe = await page.$('#a11y-probe')
  await expect(probe).not.toHaveAccessibleControls()
  const message = await expect(probe).toHaveAccessibleControls().then(
    () => '',
    (error) => error.message,
  )
  expect(message.split('\n')).toEqual([
    'expect(page).toHaveAccessibleControls()',
    '  button with no accessible name: button.bare',
    '  focusable element with no role: div.card',
  ])
  await page.evaluate(() => document.querySelector('#a11y-probe').remove())
})

test('an icon-only button is named by its label, and the tooltip stays out of the tree', async ({ page }) => {
  const tree = await treeOf(page, '#a11y-delete')
  expect(first(tree, byRole('button'))?.name).toEqual('Delete')
  expect(collect(tree, byRole('tooltip'))).toEqual([])
  expect(collect(tree, byRole('image'))).toEqual([])
})

test('a menu button with text is named by that text', async ({ page }) => {
  const button = first(await treeOf(page, '#a11y-text-menu'), byRole('button'))
  expect(button?.name).toEqual('Actions')
  expect(button?.haspopup).toEqual('menu')
})

test('a chart speaks the readout of the focused category through a status region', async ({ page }) => {
  await page.focus('#a11y-chart imp-chart >>> .plot')
  await page.keyboard.press('ArrowRight')
  const status = first(await treeOf(page, '#a11y-chart'), byRole('status'))
  const spoken = collect(status, byRole('StaticText')).map(({ name }) => name).join(' ')
  expect(spoken).toContain('Q2')
  expect(spoken).toContain('Product')
  await page.keyboard.press('Escape')
})

test('a loading button is disabled and busy', async ({ page }) => {
  const control = '#a11y-loading imp-button >>> button'
  expect(await page.$eval(control, (node) => node.getAttribute('aria-busy'))).toEqual('true')
  expect(first(await treeOf(page, '#a11y-loading'), byRole('button'))?.disabled).toEqual(true)
})

test('tabs expose a named tablist, a selected tab, a labelled panel and one tab stop', async ({ page }) => {
  const tree = await treeOf(page, '#a11y-tabs')
  expect(first(tree, byRole('tablist'))?.name).toEqual('Sections')
  const tabs = collect(tree, byRole('tab'))
  expect(tabs.map(({ name }) => name)).toEqual(['One', 'Two', 'Three', 'Four'])
  expect(tabs.map(({ selected }) => selected ?? false)).toEqual([true, false, false, false])
  expect(tabs[2].disabled).toEqual(true)
  expect(first(tree, byRole('tabpanel'))?.name).toEqual('One')
  const stops = await page.$$eval(
    '#a11y-tabs imp-tabs >>> .tab',
    (nodes) => nodes.map((node) => node.tabIndex),
  )
  expect(stops).toEqual([0, -1, -1, -1])
})

test('a radio group is announced as one named group of native radios', async ({ page }) => {
  const tree = await treeOf(page, '#a11y-radios')
  expect(first(tree, byRole('group'))?.name).toEqual('Size')
  const radios = collect(tree, byRole('radio'))
  expect(radios.map(({ name }) => name)).toEqual(['small', 'medium', 'large'])
  expect(radios.map(({ checked }) => checked)).toEqual([false, true, false])
})

test('a toggle is a switch whose checked state follows a key press', async ({ page }) => {
  const control = '#a11y-toggle imp-toggle >>> #control'
  expect(first(await treeOf(page, '#a11y-toggle'), byRole('switch'))?.name).toEqual('Alerts')
  expect(first(await treeOf(page, '#a11y-toggle'), byRole('switch'))?.checked).toEqual(false)
  await page.focus(control)
  await page.keyboard.press('Space')
  expect(first(await treeOf(page, '#a11y-toggle'), byRole('switch'))?.checked).toEqual(true)
})

test('a slider is a native range that the arrow keys move', async ({ page }) => {
  const control = '#a11y-slider imp-slider >>> #control'
  const slider = first(await treeOf(page, '#a11y-slider'), byRole('slider'))
  expect(slider?.name).toEqual('Volume')
  expect(slider?.value).toEqual(40)
  await page.focus(control)
  await page.keyboard.press('ArrowRight')
  expect(first(await treeOf(page, '#a11y-slider'), byRole('slider'))?.value).toEqual(50)
})

test('a colour picker is a named textbox with a named swatch that types commit', async ({ page }) => {
  const textbox = first(await treeOf(page, '#a11y-color'), byRole('textbox'))
  expect(textbox?.name).toEqual('Ink')
  expect(textbox?.value).toEqual('#3b6fe0')
  const swatch = '#a11y-color imp-color-picker >>> .swatch'
  expect(await page.$eval(swatch, (node) => node.getAttribute('aria-label'))).toEqual('Pick Ink')
  await page.focus('#a11y-color imp-color-picker >>> #control')
  await page.keyboard.press('End')
  await page.keyboard.press('Backspace')
  await page.keyboard.type('1')
  expect(await page.$eval(swatch, (node) => node.value)).toEqual('#3b6fe1')
})

test('a progress bar reports its name, its range and its value', async ({ page }) => {
  const bar = first(await treeOf(page, '#a11y-progress'), byRole('progressbar'))
  expect(bar?.name).toEqual('Upload')
  expect(bar?.value).toEqual(40)
  expect(bar?.valuemin).toEqual(0)
  expect(bar?.valuemax).toEqual(100)
})

test('a notice is an alert for an error and a status for the rest', async ({ page }) => {
  const tree = await treeOf(page, '#a11y-notices')
  const alerts = collect(tree, byRole('alert'))
  const statuses = collect(tree, byRole('status'))
  expect(alerts.length).toEqual(1)
  expect(statuses.length).toEqual(1)
  const textsOf = (node) => collect(node, byRole('StaticText')).map(({ name }) => name)
  expect(textsOf(alerts[0])).toContain('Could not save')
  expect(textsOf(statuses[0])).toContain('Saved')
})

test('a toast lands in a live region that exists before the message', async ({ page }) => {
  const alert = '#a11y-toast imp-toast >>> [role="alert"]'
  expect(await page.$eval(alert, (node) => node.textContent)).toEqual('')
  await page.click('#a11y-toast #a11y-notify')
  await page.waitForFunction(
    (selector) => {
      const showcase = document.querySelector('accessibility-showcase').shadowRoot
      const region = showcase.querySelector('imp-toast').shadowRoot.querySelector(selector)
      return region.textContent.includes('Disk is full')
    },
    {},
    '[role="alert"]',
  )
  const tree = await treeOf(page, '#a11y-toast')
  expect(first(tree, byRole('group'))?.name).toEqual('Disk is full')
})

test('a sortable column header holds a real button and reports the sort', async ({ page }) => {
  const header = '#a11y-table imp-table >>> th:nth-of-type(1)'
  const sortButton = `${header} button`
  expect(await page.$eval(header, (node) => node.getAttribute('aria-sort'))).toEqual(null)
  expect(first(await treeOf(page, '#a11y-table'), byRole('button'))?.name).toEqual('Number')
  await page.click(sortButton)
  expect(await page.$eval(header, (node) => node.getAttribute('aria-sort'))).toEqual('ascending')
  await page.click(sortButton)
  expect(await page.$eval(header, (node) => node.getAttribute('aria-sort'))).toEqual('descending')
})

test('a required field reports its error through its description', async ({ page }) => {
  const control = '#forms imp-form >>> imp-text-field >>> #control'
  await page.click(control, { clickCount: 3 })
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Tab')
  expect(await page.$eval(control, (node) => node.getAttribute('aria-invalid'))).toEqual('true')
  const described = await page.$eval(control, (node) => {
    const ids = node.getAttribute('aria-describedby').split(' ')
    return ids.map((id) => node.getRootNode().getElementById(id).textContent).join(' ')
  })
  expect(described).toContain('This field is required')
  const field = first(await treeOf(page, '#forms'), byRole('textbox'))
  expect(field?.name).toEqual('First name')
  expect(field?.invalid).toEqual('true')
  expect(field?.description).toContain('This field is required')
})

test('the shell exposes named navigation landmarks and a main region', async ({ page }) => {
  const tree = await treeOf(page, '#shell')
  expect(first(tree, byRole('link'))?.name).toEqual('Skip to the content')
  const navigations = collect(tree, byRole('navigation')).map(({ name }) => name)
  expect(navigations).toContain('Sections')
  expect(navigations).toContain('Filters')
  expect(collect(tree, byRole('main')).length).toEqual(1)
  const current = await page.$$eval(
    '#shell imp-shell >>> [aria-current="page"]',
    (nodes) => nodes.map((node) => node.textContent.trim()),
  )
  expect(current).toContain('One')
})

const outlineOf = (page, selector) =>
  page.$eval(selector, (node) => {
    const style = getComputedStyle(node)
    return {
      visible: node.matches(':focus-visible'),
      width: parseFloat(style.outlineWidth),
      style: style.outlineStyle,
    }
  })

test('keyboard focus draws the ring, and pointer focus does not', async ({ page }) => {
  const control = '#a11y-delete imp-tooltip >>> imp-button >>> button'
  await page.click(control)
  const afterClick = await outlineOf(page, control)
  expect(afterClick.visible).toEqual(false)
  expect(afterClick.width === 0 || afterClick.style === 'none').toEqual(true)

  await page.click('#a11y-before #a11y-start')
  await page.keyboard.press('Tab')
  const afterTab = await outlineOf(page, control)
  expect(afterTab.visible).toEqual(true)
  expect(afterTab.style).toEqual('solid')
  expect(afterTab.width > 0).toEqual(true)
})

test('reduced motion turns the overlay transition off', async ({ page }) => {
  const panel = '#modal imp-dialog >>> .panel'
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.click('#dialogs #open-modal')
  const motion = await page.$eval(panel, (node) => ({
    duration: getComputedStyle(node).transitionDuration,
    running: node.getAnimations().length,
  }))
  expect(motion.duration).toEqual('0s')
  expect(motion.running).toEqual(0)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => {
    const frame = document.querySelector('dialog-showcase').shadowRoot
    return frame.querySelector('#modal imp-dialog').shadowRoot.querySelector('.panel').open ===
      false
  })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
})

const forcedColors = (page, value) =>
  page._client().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'forced-colors', value }],
  })

test('forced colors keep a border on a control and a ring on the focus', async ({ page }) => {
  await forcedColors(page, 'active')
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toEqual(true)
  const control = '#forms imp-form >>> imp-text-field >>> #control'
  const borders = await page.$eval(control, (node) => {
    const style = getComputedStyle(node)
    return { width: parseFloat(style.borderTopWidth), style: style.borderTopStyle }
  })
  expect(borders.style).toEqual('solid')
  expect(borders.width > 0).toEqual(true)
  await page.click('#a11y-before #a11y-start')
  await page.keyboard.press('Tab')
  const ring = await outlineOf(page, '#a11y-delete imp-tooltip >>> imp-button >>> button')
  expect(ring.visible).toEqual(true)
  expect(ring.width > 0).toEqual(true)
  await forcedColors(page, 'none')
})
