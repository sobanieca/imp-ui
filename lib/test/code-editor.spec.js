import { expect, test } from 'imp/test'

const EDITOR = '#editor imp-code-editor'

const TEXTAREA = `${EDITOR} >>> textarea`

const MIRROR = `${EDITOR} >>> .mirror`

const valueOf = (page) => page.$eval(TEXTAREA, (node) => node.value)

const shownValue = (page) => page.$eval('#editor-value', (node) => node.textContent)

const selectionOf = (page) =>
  page.$eval(TEXTAREA, (node) => [node.selectionStart, node.selectionEnd])

const select = (page, start, end) =>
  page.$eval(TEXTAREA, (node, from, to) => node.setSelectionRange(from, to), start, end)

const reset = (page) =>
  page.$eval(TEXTAREA, (node) => {
    node.focus()
    node.select()
    document.execCommand('insertText', false, 'const a = 1\n  const b = 2')
  })

test('typing highlights the mirror and updates the bound state', async ({ page }) => {
  await reset(page)
  await select(page, 11, 11)
  await page.keyboard.type(' + 2')
  expect(await valueOf(page)).toEqual('const a = 1 + 2\n  const b = 2')
  expect(await shownValue(page)).toEqual('const a = 1 + 2\n  const b = 2')
  expect(await page.$eval(MIRROR, (node) => node.textContent)).toEqual(
    'const a = 1 + 2\n  const b = 2',
  )
  expect(
    await page.$$eval(`${MIRROR} .token-keyword`, (nodes) => nodes.map((node) => node.textContent)),
  ).toEqual(['const', 'const'])
})

test('the textarea text is transparent and the mirror sits on the same grid', async ({ page }) => {
  const layout = await page.$eval(EDITOR, (host) => {
    const textarea = host.shadowRoot.querySelector('textarea')
    const mirror = host.shadowRoot.querySelector('.mirror')
    const line = host.shadowRoot.querySelector('.line')
    const text = getComputedStyle(textarea)
    const shadow = getComputedStyle(mirror)
    const a = textarea.getBoundingClientRect()
    const b = mirror.getBoundingClientRect()
    return {
      transparent: text.color === 'rgba(0, 0, 0, 0)',
      caret: text.caretColor !== 'rgba(0, 0, 0, 0)',
      sameFont: text.fontFamily === shadow.fontFamily && text.fontSize === shadow.fontSize,
      sameBox: Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1,
      samePadding: text.paddingLeft === getComputedStyle(line).paddingLeft &&
        text.paddingTop === shadow.paddingTop,
      sameLineHeight: text.lineHeight === getComputedStyle(line).lineHeight,
      wholePixelRows: parseFloat(text.lineHeight) % 4 === 0 &&
        parseFloat(text.paddingTop) % 4 === 0,
    }
  })
  expect(layout).toEqual({
    transparent: true,
    caret: true,
    sameFont: true,
    sameBox: true,
    samePadding: true,
    sameLineHeight: true,
    wholePixelRows: true,
  })
})

test('Tab indents, Shift-Tab outdents, and the edit is undoable', async ({ page }) => {
  await reset(page)
  await select(page, 0, 0)
  await page.keyboard.press('Tab')
  expect(await valueOf(page)).toEqual('  const a = 1\n  const b = 2')
  expect(await selectionOf(page)).toEqual([2, 2])
  await page.keyboard.down('Control')
  await page.keyboard.press('z')
  await page.keyboard.up('Control')
  expect(await valueOf(page)).toEqual('const a = 1\n  const b = 2')
  await select(page, 0, 20)
  await page.keyboard.press('Tab')
  expect(await valueOf(page)).toEqual('  const a = 1\n    const b = 2')
  await page.keyboard.down('Shift')
  await page.keyboard.press('Tab')
  await page.keyboard.up('Shift')
  expect(await valueOf(page)).toEqual('const a = 1\n  const b = 2')
  expect(await selectionOf(page)).toEqual([0, 20])
})

test('Enter keeps the indentation of the line', async ({ page }) => {
  await reset(page)
  await select(page, 25, 25)
  await page.keyboard.press('Enter')
  expect(await valueOf(page)).toEqual('const a = 1\n  const b = 2\n  ')
  expect(await selectionOf(page)).toEqual([28, 28])
})

test('Escape then Tab reaches the copy button, and the next Tab leaves', async ({ page }) => {
  await reset(page)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Tab')
  expect(
    await page.evaluate(() => document.activeElement?.shadowRoot?.activeElement?.localName),
  ).toEqual('imp-code-editor')
  await page.keyboard.press('Tab')
  expect(
    await page.evaluate(() => document.activeElement?.shadowRoot?.activeElement?.id),
  ).toEqual('editor-after')
  expect(await valueOf(page)).toEqual('const a = 1\n  const b = 2')
})

test('the mirror follows the scroll of the textarea', async ({ page }) => {
  await page.$eval(TEXTAREA, (node) => {
    node.focus()
    node.select()
    const lines = Array.from({ length: 40 }, (_, index) => `const line${index} = ${index}`)
    document.execCommand('insertText', false, lines.join('\n'))
    node.scrollTop = 120
    node.dispatchEvent(new Event('scroll'))
  })
  const scrolled = await page.$eval(EDITOR, (host) => ({
    textarea: host.shadowRoot.querySelector('textarea').scrollTop,
    mirror: host.shadowRoot.querySelector('.mirror').scrollTop,
  }))
  expect(scrolled.textarea > 0).toEqual(true)
  expect(scrolled.mirror).toEqual(scrolled.textarea)
  await reset(page)
})

test('a numbered editor keeps the rail in view and insets the text by its width', async ({ page }) => {
  const host = '#numbered-editor imp-code-editor'
  const geometry = await page.$eval(host, (node) => {
    const textarea = node.shadowRoot.querySelector('textarea')
    const number = node.shadowRoot.querySelector('.number')
    const inset = Number.parseFloat(getComputedStyle(textarea).paddingInlineStart)
    const rail = number.getBoundingClientRect().width +
      Number.parseFloat(getComputedStyle(number).marginInlineEnd)
    return { inset, rail, numbers: node.shadowRoot.querySelectorAll('.number').length }
  })
  expect(geometry.numbers).toEqual(3)
  expect(Math.abs(geometry.inset - geometry.rail) < 1).toEqual(true)
  const scrolled = await page.$eval(host, (node) => {
    const textarea = node.shadowRoot.querySelector('textarea')
    const mirror = node.shadowRoot.querySelector('.mirror')
    const number = node.shadowRoot.querySelectorAll('.number')[1]
    const before = number.getBoundingClientRect().left - mirror.getBoundingClientRect().left
    textarea.scrollLeft = 120
    textarea.dispatchEvent(new Event('scroll'))
    const after = number.getBoundingClientRect().left - mirror.getBoundingClientRect().left
    return { before, after, synced: mirror.scrollLeft === textarea.scrollLeft }
  })
  expect(scrolled.synced).toEqual(true)
  expect(Math.round(scrolled.before)).toEqual(Math.round(scrolled.after))
})
