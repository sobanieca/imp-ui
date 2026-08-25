import { expect, test } from 'imp/test'

const TRIGGER = '#bugs imp-bug-report >>> .trigger >>> button'
const OUTLINE = '#bugs imp-bug-report >>> .outline'
const PANEL = '#bugs imp-bug-report >>> .panel'
const FIELD = '#bugs imp-bug-report >>> textarea'
const SEND = '#bugs imp-bug-report >>> .send >>> button'
const HINT = '#bugs imp-bug-report >>> .hint'

const hidden = (page, selector) => page.$eval(selector, (node) => node.hidden)

const boxOf = (page, selector) =>
  page.$eval(selector, (node) => {
    const { top, left, width, height } = node.getBoundingClientRect()
    return [top, left, width, height].map(Math.round)
  })

test('bugReport outlines the element under the pointer and keeps it outlined while commenting', async ({ page }) => {
  await page.click(TRIGGER)
  expect(await hidden(page, HINT)).toEqual(false)

  const target = await page.$('#bugs #faulty')
  await target.hover()
  expect(await hidden(page, OUTLINE)).toEqual(false)
  expect(await boxOf(page, OUTLINE)).toEqual(await boxOf(page, '#bugs #faulty'))

  await target.click()
  expect(await page.$eval(PANEL, (node) => node.open)).toEqual(true)
  expect(await hidden(page, HINT)).toEqual(true)
  expect(await hidden(page, OUTLINE)).toEqual(false)
  expect(await page.$eval(PANEL, (node) => node.textContent)).not.toContain('>>')
})

test('bugReport hands onSubmit the comment and what was on the screen', async ({ page }) => {
  await page.type('#bugs #note', 'typed but never in the markup')
  await page.click(TRIGGER)
  await (await page.$('#bugs #faulty')).click()
  await page.type(FIELD, 'this text is unreadable')
  await page.click(SEND)
  await page.waitForFunction(() => globalThis.__impBugReport)

  const report = JSON.parse(await page.evaluate(() => globalThis.__impBugReport))
  expect(report.comment).toEqual('this text is unreadable')
  expect(report.element.text).toEqual('the faulty bit')
  expect(report.element.path).toContain('span#faulty')
  expect(report.element.path).toContain('>>')
  expect(report.dir).toEqual('ltr')
  expect(report.scheme).toEqual('light')

  const screen = report.state.find(({ name }) => name === 'bug.screen')
  expect(screen.value).toEqual({ step: 'checkout', retries: 2 })

  expect(await page.$eval(PANEL, (node) => node.open)).toEqual(false)
  expect(await hidden(page, OUTLINE)).toEqual(true)
})

test('bugReport records live control values the markup does not carry', async ({ page }) => {
  await page.evaluate(() => delete globalThis.__impBugReport)
  await page.click(TRIGGER)
  await (await page.$('#bugs #note')).click()
  await page.type(FIELD, 'the note field loses what I type')
  await page.click(SEND)
  await page.waitForFunction(() => globalThis.__impBugReport)

  const report = JSON.parse(await page.evaluate(() => globalThis.__impBugReport))
  expect(report.element.html).not.toContain('typed but never in the markup')
  expect(report.controls).toEqual([
    {
      name: 'input[name=note]',
      value: 'typed but never in the markup',
      disabled: false,
      readOnly: false,
    },
  ])
})

test('bugReport cancels picking on Escape without opening the panel', async ({ page }) => {
  await page.click(TRIGGER)
  expect(await hidden(page, HINT)).toEqual(false)
  await page.keyboard.press('Escape')
  expect(await hidden(page, HINT)).toEqual(true)
  expect(await hidden(page, OUTLINE)).toEqual(true)
  expect(await page.$eval(PANEL, (node) => node.open)).toEqual(false)
})

test('bugReport puts focus back on the trigger when the panel closes', async ({ page }) => {
  await page.evaluate(() => delete globalThis.__impBugReport)
  await page.click(TRIGGER)
  await (await page.$('#bugs #faulty')).click()
  await page.type(FIELD, 'focus should come back')
  expect(await page.$eval(FIELD, (node) => node.matches(':focus'))).toEqual(true)

  await page.click(SEND)
  await page.waitForFunction(() => globalThis.__impBugReport)
  expect(await page.$eval(TRIGGER, (node) => node.matches(':focus'))).toEqual(true)
})

test('bugReport puts focus back on the trigger when commenting is abandoned', async ({ page }) => {
  await page.click(TRIGGER)
  await (await page.$('#bugs #faulty')).click()
  expect(await page.$eval(FIELD, (node) => node.matches(':focus'))).toEqual(true)

  await page.keyboard.press('Escape')
  expect(await page.$eval(PANEL, (node) => node.open)).toEqual(false)
  expect(await page.$eval(TRIGGER, (node) => node.matches(':focus'))).toEqual(true)
})
