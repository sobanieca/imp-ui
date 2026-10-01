import { expect, test } from 'imp/test'

const MAIN = 'scroll-showcase >>> #scroll imp-shell >>> main.main'

const screenShown = (page, id) =>
  page.waitForFunction(
    (wanted) => {
      const frame = document.querySelector('scroll-showcase').shadowRoot
      const main = frame.querySelector('#scroll imp-shell').shadowRoot.querySelector('main.main')
      const route = main.querySelector('imp-router')?.shadowRoot?.querySelector('imp-route')
      return Boolean(route?.shadowRoot?.querySelector(`#${wanted}`))
    },
    {},
    id,
  )

const scrollOf = (page) => page.$eval(MAIN, (main) => main.scrollTop)

const scrolledTo = (page, wanted) =>
  page.waitForFunction(
    (expected) => {
      const frame = document.querySelector('scroll-showcase').shadowRoot
      const main = frame.querySelector('#scroll imp-shell').shadowRoot.querySelector('main.main')
      return main.scrollTop === expected
    },
    {},
    wanted,
  )

const settled = (page) =>
  page.evaluate(() =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  )

const motionDone = (page) =>
  page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {})))
  )

const clickInScreen = (page, id) =>
  page.evaluate((wanted) => {
    const frame = document.querySelector('scroll-showcase').shadowRoot
    const main = frame.querySelector('#scroll imp-shell').shadowRoot.querySelector('main.main')
    main.querySelector('imp-router').shadowRoot.querySelector('imp-route').shadowRoot
      .querySelector(`#${wanted}`).click()
  }, id)

test('the shell scrolls its content area to the top on a push and back to its place on a back', async ({ page }) => {
  await page.click('scroll-showcase >>> #scroll-start')
  await screenShown(page, 'tall-a')
  await settled(page)
  await page.$eval(MAIN, (main) => {
    main.scrollTop = 400
  })
  expect(await scrollOf(page)).toEqual(400)
  await clickInScreen(page, 'tall-a-next')
  await screenShown(page, 'tall-b')
  await scrolledTo(page, 0)
  await settled(page)
  await page.$eval(MAIN, (main) => {
    main.scrollTop = 250
  })
  await page.evaluate(() => history.back())
  await screenShown(page, 'tall-a')
  await scrolledTo(page, 400)
  await page.evaluate(() => history.forward())
  await screenShown(page, 'tall-b')
  await scrolledTo(page, 250)
})

test('a change of screen with an effect runs inside a view transition', async ({ page }) => {
  await motionDone(page)
  await page.click('scroll-showcase >>> #scroll-slide')
  await page.waitForSelector('scroll-showcase >>> #scroll imp-shell >>> main.main')
  await page.click('scroll-showcase >>> #scroll-start')
  await screenShown(page, 'tall-a')
  const sawTransition = await page.evaluate(() => {
    const original = document.startViewTransition.bind(document)
    globalThis.__impTransitions = 0
    document.startViewTransition = (update) => {
      globalThis.__impTransitions++
      return original(update)
    }
    return typeof original === 'function'
  })
  expect(sawTransition).toEqual(true)
  await clickInScreen(page, 'tall-a-next')
  await screenShown(page, 'tall-b')
  expect(await page.evaluate(() => globalThis.__impTransitions)).toEqual(1)
})
