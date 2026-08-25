import { expect, test } from 'imp/test'

const styleOf = (page, selector, property) =>
  page.$eval(selector, (node, name) => getComputedStyle(node)[name], property)

const settled = (page, selector) =>
  page.$eval(
    selector,
    async (node) => void await Promise.all(node.getAnimations().map(({ finished }) => finished)),
  )

const BUTTON = '#std imp-button >>> button'

test('a std component paints with the applied theme tokens', async ({ page }) => {
  expect(await styleOf(page, BUTTON, 'backgroundColor')).toEqual('rgb(37, 99, 235)')
  expect(await styleOf(page, '#std imp-heading >>> h2', 'fontWeight')).toEqual('700')
  expect(await styleOf(page, '#std imp-text >>> p', 'color'))
    .toEqual('rgb(100, 116, 139)')
})

test('swapping the theme re-skins std components without a re-render', async ({ page }) => {
  await page.click(BUTTON)
  await page.mouse.move(0, 0)
  await settled(page, BUTTON)
  expect(await styleOf(page, BUTTON, 'backgroundColor')).toEqual('rgb(124, 156, 255)')
  expect(await styleOf(page, '#std imp-text >>> p', 'color'))
    .toEqual('rgb(148, 163, 184)')
})

test('a std component keeps its styles out of the page', async ({ page }) => {
  expect(await page.$eval('#std imp-button', (node) => node.textContent)).toEqual('')
})

test('focusing a component host focuses the control inside it', async ({ page }) => {
  await page.$eval('#std imp-button', (node) => node.focus())
  expect(await page.$eval(BUTTON, (node) => node.matches(':focus'))).toEqual(true)
})
