import { expect, test } from 'imp/test'

const PANELS = {
  datePicker: {
    trigger: '#panels-date imp-date-picker >>> .trigger',
    panel: '#panels-date imp-date-picker >>> .panel',
    open: (page) => page.click('#panels-date imp-date-picker >>> .trigger'),
  },
  comboBox: {
    trigger: '#panels-combo imp-combo-box >>> .frame',
    panel: '#panels-combo imp-combo-box >>> .panel',
    open: async (page) => {
      await page.click('#panels-combo imp-combo-box >>> #control')
      await page.keyboard.press('ArrowDown')
    },
  },
}

const boxOf = (page, selector) =>
  page.$eval(selector, (node) => {
    const { top, bottom, left, right } = node.getBoundingClientRect()
    return { top, bottom, left, right }
  })

const viewport = (page) =>
  page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  }))

const pinTo = (page, id, [block, inline]) =>
  page.$eval(`#${id}`, (node, [blockEdge, inlineEdge]) => {
    node.style.position = 'fixed'
    node.style.zIndex = '10'
    node.style.inlineSize = '16rem'
    node.style.insetBlockStart = blockEdge === 'start' ? '8px' : 'auto'
    node.style.insetBlockEnd = blockEdge === 'end' ? '8px' : 'auto'
    node.style.insetInlineStart = inlineEdge === 'start' ? '8px' : 'auto'
    node.style.insetInlineEnd = inlineEdge === 'end' ? '8px' : 'auto'
  }, [block, inline])

const settled = (page, selector) =>
  page.$eval(
    selector,
    async (node) => void await Promise.all(node.getAnimations().map(({ finished }) => finished)),
  )

const CORNERS = [
  ['start', 'start'],
  ['start', 'end'],
  ['end', 'start'],
  ['end', 'end'],
]

for (const [name, { trigger, panel, open }] of Object.entries(PANELS)) {
  const id = name === 'datePicker' ? 'panels-date' : 'panels-combo'
  for (const corner of CORNERS) {
    test(`the panel of ${name} opens inwards from a trigger in the ${corner.join('-')} corner`, async ({ page }) => {
      await page.setViewport({ width: 900, height: 700 })
      await pinTo(page, id, corner)
      await open(page)
      await page.waitForSelector(`${panel}:popover-open`)
      await settled(page, panel)
      const anchor = await boxOf(page, trigger)
      const shown = await boxOf(page, panel)
      const screen = await viewport(page)
      if (corner[0] === 'start') expect(shown.top >= anchor.bottom - 1).toBeTruthy()
      else expect(shown.bottom <= anchor.top + 1).toBeTruthy()
      expect(shown.left >= 0 && shown.right <= screen.width).toBeTruthy()
      expect(shown.top >= 0 && shown.bottom <= screen.height).toBeTruthy()
      await page.keyboard.press('Escape')
    })
  }
}

test('a panel taller than the room on either side takes the larger side and scrolls', async ({ page }) => {
  await page.setViewport({ width: 900, height: 260 })
  await page.$eval('#panels-date', (node) => {
    node.style.position = 'fixed'
    node.style.zIndex = '10'
    node.style.inlineSize = '16rem'
    node.style.insetInlineStart = '8px'
    node.style.insetBlockStart = '150px'
  })
  await PANELS.datePicker.open(page)
  await page.waitForSelector(`${PANELS.datePicker.panel}:popover-open`)
  await settled(page, PANELS.datePicker.panel)
  const anchor = await boxOf(page, PANELS.datePicker.trigger)
  const shown = await boxOf(page, PANELS.datePicker.panel)
  expect(shown.bottom <= anchor.top + 1).toBeTruthy()
  expect(shown.top >= 0).toBeTruthy()
  const scrolls = await page.$eval(
    PANELS.datePicker.panel,
    (node) => node.scrollHeight > node.clientHeight,
  )
  expect(scrolls).toEqual(true)
  await page.keyboard.press('Escape')
})

const TAB_PANELS = {
  datePicker: {
    panel: '#panels-date imp-date-picker >>> .panel',
    open: (page) => page.click('#panels-date imp-date-picker >>> .trigger'),
  },
  emojiPicker: {
    panel: '#catalog-emoji imp-emoji-picker >>> .panel',
    open: (page) => page.click('#catalog-emoji imp-emoji-picker >>> .trigger'),
  },
  richTextEditor: {
    panel: '#rich imp-rich-text-editor >>> .panel-link',
    open: (page) => page.click('#rich imp-rich-text-editor >>> .tool-link'),
  },
}

const isOpen = (page, selector) => page.$eval(selector, (node) => node.matches(':popover-open'))

const holdsFocus = (page, selector) => page.$eval(selector, (node) => node.matches(':focus-within'))

for (const [name, { panel, open }] of Object.entries(TAB_PANELS)) {
  test(`the panel of ${name} closes when Tab moves the focus out of it`, async ({ page }) => {
    await open(page)
    await page.waitForSelector(`${panel}:popover-open:focus-within`)
    for (let step = 0; step < 60 && await holdsFocus(page, panel); step++) {
      await page.keyboard.press('Tab')
    }
    expect(await holdsFocus(page, panel)).toEqual(false)
    expect(await isOpen(page, panel)).toEqual(false)
  })
}

const NARROW = (name) => `narrow-showcase >>> .narrow-case[data-name='${name}']`

const ESCAPE_PANELS = {
  datePicker: '#panels-date imp-date-picker',
  emojiPicker: '#catalog-emoji imp-emoji-picker',
  treeSelect: `${NARROW('tree-select')} imp-tree-select`,
  dateRangePicker: `${NARROW('date-range-picker')} imp-date-range-picker`,
}

const matchesSoon = async (page, selector, state) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await page.$eval(selector, (node, wanted) => node.matches(wanted), state)) return true
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return false
}

for (const [name, host] of Object.entries(ESCAPE_PANELS)) {
  test(`Escape closes the panel of ${name} and gives the focus back to its trigger`, async ({ page }) => {
    await page.focus(`${host} >>> .trigger`)
    await page.keyboard.press('Enter')
    expect(await matchesSoon(page, `${host} >>> .panel`, ':popover-open:focus-within')).toEqual(
      true,
    )
    await page.keyboard.press('Escape')
    expect(await matchesSoon(page, `${host} >>> .trigger`, ':focus')).toEqual(true)
    expect(await isOpen(page, `${host} >>> .panel`)).toEqual(false)
  })
}
