import { expect, test } from 'imp/test'

const clicks = (page) => page.$eval('#clicks', (node) => node.textContent)

test('renders the app', async ({ page }) => {
  expect(await page.$eval('h1', (node) => node.textContent)).toEqual('Hello from imp')
  expect(await clicks(page)).toEqual('Clicks: 0')
})

test('counts a click', async ({ page }) => {
  await page.click('imp-button >>> button')
  expect(await clicks(page)).toEqual('Clicks: 1')
})
