import { expect, test } from 'imp/test'

test('starts at zero', async ({ page }) => {
  const text = await page.$eval('#count', (element) => element.textContent)
  expect(text).toEqual('0')
})

test('increments on click', async ({ page }) => {
  await page.click('#inc')
  await page.click('#inc')
  const text = await page.$eval('#count', (element) => element.textContent)
  expect(text).toEqual('2')
})
