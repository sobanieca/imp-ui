import { expect, test } from 'imp/test'

const FIRST_NAME = '>>> #forms imp-form >>> imp-text-field >>> #control'
const TERMS = '>>> #forms imp-form >>> imp-checkbox >>> #control'
const ERROR = '>>> #forms imp-form >>> imp-checkbox >>> .error'
const SUBMIT = '>>> #forms imp-form >>> imp-submit-button >>> imp-button >>> button'

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
