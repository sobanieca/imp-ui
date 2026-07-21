import { expect, test } from 'imp/test'

const itemTexts = (page) =>
  page.$$eval('>>> #list li', (nodes) => nodes.map((node) => node.textContent))

const countText = (page) => page.$eval('>>> #count', (node) => node.textContent)

test('renders the empty app', async ({ page }) => {
  expect(await page.$eval('>>> h1', (node) => node.textContent)).toEqual('imp todo')
  expect(await itemTexts(page)).toEqual([])
  expect(await countText(page)).toEqual('0 left')
})

test('adds items through the input', async ({ page }) => {
  await page.type('>>> #draft', 'write tests')
  await page.click('>>> #add')
  await page.type('>>> #draft', 'ship imp')
  await page.click('>>> #add')
  expect(await itemTexts(page)).toEqual(['write tests', 'ship imp'])
  expect(await countText(page)).toEqual('2 left')
  expect(await page.$eval('>>> #draft', (node) => node.value)).toEqual('')
})

test('ignores a blank draft', async ({ page }) => {
  await page.click('>>> #add')
  expect(await itemTexts(page)).toEqual(['write tests', 'ship imp'])
})

test('toggles an item done on click', async ({ page }) => {
  await page.click('>>> #list li')
  expect(await page.$eval('>>> #list li', (node) => node.className)).toEqual('done')
  expect(await countText(page)).toEqual('1 left')
  await page.click('>>> #list li')
  expect(await page.$eval('>>> #list li', (node) => node.className)).toEqual('')
  expect(await countText(page)).toEqual('2 left')
})

test('clears the list', async ({ page }) => {
  await page.click('>>> #clear')
  expect(await itemTexts(page)).toEqual([])
  expect(await countText(page)).toEqual('0 left')
})
