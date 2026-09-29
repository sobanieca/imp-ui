import { expect, test } from 'imp/test'

const edgesOf = (page, selector) =>
  page.$eval(selector, (node) => {
    const { left, right } = node.getBoundingClientRect()
    return { left, right }
  })

test('a flex row mirrors its children under dir="rtl"', async ({ page }) => {
  const ltrFirst = await edgesOf(page, '#ltr-row imp-flex >>> #ltr-first')
  const ltrSecond = await edgesOf(page, '#ltr-row imp-flex >>> #ltr-second')
  expect(ltrFirst.left < ltrSecond.left).toBeTruthy()

  const rtlFirst = await edgesOf(page, '#rtl-row imp-flex >>> #rtl-first')
  const rtlSecond = await edgesOf(page, '#rtl-row imp-flex >>> #rtl-second')
  expect(rtlFirst.left > rtlSecond.left).toBeTruthy()
})

test("a stack aligned 'start' follows the reading direction", async ({ page }) => {
  const ltrContainer = await edgesOf(page, '#ltr-stack')
  const ltrStacked = await edgesOf(page, '#ltr-stack imp-stack >>> #ltr-stacked')
  expect(ltrStacked.left - ltrContainer.left < 1).toBeTruthy()
  expect(ltrContainer.right - ltrStacked.right > 1).toBeTruthy()

  const rtlContainer = await edgesOf(page, '#rtl-stack')
  const rtlStacked = await edgesOf(page, '#rtl-stack imp-stack >>> #rtl-stacked')
  expect(rtlContainer.right - rtlStacked.right < 1).toBeTruthy()
  expect(rtlStacked.left - rtlContainer.left > 1).toBeTruthy()
})

const settled = (page, selector) =>
  page.$eval(
    selector,
    async (node) => void await Promise.all(node.getAnimations().map(({ finished }) => finished)),
  )

const parentClassOf = (page, selector) =>
  page.$eval(selector, (node) => node.parentElement.className)

const topOf = (page, selector) => page.$eval(selector, (node) => node.getBoundingClientRect().top)

const visible = (page, selector) => page.$eval(selector, (node) => node.checkVisibility())

const drawer = '#shell imp-shell >>> .drawer'
const barNav = '#shell imp-shell >>> .bar-nav'
const bottomBar = '#shell imp-shell >>> .bottombar'
const sidebar = '#shell imp-shell >>> .sidebar'
const tools = '#shell imp-shell >>> .tools'
const main = '#shell imp-shell >>> .main'
const sideExtras = '#shell imp-shell >>> .extras'
const footerRows = '#shell imp-shell >>> ul.footer'

test('the navbar drawer slides in from the inline start and holds focus', async ({ page }) => {
  await page.setViewport({ width: 420, height: 720 })

  expect(
    await page.$eval(drawer, (node) => getComputedStyle(node).getPropertyValue('--overlay-offset')),
  ).toEqual('-100% 0')

  await page.click('#shell imp-shell >>> .hamburger')
  await settled(page, drawer)
  expect(Math.round((await edgesOf(page, drawer)).left)).toEqual(0)
  expect(await parentClassOf(page, barNav)).toEqual('drawer-nav')
  expect(await parentClassOf(page, tools)).toEqual('drawer-tools')
  expect(await parentClassOf(page, sideExtras)).toEqual('drawer-tools')
  expect(await parentClassOf(page, footerRows)).toEqual('drawer-foot')
  expect(
    await page.$eval(sideExtras, (node) => node.nextElementSibling?.className ?? null),
  ).toEqual('tools')

  await page.keyboard.press('Escape')
  expect(await page.$eval(drawer, (node) => node.open)).toEqual(true)

  await settled(page, drawer)
  await page.waitForFunction(() => {
    const frame = document.querySelector('shell-showcase')?.shadowRoot?.querySelector('imp-shell')
    return frame?.shadowRoot?.querySelector('.drawer')?.open === false
  })
  expect(await page.$eval('#shell imp-shell >>> .hamburger', (node) => node.matches(':focus')))
    .toEqual(true)

  await page.setViewport({ width: 800, height: 600 })
})

test('mount zeroes the body margin, and an app stylesheet still wins', async ({ page }) => {
  expect(await page.evaluate(() => getComputedStyle(document.body).marginBlockStart))
    .toEqual('0px')

  const restored = await page.evaluate(() => {
    const sheet = document.createElement('style')
    sheet.textContent = 'body { margin-block-start: 12px }'
    document.head.append(sheet)
    const applied = getComputedStyle(document.body).marginBlockStart
    sheet.remove()
    return applied
  })
  expect(restored).toEqual('12px')
})

test('the sidebar becomes the bottom bar on a phone, capped by a More button', async ({ page }) => {
  await page.setViewport({ width: 800, height: 600 })
  expect(await visible(page, sidebar)).toEqual(true)
  expect(await visible(page, bottomBar)).toEqual(false)
  expect(await parentClassOf(page, barNav)).toEqual('bar-body')
  expect(await parentClassOf(page, tools)).toEqual('bar-tools')
  expect(await parentClassOf(page, sideExtras)).toEqual('sidebar-extras')
  expect(await parentClassOf(page, footerRows)).toEqual('sidebar-foot')

  await page.setViewport({ width: 420, height: 720 })
  await page.waitForSelector('#shell imp-shell >>> .bottombar .more')
  expect(await visible(page, sidebar)).toEqual(false)
  expect(await visible(page, bottomBar)).toEqual(true)
  expect(await topOf(page, bottomBar) > await topOf(page, main)).toBeTruthy()

  const shown = await page.$$eval(
    '#shell imp-shell >>> .bottombar .link',
    (links) => links.map((link) => link.textContent.trim()),
  )
  expect(shown).toEqual(['One', 'Two', 'Three', 'Four', 'More'])

  await page.click('#shell imp-shell >>> .bottombar .more')
  expect(await visible(page, '#shell imp-shell >>> .sheet')).toEqual(true)
  const boxOf = (selector) => page.$eval(selector, (node) => node.getBoundingClientRect().toJSON())
  const sheetBox = await boxOf('#shell imp-shell >>> .sheet')
  const moreBox = await boxOf('#shell imp-shell >>> .bottombar .more')
  expect(sheetBox.bottom <= moreBox.top).toBeTruthy()
  expect(sheetBox.top > 100).toBeTruthy()
  expect(sheetBox.width < 420 * 0.8).toBeTruthy()
  expect(sheetBox.left < moreBox.right && sheetBox.right > moreBox.left).toBeTruthy()
  expect(
    await page.$eval(
      '#shell imp-shell >>> .sheet ul',
      (node) => getComputedStyle(node).gridTemplateColumns.split(' ').length,
    ),
  ).toEqual(1)
  expect(
    await page.$eval(
      '#shell imp-shell >>> .bottombar .more',
      (node) => node.getAttribute('aria-expanded'),
    ),
  ).toEqual('true')
  expect(await page.$eval('#shell imp-shell >>> .sheet .title', (node) => node.textContent))
    .toEqual('More in Reports')
  expect(
    await page.$$eval(
      '#shell imp-shell >>> .sheet .link',
      (links) => links.map((link) => link.textContent.trim()),
    ),
  ).toEqual(['Five', 'Six'])

  await page.keyboard.press('Escape')
  await page.setViewport({ width: 800, height: 600 })
  await page.waitForFunction(() => {
    const frame = document.querySelector('shell-showcase')?.shadowRoot?.querySelector('imp-shell')
    return frame?.shadowRoot?.querySelector('.bottombar .link') === null
  })
  expect(
    await page.$$eval(
      '#shell imp-shell >>> .sidebar-body li:not([hidden]) .link',
      (links) => links.map((link) => link.textContent.trim()),
    ),
  ).toEqual(['One', 'Two', 'Three', 'Four', 'Five', 'Six'])
})

test('the rail centers its toggle and drops a foot that holds only the tools', async ({ page }) => {
  await page.setViewport({ width: 800, height: 600 })
  const toggle = '#rail imp-shell >>> .rail-toggle'
  const head = '#rail imp-shell >>> .sidebar-head'
  const foot = '#rail imp-shell >>> .sidebar-foot'
  expect(await parentClassOf(page, '#rail imp-shell >>> .tools')).toEqual('sidebar-foot')
  expect(await visible(page, foot)).toEqual(true)

  await page.click(toggle)
  expect(await visible(page, foot)).toEqual(false)
  const centerOf = async (selector) => {
    const { left, right } = await edgesOf(page, selector)
    return (left + right) / 2
  }
  expect(Math.abs(await centerOf(toggle) - await centerOf(head)) < 1).toBeTruthy()

  await page.click(toggle)
  expect(await visible(page, foot)).toEqual(true)
  expect(await centerOf(toggle) > await centerOf(head)).toBeTruthy()
})

test('a child row appears under its parent when the parent is expanded', async ({ page }) => {
  await page.setViewport({ width: 800, height: 600 })
  const rows = () =>
    page.$$eval(
      '#shell imp-shell >>> .sidebar-body li:not([hidden]) .link',
      (links) => links.map((link) => link.textContent.trim()),
    )
  expect(await rows()).not.toContain('Two A')
  await page.click('#shell imp-shell >>> .sidebar-body li:nth-child(2) .link')
  expect(await rows()).toEqual(['One', 'Two', 'Two A', 'Three', 'Four', 'Five', 'Six'])
  await page.click('#shell imp-shell >>> .sidebar-body li:nth-child(2) .link')
  expect(await rows()).not.toContain('Two A')
})

test('the shell mirrors its drawer and its sidebar under dir="rtl"', async ({ page }) => {
  await page.setViewport({ width: 800, height: 600 })
  const offset = () =>
    page.$eval(drawer, (node) => getComputedStyle(node).getPropertyValue('--overlay-offset'))
  expect(await offset()).toEqual('-100% 0')
  expect((await edgesOf(page, sidebar)).right <= (await edgesOf(page, main)).left).toBeTruthy()

  await page.evaluate(() => {
    document.documentElement.dir = 'rtl'
  })
  expect(await offset()).toEqual('100% 0')
  expect((await edgesOf(page, sidebar)).left >= (await edgesOf(page, main)).right).toBeTruthy()

  await page.evaluate(() => {
    document.documentElement.dir = ''
  })
})

const splitHandle = (id) => `#${id} imp-split-pane >>> [role="separator"]`

const splitBoxes = (page, id) =>
  page.$eval(`#${id} imp-split-pane`, (node) => {
    const box = (element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect()
      return { left, right, top, bottom, width, height }
    }
    const [start, end] = node.shadowRoot.querySelectorAll('.pane')
    const handle = node.shadowRoot.querySelector('[role="separator"]')
    return {
      start: box(start),
      end: box(end),
      handle: box(handle),
      now: Number(handle.getAttribute('aria-valuenow')),
    }
  })

const centerOf = (box) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 })

const dragBy = async (page, id, dx, dy) => {
  await page.$eval(`#${id}`, (node) => node.scrollIntoView({ block: 'center' }))
  const { x, y } = centerOf((await splitBoxes(page, id)).handle)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx / 2, y + dy / 2)
  await page.mouse.move(x + dx, y + dy)
  await page.mouse.up()
}

test('a splitPane puts the start pane on the left, and a drag resizes it', async ({ page }) => {
  const before = await splitBoxes(page, 'ltr-split')
  expect(before.start.left < before.end.left).toBeTruthy()
  expect(Math.abs(before.start.width - before.end.width) < 1).toBeTruthy()
  await dragBy(page, 'ltr-split', -100, 0)
  const after = await splitBoxes(page, 'ltr-split')
  expect(after.now > 20 && after.now < 30).toBeTruthy()
  expect(after.start.width < before.start.width - 80).toBeTruthy()
  expect(Math.abs(centerOf(after.handle).x - (centerOf(before.handle).x - 100)) < 6).toBeTruthy()
})

test('under dir="rtl" the start pane is on the right, and the drag and keys mirror', async ({ page }) => {
  const before = await splitBoxes(page, 'rtl-split')
  expect(before.start.left > before.end.left).toBeTruthy()
  await dragBy(page, 'rtl-split', -100, 0)
  const dragged = await splitBoxes(page, 'rtl-split')
  expect(dragged.now > 70 && dragged.now < 80).toBeTruthy()
  expect(dragged.start.width > before.start.width + 80).toBeTruthy()
  await page.focus(splitHandle('rtl-split'))
  await page.keyboard.press('ArrowRight')
  const moved = await splitBoxes(page, 'rtl-split')
  expect(moved.now).toEqual(Math.round((dragged.now - 5) * 10) / 10)
  expect(moved.handle.left > dragged.handle.left).toBeTruthy()
})

test('a vertical splitPane stacks the panes, and a drag down grows the top pane', async ({ page }) => {
  const before = await splitBoxes(page, 'vertical-split')
  expect(before.start.bottom <= before.end.top).toBeTruthy()
  await dragBy(page, 'vertical-split', 0, 40)
  const after = await splitBoxes(page, 'vertical-split')
  expect(after.start.height > before.start.height + 30).toBeTruthy()
  expect(after.now > 65 && after.now < 75).toBeTruthy()
})

const hitsHandle = (page, id, offsets) =>
  page.$eval(`#${id} imp-split-pane`, (node, offsets) => {
    node.scrollIntoView({ block: 'center' })
    const handle = node.shadowRoot.querySelector('[role="separator"]')
    const vertical = handle.getAttribute('aria-orientation') === 'horizontal'
    const { left, top, width, height } = handle.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    return offsets.map((offset) => {
      const hit = vertical
        ? node.shadowRoot.elementFromPoint(x, y + offset)
        : node.shadowRoot.elementFromPoint(x + offset, y)
      return handle.contains(hit)
    })
  }, offsets)

test('the handle of a splitPane takes a pointer 12px to each side of its thin line', async ({ page }) => {
  for (const id of ['ltr-split', 'rtl-split', 'vertical-split']) {
    expect({ id, hits: await hitsHandle(page, id, [-15, -11.5, 0, 11.5, 15]) }).toEqual({
      id,
      hits: [false, true, true, true, false],
    })
  }
  const line = await page.$eval(
    '#ltr-split imp-split-pane',
    (node) => node.shadowRoot.querySelector('.line').getBoundingClientRect().width,
  )
  expect(line).toEqual(1)
  const { handle } = await splitBoxes(page, 'ltr-split')
  expect(handle.width).toEqual(8)
})

test('a drag that starts beside the line of a splitPane moves the line by the pointer travel', async ({ page }) => {
  await page.$eval('#ltr-split', (node) => node.scrollIntoView({ block: 'center' }))
  const before = await splitBoxes(page, 'ltr-split')
  const { x, y } = centerOf(before.handle)
  await page.mouse.move(x + 10, y)
  await page.mouse.down()
  await page.mouse.move(x + 30, y)
  const grabbed = await splitBoxes(page, 'ltr-split')
  expect(Math.abs(grabbed.now - (before.now + 5)) < 0.5).toBeTruthy()
  await page.mouse.move(x + 50, y)
  await page.mouse.up()
  const after = await splitBoxes(page, 'ltr-split')
  expect(Math.abs(after.now - (before.now + 10)) < 0.5).toBeTruthy()
})

const pointerOnHandle = (page, id, type, pointerId, dx) =>
  page.$eval(
    `#${id} imp-split-pane`,
    (node, type, pointerId, dx) => {
      const handle = node.shadowRoot.querySelector('[role="separator"]')
      const { left, top, width, height } = handle.getBoundingClientRect()
      handle.dispatchEvent(
        new PointerEvent(type, {
          pointerId,
          button: 0,
          clientX: left + width / 2 + dx,
          clientY: top + height / 2,
          bubbles: true,
          composed: true,
        }),
      )
    },
    type,
    pointerId,
    dx,
  )

const isDragging = (page, id) =>
  page.$eval(
    `#${id} imp-split-pane`,
    (node) => node.shadowRoot.querySelector('.root').classList.contains('dragging'),
  )

test('a splitPane follows only the pointer that started the drag', async ({ page }) => {
  await page.$eval('#ltr-split', (node) => node.scrollIntoView({ block: 'center' }))
  const before = await splitBoxes(page, 'ltr-split')
  const { x, y } = centerOf(before.handle)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await pointerOnHandle(page, 'ltr-split', 'pointerdown', 7, 0)
  await pointerOnHandle(page, 'ltr-split', 'pointermove', 7, -120)
  expect((await splitBoxes(page, 'ltr-split')).now).toEqual(before.now)
  await pointerOnHandle(page, 'ltr-split', 'pointerup', 7, 0)
  expect(await isDragging(page, 'ltr-split')).toBeTruthy()
  await page.mouse.move(x + 40, y)
  expect(Math.abs((await splitBoxes(page, 'ltr-split')).now - (before.now + 10)) < 1.5).toBeTruthy()
  await page.mouse.up()
  expect(await isDragging(page, 'ltr-split')).toEqual(false)
})

test('a splitPane ends the drag when the handle loses the pointer capture', async ({ page }) => {
  await page.$eval('#ltr-split', (node) => node.scrollIntoView({ block: 'center' }))
  const before = await splitBoxes(page, 'ltr-split')
  const { x, y } = centerOf(before.handle)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 20, y)
  const dragged = (await splitBoxes(page, 'ltr-split')).now
  expect(Math.abs(dragged - (before.now + 5)) < 1.5).toBeTruthy()
  await page.$eval('#ltr-split imp-split-pane', (node) => {
    const handle = node.shadowRoot.querySelector('[role="separator"]')
    handle.releasePointerCapture(1)
  })
  await page.mouse.move(x + 22, y)
  expect(await isDragging(page, 'ltr-split')).toEqual(false)
  await page.mouse.move(x - 60, y)
  expect((await splitBoxes(page, 'ltr-split')).now).toEqual(dragged)
  await page.mouse.up()
})

test('a splitPane starts a new drag when an old drag lost its capture without an event', async ({ page }) => {
  await page.$eval('#ltr-split', (node) => node.scrollIntoView({ block: 'center' }))
  const before = await splitBoxes(page, 'ltr-split')
  const { x, y } = centerOf(before.handle)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 20, y)
  await page.$eval('#ltr-split imp-split-pane', (node) => {
    globalThis.swallowPointerEnd = (event) => event.stopPropagation()
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      document.addEventListener(type, globalThis.swallowPointerEnd, true)
    }
    node.shadowRoot.querySelector('[role="separator"]').releasePointerCapture(1)
  })
  await page.mouse.move(x + 150, y)
  await page.mouse.up()
  expect(await isDragging(page, 'ltr-split')).toBeTruthy()
  await page.evaluate(() => {
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      document.removeEventListener(type, globalThis.swallowPointerEnd, true)
    }
  })
  const stuck = await splitBoxes(page, 'ltr-split')
  const handle = centerOf(stuck.handle)
  await page.mouse.move(handle.x, handle.y)
  await page.mouse.down()
  await page.mouse.move(handle.x - 40, handle.y)
  expect(Math.abs((await splitBoxes(page, 'ltr-split')).now - (stuck.now - 10)) < 1.5).toBeTruthy()
  await page.mouse.up()
  expect(await isDragging(page, 'ltr-split')).toEqual(false)
})

test('the handle of a splitPane is a named separator in the accessibility tree', async ({ page }) => {
  const node = await page.accessibility.snapshot({
    root: await page.$(splitHandle('ltr-split')),
    interestingOnly: false,
  })
  expect(node.role).toEqual('separator')
  expect(node.name).toEqual('Resize the demo')
})
