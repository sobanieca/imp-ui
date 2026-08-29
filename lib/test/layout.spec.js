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

const parentOf = (page, selector) => page.$eval(selector, (node) => node.parentElement.localName)

test('the shell drawer slides the sidebar in, and holds it until it has slid out', async ({ page }) => {
  await page.setViewport({ width: 420, height: 720 })
  const drawer = '#shell imp-shell >>> .drawer'
  const sidebar = '#shell imp-shell >>> .sidebar'

  expect(
    await page.$eval(drawer, (node) => getComputedStyle(node).getPropertyValue('--overlay-offset')),
  ).toEqual('-100% 0')

  await page.click('#shell imp-shell >>> .trigger')
  await settled(page, drawer)
  expect(await parentOf(page, sidebar)).toEqual('dialog')
  expect(Math.round((await edgesOf(page, drawer)).left)).toEqual(0)

  await page.keyboard.press('Escape')
  expect(await page.$eval(drawer, (node) => node.open)).toEqual(true)
  expect(await parentOf(page, sidebar)).toEqual('dialog')

  await settled(page, drawer)
  await page.waitForFunction(() => {
    const frame = document.querySelector('shell-showcase')?.shadowRoot?.querySelector('imp-shell')
    const region = frame?.shadowRoot?.querySelector('.sidebar')
    return region?.parentElement?.localName === 'div'
  })
  expect(await page.$eval(drawer, (node) => node.open)).toEqual(false)
  expect(await page.$eval('#shell imp-shell >>> .trigger', (node) => node.matches(':focus')))
    .toEqual(true)

  await page.setViewport({ width: 800, height: 600 })
})
