import { expect, test } from 'imp/test'

const PHONE = { width: 480, height: 900 }

const DESKTOP = { width: 1280, height: 900 }

const styleOf = (page, selector, property) =>
  page.$eval(selector, (node, name) => getComputedStyle(node)[name], property)

const at = async (page, viewport, read) => {
  await page.setViewport(viewport)
  return await read()
}

const SWITCHING = '>>> #switching imp-stack >>> .root'
const CARDS = '>>> #cards imp-grid >>> .root'
const GROWING = '>>> #toolbar imp-row >>> .root > imp-item >>> .root'
const DESKTOP_ONLY = '>>> #desktop-only imp-stack >>> .root'

test('a responsive direction really switches at the breakpoint', async ({ page }) => {
  expect(await at(page, PHONE, () => styleOf(page, SWITCHING, 'flexDirection'))).toEqual('column')
  expect(await at(page, DESKTOP, () => styleOf(page, SWITCHING, 'flexDirection'))).toEqual('row')
})

test('a responsive gap resolves to the theme step for that breakpoint', async ({ page }) => {
  expect(await at(page, PHONE, () => styleOf(page, SWITCHING, 'gap'))).toEqual('8px')
  expect(await at(page, DESKTOP, () => styleOf(page, SWITCHING, 'gap'))).toEqual('24px')
})

test('a responsive column count really changes the grid', async ({ page }) => {
  const phone = await at(page, PHONE, () => styleOf(page, CARDS, 'gridTemplateColumns'))
  const desktop = await at(page, DESKTOP, () => styleOf(page, CARDS, 'gridTemplateColumns'))
  expect(phone.split(' ').length).toEqual(1)
  expect(desktop.split(' ').length).toEqual(3)
})

test('hideBelow removes the element under its breakpoint and restores it above', async ({ page }) => {
  expect(await at(page, PHONE, () => styleOf(page, DESKTOP_ONLY, 'display'))).toEqual('none')
  expect(await at(page, DESKTOP, () => styleOf(page, DESKTOP_ONLY, 'display'))).toEqual('flex')
})

test('an item marked grow takes the leftover width of its row', async ({ page }) => {
  await page.setViewport(DESKTOP)
  const growing = await page.$eval(GROWING, (node) => node.getBoundingClientRect().width)
  const fixed = await page.$eval(
    '>>> #toolbar imp-row >>> .root > span',
    (node) => node.getBoundingClientRect().width,
  )
  expect(growing > fixed * 3).toBeTruthy()
})
