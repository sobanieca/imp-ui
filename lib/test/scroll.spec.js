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
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )

const motionDone = (page) =>
  page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
  )

const clickInScreen = (page, id) =>
  page.evaluate((wanted) => {
    const frame = document.querySelector('scroll-showcase').shadowRoot
    const main = frame.querySelector('#scroll imp-shell').shadowRoot.querySelector('main.main')
    main
      .querySelector('imp-router')
      .shadowRoot.querySelector('imp-route')
      .shadowRoot.querySelector(`#${wanted}`)
      .click()
  }, id)

test('the shell scrolls its content area to the top on a push and back to its place on a back', async ({
  page,
}) => {
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

const SHELL = 'scroll-showcase >>> #scroll imp-shell >>> .shell'

// A click by the element, not by its point: the bar of the shell moves while it slides.
const startScreen = (page) =>
  page.$eval('scroll-showcase >>> #scroll-start', (button) => button.click())

const barTucked = (page) => page.$eval(SHELL, (shell) => shell.classList.contains('bar-tucked'))

const tucked = (page) =>
  page.waitForFunction(() => {
    const frame = document.querySelector('scroll-showcase').shadowRoot
    const shell = frame.querySelector('#scroll imp-shell').shadowRoot.querySelector('.shell')
    return shell.classList.contains('bar-tucked')
  })

const scrollMainTo = async (page, top) => {
  await page.$eval(MAIN, (main, wanted) => main.scrollTo({ top: wanted }), top)
  await settled(page)
}

const barSettled = (page) =>
  page.evaluate(async () => {
    const frame = document.querySelector('scroll-showcase').shadowRoot
    const bar = frame.querySelector('#scroll imp-shell').shadowRoot.querySelector('.topbar')
    await Promise.all(bar.getAnimations().map((animation) => animation.finished.catch(() => {})))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })

// Where the bottom edge of the top bar is, measured from the top edge of the frame.
// A slide of the bar from the spec before ends first, so the scroll of this spec counts.
const barIdle = (page) => page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 400)))

const barBottom = (page) =>
  page.$eval(SHELL, (shell) =>
    Math.round(
      shell.querySelector('.topbar').getBoundingClientRect().bottom
        - shell.getBoundingClientRect().top,
    ),
  )

test('on a phone the top bar slides away on a scroll down and comes back on a scroll up', async ({
  page,
}) => {
  await page.setViewport({ width: 420, height: 720 })
  await startScreen(page)
  await screenShown(page, 'tall-a')
  await scrolledTo(page, 0)
  await barIdle(page)
  expect(await barTucked(page)).toEqual(false)
  await scrollMainTo(page, 200)
  await tucked(page)
  await barSettled(page)
  expect((await barBottom(page)) <= 0).toEqual(true)
  await scrollMainTo(page, 120)
  expect(await barTucked(page)).toEqual(false)
  await barSettled(page)
  expect((await barBottom(page)) > 0).toEqual(true)
  await scrollMainTo(page, 300)
  await barSettled(page)
  await scrollMainTo(page, 0)
  expect(await barTucked(page)).toEqual(false)
})

test('the top bar of a phone comes back when its control takes focus', async ({ page }) => {
  await page.setViewport({ width: 420, height: 720 })
  await startScreen(page)
  await screenShown(page, 'tall-a')
  await scrolledTo(page, 0)
  await barIdle(page)
  await scrollMainTo(page, 200)
  await tucked(page)
  await barSettled(page)
  await page.$eval(`${SHELL} .hamburger`, (button) => button.focus())
  expect(await barTucked(page)).toEqual(false)
})

test('on a desktop the top bar stays while the content scrolls', async ({ page }) => {
  await page.setViewport({ width: 1100, height: 720 })
  await startScreen(page)
  await screenShown(page, 'tall-a')
  await settled(page)
  await scrollMainTo(page, 200)
  expect(await barTucked(page)).toEqual(false)
})
