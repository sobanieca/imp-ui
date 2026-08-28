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
    const { left, top } = node.getBoundingClientRect()
    return { left, top }
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
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .toEqual('visible')

  await page.evaluate(() => document.scrollingElement.scrollTo(0, 120))
  expect(await scrollTop(page)).toEqual(120)
  await page.evaluate(() => document.scrollingElement.scrollTo(0, 0))

  const before = await boxOf(page, WINDOW)
  const bar = await page.$('#window imp-dialog >>> .bar')
  const barBox = await bar.boundingBox()
  await page.mouse.move(barBox.x + barBox.width / 2, barBox.y + barBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(barBox.x + barBox.width / 2 - 40, barBox.y + barBox.height / 2 + 30)
  await page.mouse.up()

  const after = await boxOf(page, WINDOW)
  expect(Math.round(before.left - after.left)).toEqual(40)
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
