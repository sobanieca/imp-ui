import { expect, test } from 'imp/test'

const PHONE = { width: 480, height: 900 }

const DESKTOP = { width: 1280, height: 900 }

const styleOf = (page, selector, property) =>
  page.$eval(selector, (node, name) => getComputedStyle(node)[name], property)

const at = async (page, viewport, read) => {
  await page.setViewport(viewport)
  return await read()
}

const SWITCHING = '#switching imp-stack >>> .root'
const CARDS = '#cards imp-grid >>> .root'
const GROWING = '#bar > imp-stack >>> .root > imp-stack >>> .root'
test('a direction really switches the axis at every width', async ({ page }) => {
  expect(await at(page, PHONE, () => styleOf(page, SWITCHING, 'flexDirection'))).toEqual('row')
  expect(await at(page, DESKTOP, () => styleOf(page, SWITCHING, 'flexDirection'))).toEqual('row')
})

test('a gap resolves to the theme step at every width', async ({ page }) => {
  const phone = await at(page, PHONE, () => styleOf(page, SWITCHING, 'gap'))
  const desktop = await at(page, DESKTOP, () => styleOf(page, SWITCHING, 'gap'))
  expect(parseFloat(phone) > 0).toBeTruthy()
  expect(parseFloat(desktop) >= parseFloat(phone)).toBeTruthy()
})

test('an exact column count really drives the grid', async ({ page }) => {
  const desktop = await at(page, DESKTOP, () => styleOf(page, CARDS, 'gridTemplateColumns'))
  expect(desktop.split(' ').length).toEqual(3)
})

const PANEL_BOX = '#panel > imp-stack >>> .root'

const CENTRED = '#centred imp-page >>> .root'

const BAND = '#band imp-section >>> .root'

test('a fluid spacing token really grows with the viewport', async ({ page }) => {
  const phone = await at(page, PHONE, () => styleOf(page, BAND, 'paddingBlockStart'))
  const desktop = await at(page, DESKTOP, () => styleOf(page, BAND, 'paddingBlockStart'))
  expect(parseFloat(desktop) > parseFloat(phone)).toBeTruthy()
})

test('a box resolves its padding, radius, border and ratio into real style', async ({ page }) => {
  const phone = await at(page, PHONE, () => styleOf(page, PANEL_BOX, 'padding'))
  const desktop = await at(page, DESKTOP, () => styleOf(page, PANEL_BOX, 'padding'))
  expect(parseFloat(phone) > 0).toBeTruthy()
  expect(parseFloat(desktop) > parseFloat(phone)).toBeTruthy()
  expect(await styleOf(page, PANEL_BOX, 'borderRadius')).toEqual('10px')
  expect(await styleOf(page, PANEL_BOX, 'borderTopWidth')).toEqual('1px')
  expect(await styleOf(page, PANEL_BOX, 'aspectRatio')).toEqual('2 / 1')
})

test('a page caps its width at the theme step and centres itself', async ({ page }) => {
  expect(await at(page, DESKTOP, () => styleOf(page, CENTRED, 'maxInlineSize'))).toEqual('640px')
  const gaps = await page.$eval(CENTRED, (node) => {
    const box = node.getBoundingClientRect()
    const parent = node.getRootNode().host.parentElement.getBoundingClientRect()
    return [Math.round(box.left - parent.left), Math.round(parent.right - box.right)]
  })
  expect(gaps[0]).toEqual(gaps[1])
})

test('a section pads its block axis from the spacing scale', async ({ page }) => {
  expect(parseFloat(await styleOf(page, BAND, 'paddingBlockStart')) > 0).toBeTruthy()
  expect(await styleOf(page, BAND, 'paddingInlineStart')).toEqual('0px')
})

const RESIZER = '#resizing imp-sidebar >>> .resizer'

const SIDEBAR = '#resizing imp-sidebar >>> .root'

const HEAD = '#resizing imp-sidebar >>> .head'

const TOGGLE = '#resizing imp-sidebar >>> .toggle'

const PANEL = '#resizing imp-sidebar >>> .panel'

const widthOf = (page) =>
  page.$eval(SIDEBAR, (node) => Math.round(node.getBoundingClientRect().width))

const grip = (page) =>
  page.$eval(RESIZER, (node) => {
    const { x, y, width, height } = node.getBoundingClientRect()
    return { x: x + width / 2, y: y + height / 2 }
  })

const reset = async (page) => {
  const { x, y } = await grip(page)
  await page.mouse.click(x, y, { clickCount: 2 })
  return await widthOf(page)
}

const ready = async (page, viewport) => {
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.setViewport(viewport ?? DESKTOP)
  await page.$eval(
    SIDEBAR,
    (node) =>
      Promise.allSettled(node.getAnimations().map((animation) => animation.finished))
        .then(() => true),
  )
  return await reset(page)
}

const dragged = async (page, by) => {
  const { x, y } = await grip(page)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + by, y, { steps: 4 })
  await page.mouse.up()
  return await widthOf(page)
}

test('dragging the splitter with the mouse resizes the sidebar', async ({ page }) => {
  expect(await ready(page)).toEqual(256)
  expect(await dragged(page, 40)).toEqual(296)
  expect(await dragged(page, -60)).toEqual(236)
})

test('a drag stops at the ends of the range the sidebar was given', async ({ page }) => {
  await ready(page)
  expect(await dragged(page, 400)).toEqual(320)
  expect(await dragged(page, -400)).toEqual(192)
})

test('a finger drag resizes the sidebar the same way a mouse does', async ({ page }) => {
  expect(await ready(page, { ...DESKTOP, hasTouch: true })).toEqual(256)
  const { x, y } = await grip(page)
  await page.touchscreen.touchStart(x, y)
  await page.touchscreen.touchMove(x + 50, y)
  await page.touchscreen.touchEnd()
  expect(await widthOf(page)).toEqual(306)
})

test('the splitter is operable from the keyboard and reports where it is', async ({ page }) => {
  await ready(page)
  await page.focus(RESIZER)
  await page.keyboard.press('Home')
  expect(await widthOf(page)).toEqual(192)
  await page.keyboard.press('ArrowRight')
  expect(await widthOf(page)).toEqual(208)
  await page.keyboard.press('End')
  expect(await widthOf(page)).toEqual(320)
  await page.evaluate(() => new Promise(requestAnimationFrame))
  const values = await page.$eval(RESIZER, (node) => ({
    now: node.getAttribute('aria-valuenow'),
    min: node.getAttribute('aria-valuemin'),
    max: node.getAttribute('aria-valuemax'),
  }))
  expect(values).toEqual({ now: '320', min: '192', max: '320' })
})

test('a double click on the splitter puts the sidebar back to its declared width', async ({ page }) => {
  await ready(page)
  expect(await dragged(page, 40)).toEqual(296)
  expect(await reset(page)).toEqual(256)
})

test('a sidebar that cannot collapse still opens as a drawer on a phone', async ({ page }) => {
  await page.setViewport(DESKTOP)
  expect(await styleOf(page, HEAD, 'display')).toEqual('none')
  await page.setViewport(PHONE)
  expect(await styleOf(page, HEAD, 'display')).toEqual('flex')
  expect(await page.$eval(PANEL, (node) => node.inert)).toEqual(true)
  await page.click(TOGGLE)
  expect(await page.$eval(PANEL, (node) => node.inert)).toEqual(false)
  await page.setViewport(DESKTOP)
})

test('a stack marked grow takes the leftover width of its row', async ({ page }) => {
  await page.setViewport(DESKTOP)
  const growing = await page.$eval(GROWING, (node) => node.getBoundingClientRect().width)
  const fixed = await page.$eval(
    '#bar > imp-stack >>> .root > span',
    (node) => node.getBoundingClientRect().width,
  )
  expect(growing > fixed * 3).toBeTruthy()
})
