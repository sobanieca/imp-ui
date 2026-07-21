import { expect, test } from 'imp/test'

const cardSort = (page) => page.$eval('>>> #card-sort', (node) => node.textContent)

test('the card starts in column a with its column state', async ({ page }) => {
  expect(await page.$eval('>>> #column-a >>> #card-input', (node) => node.value)).toEqual('')
  expect(await cardSort(page)).toEqual('alpha')
})

test('a moved card keeps its input text and follows the new column state', async ({ page }) => {
  await page.type('>>> #card-input', 'buy milk')
  await page.click('>>> #move-card')
  expect(await page.$eval('>>> #column-b >>> #card-input', (node) => node.value)).toEqual(
    'buy milk',
  )
  expect(await cardSort(page)).toEqual('beta')
})

test('moving back rebinds to the first column again', async ({ page }) => {
  await page.click('>>> #move-card')
  expect(await page.$eval('>>> #column-a >>> #card-input', (node) => node.value)).toEqual(
    'buy milk',
  )
  expect(await cardSort(page)).toEqual('alpha')
})
