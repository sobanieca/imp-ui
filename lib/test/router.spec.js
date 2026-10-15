import { expect, test } from 'imp/test'

const routeText = (page) => page.$eval('#leave-route', (node) => node.textContent)

const routeSettlesOn = (page, path) =>
  page.waitForFunction(
    (expected) =>
      location.pathname === expected
      && document.querySelector('leave-showcase').shadowRoot.querySelector('#leave-route')
        .textContent === expected,
    {},
    path,
  )

const pause = (page) => page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)))

test('the back button keeps a screen whose beforeLeave refuses, and leaves once it allows', async ({
  page,
}) => {
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

const refusalOf = (page, to, options) =>
  page.evaluate(
    (target, settings) => {
      try {
        globalThis.__impNavigate(target, settings)
        return null
      } catch (error) {
        return error.message
      }
    },
    to,
    options,
  )

test('navigate() refuses a javascript: url, even with external', async ({ page }) => {
  const start = await page.evaluate(() => location.href)
  for (const options of [undefined, { external: true }]) {
    const refusal = await refusalOf(page, 'javascript:globalThis.__impRan=true', options)
    expect(refusal).toContain('only an http or https url')
  }
  await pause(page)
  expect(await page.evaluate(() => globalThis.__impRan === true)).toEqual(false)
  expect(await page.evaluate(() => location.href)).toEqual(start)
})

test('navigate() stays on the origin of the app unless external is set', async ({ page }) => {
  const start = await page.evaluate(() => location.href)
  for (const to of ['//evil.example/', '/\\evil.example/', 'https://evil.example/']) {
    expect(await refusalOf(page, to)).toContain('another site')
  }
  await pause(page)
  expect(await page.evaluate(() => location.href)).toEqual(start)
})

test('navigate(url, { external: true }) leaves for another origin', async ({ page, baseUrl }) => {
  const elsewhere = baseUrl.replace('127.0.0.1', 'localhost')
  await Promise.all([
    page.waitForNavigation(),
    page.evaluate((to) => globalThis.__impNavigate(to, { external: true }), elsewhere),
  ])
  expect(await page.evaluate(() => location.origin)).toEqual(new URL(elsewhere).origin)
  await page.goto(baseUrl, { waitUntil: 'load' })
})
