import { expect, test } from 'imp/test'

const FIRST_NAME = '#forms imp-form >>> imp-text-field >>> #control'
const TERMS = '#forms imp-form >>> imp-checkbox >>> #control'
const ERROR = '#forms imp-form >>> imp-checkbox >>> .error'
const SUBMIT = '#forms imp-form >>> imp-button >>> button'

const submitted = (page) => page.evaluate(() => globalThis.__impSubmitted ?? null)

const textOf = (page, selector) => page.$eval(selector, (node) => node.textContent)

test('a required checkbox blocks submit and shows its message', async ({ page }) => {
  await page.click(SUBMIT)
  expect(await submitted(page)).toEqual(null)
  expect(await textOf(page, ERROR)).toEqual('This field is required')
})

test('typing and choosing land in the form state, then submit carries them', async ({ page }) => {
  await page.click(FIRST_NAME, { clickCount: 3 })
  await page.type(FIRST_NAME, 'Grace')
  await page.click(TERMS)
  await page.click(SUBMIT)
  const values = JSON.parse(await submitted(page))
  expect(values.user.firstName).toEqual('Grace')
  expect(values.terms).toEqual(true)
  expect(values.plan).toEqual('pro')
})

test('a field is reachable and operable from the keyboard alone', async ({ page }) => {
  await page.click(FIRST_NAME, { clickCount: 3 })
  await page.keyboard.type('Katherine')
  const named = await page.$eval(
    FIRST_NAME,
    (node) => node.labels?.[0]?.textContent ?? node.getAttribute('aria-label'),
  )
  expect(named).toContain('First name')
  expect(await page.$eval(FIRST_NAME, (node) => node.value)).toEqual('Katherine')
})

test('Enter in a single-line field submits the form', async ({ page }) => {
  await page.click(TERMS)
  await page.click(FIRST_NAME)
  await page.keyboard.press('Enter')
  expect(await submitted(page)).not.toEqual(null)
})

test('the swatch of a colour picker is as tall as its text input', async ({ page }) => {
  const heightOf = (selector) =>
    page.$eval(selector, (node) => Math.round(node.getBoundingClientRect().height))
  const input = await heightOf('#a11y-color imp-color-picker >>> #control')
  const swatch = await heightOf('#a11y-color imp-color-picker >>> .swatch')
  expect(input).toBeGreaterThan(0)
  expect(swatch).toEqual(input)
})

test('every single-line control is as tall as a button of the same size', async ({ page }) => {
  const heights = await page.$$eval(
    '#control-heights imp-flex >>> .root > *',
    (hosts) =>
      hosts.map((host) => {
        const boxes = [...host.shadowRoot.querySelectorAll('button, input, select, .frame')]
          .filter((node) => node.checkVisibility())
        return [
          host.localName,
          Math.round(Math.max(...boxes.map((node) => node.getBoundingClientRect().height))),
        ]
      }),
  )
  expect(heights.length).toEqual(9)
  expect(heights[0][1]).toBeGreaterThan(0)
  expect(heights.map(([, height]) => height)).toEqual(heights.map(() => heights[0][1]))
})

test('every field label sits the same distance above its control', async ({ page }) => {
  const gaps = await page.$$eval(
    '#control-heights imp-flex >>> .root > *',
    (hosts) =>
      hosts.flatMap((host) => {
        const label = host.shadowRoot.getElementById('label')
        const control = [...host.shadowRoot.querySelectorAll('button, input, select, .frame')]
          .find((node) => node.checkVisibility())
        if (!label || !control) return []
        const gap = control.getBoundingClientRect().top - label.getBoundingClientRect().bottom
        return [[host.localName, Math.round(gap)]]
      }),
  )
  expect(gaps.map(([name]) => name)).toContain('imp-segmented')
  expect(gaps[0][1]).toBeGreaterThan(0)
  expect(gaps).toEqual(gaps.map(([name]) => [name, gaps[0][1]]))
})

test('a failed submit shows its message in an alert above the button', async ({ page }) => {
  const notice = '#failing-form imp-form >>> imp-notice'
  const hidden = () =>
    page.$eval(`${notice} >>> .root`, (node) => node.classList.contains('closed'))
  expect(await hidden()).toEqual(true)
  await page.$eval('#failing-form imp-form >>> imp-button >>> button', (node) => node.click())
  await page.waitForSelector(`${notice} >>> .root:not(.closed)`)
  const alert = await page.accessibility.snapshot({
    root: await page.$(`${notice} >>> [role="alert"]`),
    interestingOnly: false,
  })
  expect(alert.role).toEqual('alert')
  expect(JSON.stringify(alert)).toContain('The server did not answer')
  const noticeTop = await page.$eval(
    notice,
    (node) => node.shadowRoot.querySelector('.root').getBoundingClientRect().top,
  )
  const buttonTop = await page.$eval(
    '#failing-form imp-form >>> imp-button >>> button',
    (node) => node.getBoundingClientRect().top,
  )
  expect(noticeTop < buttonTop).toBeTruthy()
})
