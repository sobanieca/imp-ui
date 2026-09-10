import { expect, test } from 'imp/test'

const MODAL = '#modal imp-dialog >>> .panel'
const WINDOW = '#window imp-dialog >>> .panel'

const settled = (page, selector) =>
  page.$eval(
    selector,
    async (node) => void await Promise.all(node.getAnimations().map(({ finished }) => finished)),
  )

const boxOf = (page, selector) =>
  page.$eval(selector, (node) => {
    const { left, right, top } = node.getBoundingClientRect()
    return { left, right, top }
  })

const scrollTop = (page) => page.evaluate(() => document.scrollingElement.scrollTop)

test('a modal dialog takes the top layer, holds the page still and gives it back', async ({ page }) => {
  await page.evaluate(() => document.scrollingElement.scrollTo(0, 0))
  await page.click('#dialogs #open-modal')
  await settled(page, MODAL)

  expect(await page.$eval(MODAL, (node) => node.matches(':modal'))).toEqual(true)
  expect(await page.$eval(MODAL, (node) => getComputedStyle(node).opacity)).toEqual('1')
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .toEqual('hidden')

  await page.keyboard.press('Escape')
  expect(await page.$eval(MODAL, (node) => node.open)).toEqual(true)
  await settled(page, MODAL)
  await page.waitForFunction(() => {
    const frame = document.querySelector('dialog-showcase')?.shadowRoot
    return frame?.querySelector('#modal imp-dialog').shadowRoot.querySelector('.panel').open ===
      false
  })
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .toEqual('visible')
})

test('a non-modal dialog leaves the page scrollable and can be dragged around', async ({ page }) => {
  await page.click('#dialogs #open-window')
  await settled(page, WINDOW)

  expect(await page.$eval(WINDOW, (node) => node.matches(':popover-open'))).toEqual(true)
  expect(await page.$eval(WINDOW, (node) => node.matches(':modal'))).toEqual(false)
  const opener = await (await page.$('#dialogs #open-window')).boundingBox()
  const opened = await page.$eval(WINDOW, (node) => {
    const { top, bottom } = node.getBoundingClientRect()
    return { top, bottom }
  })
  const gapBelow = opened.top - (opener.y + opener.height)
  const gapAbove = opener.y - opened.bottom
  const adjacent = (gap) => gap >= 0 && gap < 24
  expect(adjacent(gapBelow) || adjacent(gapAbove)).toEqual(true)

  const origin = await scrollTop(page)
  await page.evaluate((top) => document.scrollingElement.scrollTo(0, top), origin + 120)
  expect(await scrollTop(page)).toEqual(origin + 120)
  await page.evaluate((top) => document.scrollingElement.scrollTo(0, top), origin)

  const before = await boxOf(page, WINDOW)
  const bar = await page.$('#window imp-dialog >>> .bar')
  const barBox = await bar.boundingBox()
  await page.mouse.move(barBox.x + barBox.width / 2, barBox.y + barBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(barBox.x + barBox.width / 2 + 40, barBox.y + barBox.height / 2 + 30)
  await page.mouse.up()

  const after = await boxOf(page, WINDOW)
  expect(Math.round(after.left - before.left)).toEqual(40)
  expect(Math.round(after.top - before.top)).toEqual(30)
})

test('selecting text across a modal dialog does not dismiss it', async ({ page }) => {
  await page.click('#dialogs #open-modal')
  await settled(page, MODAL)

  const body = await (await page.$('#modal imp-dialog >>> .body')).boundingBox()
  const bar = await (await page.$('#modal imp-dialog >>> .bar')).boundingBox()
  await page.mouse.move(body.x + 20, body.y + body.height / 2)
  await page.mouse.down()
  await page.mouse.move(bar.x + 20, bar.y + bar.height / 2, { steps: 10 })
  await page.mouse.up()
  await settled(page, MODAL)

  expect(await page.$eval(MODAL, (node) => node.open)).toEqual(true)

  await page.keyboard.press('Escape')
  await page.waitForFunction(() => {
    const frame = document.querySelector('dialog-showcase')?.shadowRoot
    return frame?.querySelector('#modal imp-dialog').shadowRoot.querySelector('.panel').open ===
      false
  })
})

test('a second window opens alongside the first, and both stay above the page', async ({ page }) => {
  await page.click('#dialogs #open-modal')
  await settled(page, MODAL)
  expect(await page.$eval(WINDOW, (node) => node.matches(':popover-open'))).toEqual(true)
  expect(await page.$eval(MODAL, (node) => node.matches(':modal'))).toEqual(true)
})

const END_DRAWER = '#end imp-drawer >>> .panel'
const PANEL_DRAWER = '#panel imp-drawer >>> .panel'
const MIRRORED_DRAWER = '#mirrored imp-drawer >>> .panel'

const offsetOf = (page, selector) =>
  page.$eval(selector, (node) => getComputedStyle(node).getPropertyValue('--overlay-offset'))

const viewportWidth = (page) => page.evaluate(() => document.documentElement.clientWidth)

const dismissed = async (page) => {
  await page.keyboard.press('Escape')
  await settled(page, MODAL)
  await page.waitForFunction(() => {
    const frame = document.querySelector('dialog-showcase')?.shadowRoot
    return frame?.querySelector('#modal imp-dialog').shadowRoot.querySelector('.panel').open ===
      false
  })
}

test('a drawer from the end slides in from the right under ltr and sits on that edge', async ({ page }) => {
  await dismissed(page)
  expect(await offsetOf(page, END_DRAWER)).toEqual('100% 0')
  await page.click('#drawers #open-end')
  await settled(page, END_DRAWER)
  expect(await page.$eval(END_DRAWER, (node) => node.matches(':modal'))).toEqual(true)
  const box = await page.$eval(END_DRAWER, (node) => {
    const { left, right, top, height } = node.getBoundingClientRect()
    return { left, right, top, height }
  })
  expect(Math.round(box.right)).toEqual(await viewportWidth(page))
  expect(box.left > 0).toBeTruthy()
  expect(Math.round(box.top)).toEqual(0)
  expect(Math.round(box.height)).toEqual(await page.evaluate(() => innerHeight))
  await page.keyboard.press('Escape')
  await settled(page, END_DRAWER)
  await page.waitForFunction(() => {
    const frame = document.querySelector('drawer-showcase')?.shadowRoot
    return frame?.querySelector('#end imp-drawer').shadowRoot.querySelector('.panel').open ===
      false
  })
})

test('a drawer is mirrored to the left under rtl, and a non-modal one leaves the page live', async ({ page }) => {
  expect(await offsetOf(page, PANEL_DRAWER)).toEqual('100% 0')
  expect(await offsetOf(page, MIRRORED_DRAWER)).toEqual('-100% 0')

  await page.click('#drawers #open-panel')
  await settled(page, PANEL_DRAWER)
  expect(await page.$eval(PANEL_DRAWER, (node) => node.matches(':popover-open'))).toEqual(true)
  expect(Math.round((await boxOf(page, PANEL_DRAWER)).right)).toEqual(await viewportWidth(page))
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .toEqual('visible')
  await page.click('#panel imp-drawer >>> .close')
  await settled(page, PANEL_DRAWER)

  await page.click('#drawers #open-mirrored')
  await settled(page, MIRRORED_DRAWER)
  expect(Math.round((await boxOf(page, MIRRORED_DRAWER)).left)).toEqual(0)
  await page.keyboard.press('Escape')
  await settled(page, MIRRORED_DRAWER)
})
