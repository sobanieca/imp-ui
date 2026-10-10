import { expect, test } from 'imp/test'

const EDITOR = '#rich imp-rich-text-editor'

const AREA = `${EDITOR} >>> .area`

const tool = (id) => `${EDITOR} >>> .tool-${id}`

const shownValue = (page) => page.$eval('#rich-value', (node) => node.textContent)

const areaHtml = (page) => page.$eval(AREA, (node) => node.innerHTML)

const reset = (page, html) =>
  page.$eval(AREA, (node, content) => {
    node.innerHTML = content
    node.dispatchEvent(new Event('input', { bubbles: true }))
    node.focus()
  }, html)

const selectText = (page, text) =>
  page.$eval(AREA, (node, wanted) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    let found = walker.nextNode()
    while (found && !found.data.includes(wanted)) found = walker.nextNode()
    const start = found.data.indexOf(wanted)
    node.focus()
    getSelection().setBaseAndExtent(found, start, found, start + wanted.length)
  }, text)

const caretAtEnd = (page) =>
  page.$eval(AREA, (node) => {
    node.focus()
    getSelection().setBaseAndExtent(node, node.childNodes.length, node, node.childNodes.length)
  })

const pressed = (page, id) => page.$eval(tool(id), (node) => node.getAttribute('aria-pressed'))

const activeAttribute = (page, name) =>
  page.evaluate((attribute) => {
    let active = document.activeElement
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
    return active?.getAttribute(attribute) ?? null
  }, name)

test('typing commits markdown, and the bold tool wraps the selection', async ({ page }) => {
  await reset(page, '<p>Hello world</p>')
  await selectText(page, 'world')
  await page.click(tool('bold'))
  expect(await shownValue(page)).toEqual('Hello **world**')
  expect(await pressed(page, 'bold')).toEqual('true')
  await caretAtEnd(page)
  await page.keyboard.type(' again')
  expect(await shownValue(page)).toEqual('Hello **world again**')
})

test('the heading and list tools change the block, and Tab nests a list item', async ({ page }) => {
  await reset(page, '<p>Title</p>')
  await selectText(page, 'Title')
  await page.click(tool('heading2'))
  expect(await shownValue(page)).toEqual('## Title')
  expect(await pressed(page, 'heading2')).toEqual('true')
  await page.click(tool('heading2'))
  expect(await shownValue(page)).toEqual('Title')
  await reset(page, '<p>one</p>')
  await selectText(page, 'one')
  await page.click(tool('bullets'))
  expect(await shownValue(page)).toEqual('- one')
  await caretAtEnd(page)
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('two')
  await page.keyboard.press('Tab')
  expect(await shownValue(page)).toEqual('- one\n  - two')
  await page.keyboard.down('Shift')
  await page.keyboard.press('Tab')
  await page.keyboard.up('Shift')
  expect(await shownValue(page)).toEqual('- one\n- two')
})

test('Escape then Tab moves the focus out of a list', async ({ page }) => {
  await reset(page, '<ul><li>item</li></ul>')
  await selectText(page, 'item')
  await page.keyboard.press('End')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Tab')
  expect(
    await page.evaluate(() => document.activeElement?.shadowRoot?.activeElement?.id),
  ).toEqual('rich-after')
})

test('alignment tools write an aligned HTML block', async ({ page }) => {
  await reset(page, '<p>Middle</p>')
  await selectText(page, 'Middle')
  await page.click(tool('alignCenter'))
  expect(await shownValue(page)).toEqual('<p align="center">Middle</p>')
  expect(await pressed(page, 'alignCenter')).toEqual('true')
  await page.click(tool('alignEnd'))
  expect(await shownValue(page)).toEqual('<p align="right">Middle</p>')
  await page.click(tool('alignStart'))
  expect(await shownValue(page)).toEqual('Middle')
  expect(await pressed(page, 'alignStart')).toEqual('true')
})

test('the emoji panel inserts the picked emoji at the caret', async ({ page }) => {
  await reset(page, '<p>Hi</p>')
  await caretAtEnd(page)
  await page.click(tool('emoji'))
  expect(
    await page.$eval(tool('emoji'), (node) => node.getAttribute('aria-expanded')),
  ).toEqual('true')
  await page.click(`${EDITOR} >>> .emoji-choice`)
  expect(await shownValue(page)).toEqual(`Hi${String.fromCodePoint(0x1f600)}`)
})

test('the emoji search inserts the first match on Enter', async ({ page }) => {
  await reset(page, '<p>Hi</p>')
  await caretAtEnd(page)
  await page.click(tool('emoji'))
  await page.waitForSelector(`${EDITOR} >>> .panel-emoji:popover-open:focus-within`)
  await page.keyboard.type('rocket')
  await page.keyboard.press('Enter')
  expect(await shownValue(page)).toEqual(`Hi${String.fromCodePoint(0x1f680)}`)
})

test('the link panel applies a link to the selection and removes it again', async ({ page }) => {
  await reset(page, '<p>Read the docs</p>')
  await selectText(page, 'docs')
  await page.click(tool('link'))
  await page.waitForSelector(`${EDITOR} >>> .panel-link:popover-open:focus-within`)
  await page.keyboard.type('https://imp.dev/docs')
  await page.keyboard.press('Enter')
  expect(await shownValue(page)).toEqual('Read the [docs](https://imp.dev/docs)')
  expect(await pressed(page, 'link')).toEqual('true')
  await page.click(tool('link'))
  await page.waitForSelector(`${EDITOR} >>> .panel-link:popover-open:focus-within`)
  await page.click(`${EDITOR} >>> .panel-link .action:not(.primary)`)
  expect(await shownValue(page)).toEqual('Read the docs')
})

test('a pasted image shows a dimmed preview, then embeds resized as a data URL', async ({ page }) => {
  await reset(page, '<p>Photo:</p>')
  await selectText(page, 'Photo:')
  await page.keyboard.press('End')
  const placeholder = await page.$eval(AREA, async (node) => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 200
    canvas.getContext('2d').fillRect(0, 0, 400, 200)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    const transfer = new DataTransfer()
    transfer.items.add(new File([blob], 'shot.png', { type: 'image/png' }))
    node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true }))
    return node.querySelector('img[data-pending]')?.alt ?? null
  })
  expect(placeholder).toEqual('Adding image...')
  await page.keyboard.type(' typed')
  await page.waitForSelector(`${EDITOR} >>> .area img:not([data-pending])`)
  const image = await page.$eval(`${EDITOR} >>> .area img:not([data-pending])`, async (node) => {
    await node.decode()
    return {
      width: node.naturalWidth,
      height: node.naturalHeight,
      alt: node.alt,
      data: node.src.startsWith('data:image/png;base64,'),
    }
  })
  expect(image).toEqual({ width: 100, height: 50, alt: 'shot', data: true })
  const value = await shownValue(page)
  expect(value.startsWith('Photo:![shot](data:image/png;base64,')).toEqual(true)
  expect(value.endsWith(') typed')).toEqual(true)
  expect((await areaHtml(page)).includes('pending')).toEqual(false)
})

test('a HEIC photo that the browser cannot open stays as a message in place of the image', async ({ page }) => {
  await reset(page, '<p>Photo:</p>')
  await selectText(page, 'Photo:')
  await page.keyboard.press('End')
  await page.$eval(AREA, (node) => {
    const header = [0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0]
    const transfer = new DataTransfer()
    transfer.items.add(new File([new Uint8Array(header)], 'IMG_0001.HEIC', { type: '' }))
    node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true }))
  })
  await page.waitForSelector(`${EDITOR} >>> .area img.failed`)
  const failed = await page.$eval(`${EDITOR} >>> .area img.failed`, (node) => ({
    alt: node.alt,
    src: node.hasAttribute('src'),
  }))
  expect(failed).toEqual({
    alt:
      'This browser cannot open the HEIC photo IMG_0001.HEIC. Save it as a JPEG and add it again.',
    src: false,
  })
  expect(await shownValue(page)).toEqual('Photo:')
})

test('the toolbar is one tab stop with arrow keys between the tools', async ({ page }) => {
  await page.focus(tool('bold'))
  await page.keyboard.press('ArrowRight')
  expect(await activeAttribute(page, 'aria-label')).toEqual('Italic')
  await page.keyboard.press('End')
  expect(await activeAttribute(page, 'aria-label')).toEqual('Align end')
  await page.keyboard.press('Tab')
  expect(await activeAttribute(page, 'role')).toEqual('textbox')
})

test('the quote, code block and inline code tools toggle their formatting', async ({ page }) => {
  await reset(page, '<p>Wise words</p>')
  await selectText(page, 'Wise')
  await page.click(tool('quote'))
  expect(await shownValue(page)).toEqual('> Wise words')
  expect(await pressed(page, 'quote')).toEqual('true')
  await page.click(tool('quote'))
  expect(await shownValue(page)).toEqual('Wise words')
  await page.click(tool('codeBlock'))
  expect(await shownValue(page)).toEqual('```\nWise words\n```')
  expect(await pressed(page, 'codeBlock')).toEqual('true')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('more')
  expect(await shownValue(page)).toEqual('```\nWise words\nmore\n```')
  await page.click(tool('codeBlock'))
  expect(await pressed(page, 'codeBlock')).toEqual('false')
  expect(await shownValue(page)).toEqual('Wise words\n\nmore')
  await reset(page, '<p>Call run() now</p>')
  await selectText(page, 'run()')
  await page.click(tool('code'))
  expect(await shownValue(page)).toEqual('Call `run()` now')
  expect(await pressed(page, 'code')).toEqual('true')
  await selectText(page, 'run')
  await page.click(tool('code'))
  expect(await shownValue(page)).toEqual('Call run() now')
  expect(await pressed(page, 'code')).toEqual('false')
})

const pasteHtml = (page, html, text) =>
  page.$eval(
    AREA,
    (node, content, plain) => {
      const transfer = new DataTransfer()
      transfer.setData('text/html', content)
      transfer.setData('text/plain', plain)
      node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true }))
    },
    html,
    text,
  )

const undo = (page) =>
  page.keyboard.down('Control').then(() => page.keyboard.press('z'))
    .then(() => page.keyboard.up('Control'))

const redo = async (page) => {
  await page.keyboard.down('Control')
  await page.keyboard.down('Shift')
  await page.keyboard.press('z')
  await page.keyboard.up('Shift')
  await page.keyboard.up('Control')
}

test('pasted HTML shows only what the markdown value keeps', async ({ page }) => {
  await reset(page, '<p>Start</p>')
  await selectText(page, 'Start')
  await page.keyboard.press('End')
  await pasteHtml(
    page,
    '<style>p { color: red }</style><p><u>under</u> <span style="color: red">red</span> ' +
      '<b>bold</b></p><h2 style="font-size: 9px">Title</h2><table><tr><td>cell</td></tr></table>',
    'under red bold Title cell',
  )
  expect(await shownValue(page)).toEqual('Startunder red **bold**\n\n## Title\n\ncell')
  expect(await areaHtml(page)).toEqual(
    '<p>Startunder red <strong>bold</strong></p><h2>Title</h2><p>cell</p>',
  )
})

test('HTML pasted into a code block is plain text', async ({ page }) => {
  await reset(page, '<pre>x</pre>')
  await caretAtEnd(page)
  await selectText(page, 'x')
  await page.keyboard.press('End')
  await pasteHtml(page, '<b>bold</b>', 'bold')
  expect(await shownValue(page)).toEqual('```\nxbold\n```')
})

test('undo brings back a code block that the code block tool left', async ({ page }) => {
  await reset(page, '<p>Wise words</p>')
  await selectText(page, 'Wise')
  await page.click(tool('codeBlock'))
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('more')
  await page.click(tool('codeBlock'))
  expect(await shownValue(page)).toEqual('Wise words\n\nmore')
  await undo(page)
  await undo(page)
  expect(await shownValue(page)).toEqual('```\nWise words\nmore\n```')
  await redo(page)
  await redo(page)
  expect(await shownValue(page)).toEqual('Wise words\n\nmore')
})

test('undo removes an added image, and redo brings it back', async ({ page }) => {
  await reset(page, '<p>Photo:</p>')
  await selectText(page, 'Photo:')
  await page.keyboard.press('End')
  await page.$eval(AREA, async (node) => {
    const canvas = document.createElement('canvas')
    canvas.width = 40
    canvas.height = 20
    canvas.getContext('2d').fillRect(0, 0, 40, 20)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    const transfer = new DataTransfer()
    transfer.items.add(new File([blob], 'shot.png', { type: 'image/png' }))
    node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true }))
  })
  await page.waitForSelector(`${EDITOR} >>> .area img:not([data-pending])`)
  expect((await shownValue(page)).startsWith('Photo:![shot](data:image/png;base64,')).toEqual(true)
  await undo(page)
  expect(await shownValue(page)).toEqual('Photo:')
  expect(await page.$eval(AREA, (node) => node.querySelector('img'))).toEqual(null)
  await redo(page)
  expect((await shownValue(page)).startsWith('Photo:![shot](data:image/png;base64,')).toEqual(true)
})

const MANY_BLOCKS = '<p>one</p><ul><li>two</li><li>three</li></ul><p>four</p>'

const typeAfter = async (page, text, typed) => {
  await selectText(page, text)
  await page.keyboard.press('End')
  await page.keyboard.type(typed)
}

test('the value is exact at once after typing in one block of many', async ({ page }) => {
  await reset(page, MANY_BLOCKS)
  await typeAfter(page, 'three', ' 3')
  expect(await shownValue(page)).toEqual('one\n\n- two\n- three 3\n\nfour')
  await typeAfter(page, 'one', '!')
  expect(await shownValue(page)).toEqual('one!\n\n- two\n- three 3\n\nfour')
  await page.keyboard.press('Enter')
  await page.keyboard.type('new')
  expect(await shownValue(page)).toEqual('one!\n\nnew\n\n- two\n- three 3\n\nfour')
})

test('the value is exact after a paste into one block of many', async ({ page }) => {
  await reset(page, MANY_BLOCKS)
  await selectText(page, 'two')
  await page.keyboard.press('End')
  await pasteHtml(page, '<b>bold</b>', 'bold')
  expect(await shownValue(page)).toEqual('one\n\n- two**bold**\n- three\n\nfour')
  await typeAfter(page, 'four', '!')
  expect(await shownValue(page)).toEqual('one\n\n- two**bold**\n- three\n\nfour!')
})

test('the value is exact after an image lands in one block of many', async ({ page }) => {
  await reset(page, MANY_BLOCKS)
  await selectText(page, 'one')
  await page.keyboard.press('End')
  await page.$eval(AREA, async (node) => {
    const canvas = document.createElement('canvas')
    canvas.width = 40
    canvas.height = 20
    canvas.getContext('2d').fillRect(0, 0, 40, 20)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    const transfer = new DataTransfer()
    transfer.items.add(new File([blob], 'shot.png', { type: 'image/png' }))
    node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true }))
  })
  await page.waitForSelector(`${EDITOR} >>> .area img:not([data-pending])`)
  const source = await page.$eval(`${EDITOR} >>> .area img`, (node) => node.getAttribute('src'))
  expect(await shownValue(page)).toEqual(`one![shot](${source})\n\n- two\n- three\n\nfour`)
  await typeAfter(page, 'four', '!')
  expect(await shownValue(page)).toEqual(`one![shot](${source})\n\n- two\n- three\n\nfour!`)
})

test('the value is exact after undo in a document of many blocks', async ({ page }) => {
  await reset(page, MANY_BLOCKS)
  await typeAfter(page, 'two', 'x')
  expect(await shownValue(page)).toEqual('one\n\n- twox\n- three\n\nfour')
  await undo(page)
  expect(await shownValue(page)).toEqual('one\n\n- two\n- three\n\nfour')
  await typeAfter(page, 'four', 'y')
  expect(await shownValue(page)).toEqual('one\n\n- two\n- three\n\nfoury')
  await undo(page)
  await redo(page)
  expect(await shownValue(page)).toEqual('one\n\n- two\n- three\n\nfoury')
})
