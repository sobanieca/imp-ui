import { expect, test } from 'imp/test'

const routeText = (page) => page.$eval('#leave-route', (node) => node.textContent)

const routeSettlesOn = (page, path) =>
  page.waitForFunction(
    (expected) =>
      location.pathname === expected &&
      document.querySelector('leave-showcase').shadowRoot.querySelector('#leave-route')
          .textContent === expected,
    {},
    path,
  )

const pause = (page) => page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)))

test('the back button keeps a screen whose beforeLeave refuses, and leaves once it allows', async ({ page }) => {
  const start = await page.evaluate(() => location.pathname)
  await page.click('#leave #leave-go')
  await routeSettlesOn(page, '/elsewhere')

  await page.click('#leave #leave-dirty')
  await page.evaluate(() => history.back())
  await pause(page)
  await routeSettlesOn(page, '/elsewhere')

  await page.click('#leave #leave-go')
  await pause(page)
  expect(await routeText(page)).toEqual('/elsewhere')

  await page.click('#leave #leave-dirty')
  await page.evaluate(() => history.back())
  await routeSettlesOn(page, start)
  await page.evaluate(() => history.forward())
  await routeSettlesOn(page, '/elsewhere')
})
