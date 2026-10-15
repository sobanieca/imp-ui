import { expect, test } from 'imp/test'

const BLOCK = '#code imp-code-block'

const PRE = `${BLOCK} >>> pre`

const CODE = `${BLOCK} >>> code`

const SOURCE = [
  '// a comment',
  "const greeting = 'hello'",
  'const long = greeting.repeat(40) + greeting.repeat(40) + greeting.repeat(40)',
  'export { greeting, long }',
].join('\n')

const colorOf = (page, selector) => page.$eval(selector, (node) => getComputedStyle(node).color)

test('a selection of the code gives the source back, without the line numbers', async ({
  page,
}) => {
  const selected = await page.$eval(CODE, (node) => {
    const range = document.createRange()
    range.selectNodeContents(node)
    const selection = getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    const text = selection.toString()
    selection.removeAllRanges()
    return text
  })
  expect(selected).toEqual(SOURCE)
})

test('the tokens are coloured from the theme, and a comment is set apart', async ({ page }) => {
  const plain = await colorOf(page, CODE)
  const keyword = await colorOf(page, `${BLOCK} >>> .token-keyword`)
  const comment = await colorOf(page, `${BLOCK} >>> .token-comment`)
  const string = await colorOf(page, `${BLOCK} >>> .token-string`)
  expect(keyword === plain).toEqual(false)
  expect(string === plain).toEqual(false)
  expect(string === keyword).toEqual(false)
  expect(
    await page.$eval(`${BLOCK} >>> .token-comment`, (node) => getComputedStyle(node).fontStyle),
  ).toEqual('italic')
  expect(comment === plain).toEqual(false)
})

test('long lines scroll sideways and the number rail stays in view', async ({ page }) => {
  const overflow = await page.$eval(PRE, (node) => node.scrollWidth > node.clientWidth)
  expect(overflow).toEqual(true)
  const before = await page.$eval(BLOCK, (host) => {
    const pre = host.shadowRoot.querySelector('pre')
    const number = host.shadowRoot.querySelectorAll('.number')[2]
    return number.getBoundingClientRect().left - pre.getBoundingClientRect().left
  })
  const after = await page.$eval(BLOCK, (host) => {
    const pre = host.shadowRoot.querySelector('pre')
    pre.scrollLeft = 200
    const number = host.shadowRoot.querySelectorAll('.number')[2]
    const offset = number.getBoundingClientRect().left - pre.getBoundingClientRect().left
    pre.scrollLeft = 0
    return offset
  })
  expect(Math.round(before)).toEqual(Math.round(after))
})

test('a click on a line number selects the line and writes it into the address', async ({
  page,
}) => {
  await page.click(`${BLOCK} >>> .number[data-line="2"]`)
  expect(await page.evaluate(() => location.hash)).toEqual('#demo-L2')
  const selected = await page.$eval(BLOCK, (host) =>
    [...host.shadowRoot.querySelectorAll('.line')].map((line) =>
      line.classList.contains('selected'),
    ),
  )
  expect(selected).toEqual([false, true, false, false])
  const highlighted = await page.$eval(
    `${BLOCK} >>> .line.selected`,
    (node) => getComputedStyle(node).backgroundColor,
  )
  expect(highlighted === 'rgba(0, 0, 0, 0)').toEqual(false)
  await page.keyboard.down('Shift')
  await page.click(`${BLOCK} >>> .number[data-line="4"]`)
  await page.keyboard.up('Shift')
  expect(await page.evaluate(() => location.hash)).toEqual('#demo-L2-L4')
  await page.evaluate(() => history.replaceState(null, '', location.pathname))
})

test('the copy button copies the whole source', async ({ page }) => {
  await page.evaluate(() => {
    globalThis.__impCopied = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text) => (globalThis.__impCopied.push(text), Promise.resolve()) },
    })
  })
  await page.click(`${BLOCK} >>> imp-button >>> button`)
  await page.waitForSelector(`${BLOCK} >>> [role="status"]:not(:empty)`)
  expect(await page.evaluate(() => globalThis.__impCopied)).toEqual([SOURCE])
  expect(
    await page.$eval(`${BLOCK} >>> imp-button >>> button`, (node) =>
      node.getAttribute('aria-label'),
    ),
  ).toEqual('Copied')
})
