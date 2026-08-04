import { expect, test } from 'imp/test'

test('starts at zero', async ({ page }) => {
  const text = await page.$eval('#count', (element) => element.textContent)
  expect(text).toEqual('0')
})

test('a plain selector reaches inside a shadow root', async ({ page }) => {
  const text = await page.$eval('#banner', (element) => element.textContent)
  expect(text).toEqual('inside a shadow root')
  const handle = await page.$('counter-banner')
  expect(await handle.$eval('#banner', (element) => element.tagName)).toEqual('P')
})

test('increments on click', async ({ page }) => {
  await page.click('#inc')
  await page.click('#inc')
  const text = await page.$eval('#count', (element) => element.textContent)
  expect(text).toEqual('2')
})
