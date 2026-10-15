import { expect, test } from 'imp/test'

const focused = (page) =>
  page.evaluate(() => {
    let active = document.activeElement
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
    const labelledBy = active?.getAttribute('aria-labelledby')
    const label = labelledBy ? active.getRootNode().getElementById(labelledBy) : active
    return {
      tag: active?.localName ?? null,
      type: active?.getAttribute('type') ?? '',
      id: active?.id ?? '',
      role: active?.getAttribute('role') ?? '',
      text: label?.textContent.trim() ?? '',
    }
  })

const opened = (page, showcase, host, open) =>
  page.waitForFunction(
    ([showcaseName, hostSelector, state]) => {
      const frame = document.querySelector(showcaseName).shadowRoot
      return frame.querySelector(hostSelector).shadowRoot.querySelector('.panel').open === state
    },
    {},
    [showcase, host, open],
  )

const focusedRole = (page, role) =>
  page.waitForFunction(
    (wanted) => {
      let active = document.activeElement
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
      return active?.getAttribute('role') === wanted
    },
    {},
    role,
  )

const attributeOf = (page, selector, name) =>
  page.$eval(selector, (node, attribute) => node.getAttribute(attribute), name)

const settled = (page, selector) =>
  page.$eval(
    selector,
    async (node) => void (await Promise.all(node.getAnimations().map(({ finished }) => finished))),
  )

const TAB = '#a11y-tabs imp-tabs >>> .tab'

const selectedTabs = (page, tabs = TAB) =>
  page.$$eval(tabs, (nodes) => nodes.map((node) => node.getAttribute('aria-selected')))

test('the arrow keys move the tab selection with the focus, and skip a disabled tab', async ({
  page,
}) => {
  await page.focus(TAB)
  await page.keyboard.press('ArrowRight')
  expect(await selectedTabs(page)).toEqual(['false', 'true', 'false', 'false'])
  expect((await focused(page)).text).toEqual('Two')
  await page.keyboard.press('ArrowRight')
  expect(await selectedTabs(page)).toEqual(['false', 'false', 'false', 'true'])
  await page.keyboard.press('ArrowRight')
  expect(await selectedTabs(page)).toEqual(['true', 'false', 'false', 'false'])
  await page.keyboard.press('End')
  expect((await focused(page)).text).toEqual('Four')
  await page.keyboard.press('Home')
  expect((await focused(page)).text).toEqual('One')
})

test('Tab leaves the strip for the panel, and then for the control inside it', async ({ page }) => {
  await page.focus(TAB)
  await page.keyboard.press('Tab')
  expect((await focused(page)).role).toEqual('tabpanel')
  await page.keyboard.press('Tab')
  expect((await focused(page)).id).toEqual('Sections-inside')
})

test('the arrow keys mirror under rtl', async ({ page }) => {
  const mirrored = '#a11y-tabs-rtl imp-tabs >>> .tab'
  await page.focus(mirrored)
  await page.keyboard.press('ArrowLeft')
  expect(await selectedTabs(page, mirrored)).toEqual(['false', 'true', 'false', 'false'])
  await page.keyboard.press('ArrowRight')
  expect(await selectedTabs(page, mirrored)).toEqual(['true', 'false', 'false', 'false'])
})

test('a radio group is one tab stop, and the arrow keys move the choice', async ({ page }) => {
  const radios = '#a11y-radios imp-radio-group >>> input[type="radio"]'
  const checked = () => page.$$eval(radios, (nodes) => nodes.map((node) => node.checked))
  await page.focus(`${radios}:checked`)
  await page.keyboard.press('ArrowDown')
  expect(await checked()).toEqual([false, false, true])
  await page.keyboard.press('ArrowUp')
  expect(await checked()).toEqual([false, true, false])
  await page.keyboard.press('Tab')
  expect((await focused(page)).type).not.toEqual('radio')
})

test('a combo box opens on a key, tracks the active option, and closes on Escape', async ({
  page,
}) => {
  const control = '#a11y-combo imp-combo-box >>> #control'
  const options = '#a11y-combo imp-combo-box >>> [role="option"]'
  await page.focus(control)
  expect(await attributeOf(page, control, 'aria-expanded')).toEqual('false')
  await page.keyboard.press('ArrowDown')
  expect(await attributeOf(page, control, 'aria-expanded')).toEqual('true')
  const ids = await page.$$eval(options, (nodes) => nodes.map((node) => node.id))
  expect(await attributeOf(page, control, 'aria-activedescendant')).toEqual(ids[0])
  await page.keyboard.press('ArrowDown')
  expect(await attributeOf(page, control, 'aria-activedescendant')).toEqual(ids[1])
  await page.keyboard.press('Enter')
  expect(await page.$eval(control, (node) => node.value)).toEqual('Poland')
  expect(await attributeOf(page, control, 'aria-expanded')).toEqual('false')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  expect(await attributeOf(page, control, 'aria-expanded')).toEqual('false')
  expect(await attributeOf(page, control, 'aria-activedescendant')).toEqual(null)
  expect((await focused(page)).id).toEqual('control')
})

const TREE_ITEM = '#a11y-tree imp-tree >>> [role="treeitem"]'

test('a tree has one tab stop, and the arrow keys expand, descend, ascend and collapse', async ({
  page,
}) => {
  const stops = () => page.$$eval(TREE_ITEM, (nodes) => nodes.map((node) => node.tabIndex))
  expect((await stops()).filter((stop) => stop === 0).length).toEqual(1)
  await page.focus(`${TREE_ITEM}[tabindex="0"]`)
  expect(await attributeOf(page, TREE_ITEM, 'aria-expanded')).toEqual('false')
  await page.keyboard.press('ArrowRight')
  expect(await attributeOf(page, TREE_ITEM, 'aria-expanded')).toEqual('true')
  await page.keyboard.press('ArrowRight')
  expect((await focused(page)).text).toEqual('main.js')
  await page.keyboard.press('ArrowDown')
  expect((await focused(page)).text).toEqual('util.js')
  await page.keyboard.press('ArrowLeft')
  expect((await focused(page)).text).toEqual('src')
  await page.keyboard.press('ArrowLeft')
  expect(await attributeOf(page, TREE_ITEM, 'aria-expanded')).toEqual('false')
  await page.keyboard.press('Enter')
  expect(await attributeOf(page, TREE_ITEM, 'aria-selected')).toEqual('true')
  expect((await stops()).filter((stop) => stop === 0).length).toEqual(1)
})

test('an accordion row is a native disclosure that Enter opens, and one open row closes the other', async ({
  page,
}) => {
  const details = '#a11y-accordion imp-accordion >>> details'
  const openState = () => page.$$eval(details, (nodes) => nodes.map((node) => node.open))
  expect(await openState()).toEqual([false, false])
  await page.focus(`${details} summary`)
  await page.keyboard.press('Enter')
  expect(await openState()).toEqual([true, false])
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  expect(await openState()).toEqual([false, true])
})

const MENU_TRIGGER = '#std-menu imp-flex >>> imp-menu-button >>> .trigger >>> .button'

test('a menu opens from the keyboard, the arrows walk its items, and Escape returns the focus', async ({
  page,
}) => {
  await page.focus(MENU_TRIGGER)
  expect(await attributeOf(page, MENU_TRIGGER, 'aria-haspopup')).toEqual('menu')
  await page.keyboard.press('Enter')
  expect(await attributeOf(page, MENU_TRIGGER, 'aria-expanded')).toEqual('true')
  await focusedRole(page, 'menuitem')
  expect(await focused(page)).toEqual(expect.objectContaining({ role: 'menuitem', text: 'copy' }))
  await page.keyboard.press('ArrowDown')
  expect((await focused(page)).text).toEqual('rename')
  await page.keyboard.press('End')
  expect((await focused(page)).text).toEqual('archive')
  await page.keyboard.press('ArrowDown')
  expect((await focused(page)).text).toEqual('copy')
  await page.keyboard.press('Escape')
  expect(await attributeOf(page, MENU_TRIGGER, 'aria-expanded')).toEqual('false')
  await page.waitForSelector(`${MENU_TRIGGER}:focus`)
  expect((await focused(page)).text).toEqual(
    (await page.$eval(MENU_TRIGGER, (n) => n.textContent)).trim(),
  )
})

const MODAL = '#modal imp-dialog >>> .panel'

const insideOf = (page, selector) =>
  page.$eval(selector, (node) => node.contains(node.getRootNode().activeElement))

test('a modal dialog takes the focus, keeps Tab inside, and gives the focus back on Escape', async ({
  page,
}) => {
  await page.focus('#dialogs #open-modal')
  await page.keyboard.press('Enter')
  await opened(page, 'dialog-showcase', '#modal imp-dialog', true)
  expect(await insideOf(page, MODAL)).toEqual(true)
  expect((await focused(page)).role).toEqual('')
  const visited = new Set()
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press('Tab')
    const active = await focused(page)
    if (active.tag === 'body') continue
    expect(await insideOf(page, MODAL)).toEqual(true)
    visited.add(active.id)
  }
  expect([...visited].sort()).toEqual(['', 'modal-field'])
  await page.keyboard.press('Escape')
  await opened(page, 'dialog-showcase', '#modal imp-dialog', false)
  expect((await focused(page)).id).toEqual('open-modal')
})

const DRAWER = '#end imp-drawer >>> .panel'

test('a drawer takes the focus and gives it back to its opener', async ({ page }) => {
  await page.focus('#drawers #open-end')
  await page.keyboard.press('Enter')
  await opened(page, 'drawer-showcase', '#end imp-drawer', true)
  await settled(page, DRAWER)
  expect(await insideOf(page, DRAWER)).toEqual(true)
  await page.focus('#end imp-drawer >>> .close')
  await page.keyboard.press('Enter')
  await opened(page, 'drawer-showcase', '#end imp-drawer', false)
  expect((await focused(page)).id).toEqual('open-end')
})

test('a failed submit moves the focus to the first invalid field', async ({ page }) => {
  const submit = '#forms imp-form >>> imp-button >>> button'
  await page.click(submit)
  const active = await focused(page)
  expect(active.type).toEqual('checkbox')
  expect(
    await page.$eval('#forms imp-form >>> imp-checkbox >>> #control', (node) =>
      node.matches(':focus'),
    ),
  ).toEqual(true)
})

test('the skip link of the shell is the first tab stop and moves the focus to the content', async ({
  page,
}) => {
  const skip = '#shell imp-shell >>> .skip'
  const shown = () =>
    page.$eval(skip, (node) => {
      const { width, height } = node.getBoundingClientRect()
      return width > 1 && height > 1
    })
  await page.focus(skip)
  expect(await page.$eval(skip, (node) => node.matches(':focus'))).toEqual(true)
  expect(await shown()).toEqual(false)
  await page.keyboard.press('Tab')
  await page.keyboard.down('Shift')
  await page.keyboard.press('Tab')
  await page.keyboard.up('Shift')
  expect(await page.$eval(skip, (node) => node.matches(':focus-visible'))).toEqual(true)
  expect(await shown()).toEqual(true)
  await page.keyboard.press('Enter')
  expect(await page.$eval('#shell imp-shell >>> .main', (node) => node.matches(':focus'))).toEqual(
    true,
  )
})

test('a non-modal dialog takes the focus, and can be moved from the keyboard', async ({ page }) => {
  const WINDOW = '#window imp-dialog >>> .panel'
  const bar = '#window imp-dialog >>> .bar'
  await page.click('#dialogs #open-window')
  await settled(page, WINDOW)
  await page.waitForFunction(() => {
    const frame = document.querySelector('dialog-showcase').shadowRoot
    return frame
      .querySelector('#window imp-dialog')
      .shadowRoot.querySelector('.panel')
      .matches(':popover-open')
  })
  expect(await page.$eval(WINDOW, (node) => node.matches(':focus'))).toEqual(true)
  const before = await page.$eval(WINDOW, (node) => node.getBoundingClientRect().left)
  await page.focus(bar)
  await page.keyboard.press('ArrowRight')
  const after = await page.$eval(WINDOW, (node) => node.getBoundingClientRect().left)
  expect(after > before).toEqual(true)
})

test('the week view of calendar makes a slot at a chosen time from the keyboard', async ({
  page,
}) => {
  const host = '#geometry-ltr .geometry-calendar imp-calendar'
  await page.$eval(host, (node) => {
    globalThis.__impSlots = []
    node.addEventListener('slotSelect', (event) => globalThis.__impSlots.push(event.detail))
    const segments = node.shadowRoot.querySelector('imp-segmented').shadowRoot
    const week = [...segments.querySelectorAll('.segment')].find((segment) =>
      segment.textContent.includes('Week'),
    )
    week.click()
  })
  await page.waitForSelector(`${host} >>> .slot[tabindex="0"]`)
  await page.focus(`${host} >>> .slot[tabindex="0"]`)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  const slot = await page.evaluate(() => {
    let active = document.activeElement
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
    return { key: active.dataset.key, label: active.getAttribute('aria-label') }
  })
  expect(slot.key).toEqual('slot:2026-09-22T08:00')
  expect(slot.label).toContain('8:00')
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => globalThis.__impSlots)).toEqual([
    { start: '2026-09-22T08:00', end: '2026-09-22T09:00', allDay: false },
  ])
})
