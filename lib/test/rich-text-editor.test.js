import { component, mount } from 'imp'
import { button } from 'imp/std'
import { form, richTextEditor, submitForm } from 'imp/std/inputs'
import { initState, useState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const area = (host) => inner(host, '.area')

const tools = (host) => [...host.shadowRoot.querySelectorAll('.tool')]

const input = (node) => node.dispatchEvent(new Event('input', { bubbles: true }))

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const PIXEL = 'data:image/png;base64,iVBORw0KGgo'

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const stateHost = component('rich-text-state-host', { setup: (self, render) => render(self) })

const editorWith = (markdown) => {
  let value
  const root = mounted(
    stateHost((self) => {
      value = initState(self, 'rich.value', markdown)
      return richTextEditor({ value, label: 'Body' })
    }),
  )
  return { editor: root.shadowRoot.querySelector('imp-rich-text-editor'), value }
}

const roundTrip = (markdown) => {
  const { editor, value } = editorWith(markdown)
  input(area(editor))
  return value.get()
}

beforeEach(() => {
  document.body.replaceChildren()
})

test('richTextEditor renders a labelled editable text box under a toolbar', () => {
  const host = mounted(richTextEditor({ value: 'Hello', label: 'Body', help: 'Markdown' }))
  expect(host.localName).toEqual('imp-rich-text-editor')
  const box = area(host)
  expect(box.getAttribute('contenteditable')).toEqual('true')
  expect(box.getAttribute('role')).toEqual('textbox')
  expect(box.getAttribute('aria-multiline')).toEqual('true')
  expect(box.getAttribute('aria-labelledby')).toEqual(inner(host, 'label').id)
  expect(box.innerHTML).toEqual('<p>Hello</p>')
  const toolbar = inner(host, '[role="toolbar"]')
  expect(toolbar.getAttribute('aria-controls')).toEqual(box.id)
  expect(toolbar.getAttribute('aria-label')).toEqual('Formatting')
  const described = box.getAttribute('aria-describedby').split(' ')
  expect(described.includes(inner(host, '.help').id)).toEqual(true)
  expect(described.includes(inner(host, '.keys').id)).toEqual(true)
  const picker = inner(host, 'input[type="file"]')
  expect(picker.getAttribute('accept')).toEqual('image/*,.heic,.heif')
  expect(picker.multiple).toEqual(true)
})

test('every tool is a named button, and only the first one is in the tab order', () => {
  const host = mounted(richTextEditor({ value: '', label: 'Body' }))
  const buttons = tools(host)
  expect(buttons.length).toEqual(17)
  expect(buttons.every((button) => button.getAttribute('aria-label') !== '')).toEqual(true)
  expect(buttons.map((button) => button.getAttribute('tabindex'))).toEqual([
    '0',
    ...Array(16).fill('-1'),
  ])
  expect(inner(host, '.tool-bold').getAttribute('aria-label')).toEqual('Bold')
  expect(inner(host, '.tool-link').getAttribute('aria-haspopup')).toEqual('dialog')
  expect(inner(host, '.tool-emoji').getAttribute('aria-expanded')).toEqual('false')
})

test('markdown renders as rich content, and the content writes back as the same markdown', () => {
  const markdown = [
    '# Title',
    '',
    'Some **bold**, _italic_, ~~struck~~ and `code` with a [link](https://imp.dev).',
    '',
    '> A quote',
    '',
    '- one',
    '- two',
    '  - nested',
    '',
    '1. first',
    '2. second',
    '',
    '```js',
    'const a = 1',
    '```',
    '',
    '---',
    '',
    '![photo](data:image/png;base64,AAAA)',
  ].join('\n')
  const { editor, value } = editorWith(markdown)
  const box = area(editor)
  expect(box.querySelector('h1').textContent).toEqual('Title')
  expect(box.querySelector('strong').textContent).toEqual('bold')
  expect(box.querySelector('em').textContent).toEqual('italic')
  expect(box.querySelector('s').textContent).toEqual('struck')
  expect(box.querySelector('code').textContent).toEqual('code')
  expect(box.querySelector('a').getAttribute('href')).toEqual('https://imp.dev')
  expect(box.querySelector('blockquote').textContent).toEqual('A quote')
  expect(box.querySelector('ul > li > ul > li').textContent).toEqual('nested')
  expect(box.querySelectorAll('ol > li').length).toEqual(2)
  expect(box.querySelector('pre').textContent).toEqual('const a = 1')
  expect(box.querySelector('pre').dataset.language).toEqual('js')
  expect(box.querySelector('hr')).toBeTruthy()
  expect(box.querySelector('img').getAttribute('alt')).toEqual('photo')
  input(box)
  expect(value.get()).toEqual(markdown)
})

test('an aligned paragraph is written as HTML, and it reads back aligned', () => {
  const markdown =
    '<p align="center"><strong>Centred</strong> text</p>\n\n<h2 align="right">End</h2>'
  const { editor, value } = editorWith(markdown)
  const box = area(editor)
  expect(box.querySelector('p').style.textAlign).toEqual('center')
  expect(box.querySelector('p strong').textContent).toEqual('Centred')
  expect(box.querySelector('h2').style.textAlign).toEqual('right')
  input(box)
  expect(value.get()).toEqual(markdown)
})

test('special characters in the text are escaped, so they stay text', () => {
  const { editor, value } = editorWith('')
  const box = area(editor)
  box.replaceChildren()
  const paragraph = document.createElement('p')
  paragraph.textContent = '# not a heading, 2 * 3 = 6, a_b, [x] <tag>'
  box.append(paragraph)
  input(box)
  expect(value.get()).toEqual('\\# not a heading, 2 \\* 3 = 6, a\\_b, \\[x\\] \\<tag>')
  expect(roundTrip(value.get())).toEqual(value.get())
  const { editor: again } = editorWith(value.get())
  expect(area(again).textContent).toEqual('# not a heading, 2 * 3 = 6, a_b, [x] <tag>')
})

test('a hard line break is a backslash, and inline HTML from a paste is normalized', () => {
  const { editor, value } = editorWith('')
  const box = area(editor)
  box.innerHTML =
    '<div>first<br>second</div><div><b>bold</b> <i>it</i> <span style="font-weight: bold">heavy</span>&nbsp;end</div>'
  input(box)
  expect(value.get()).toEqual('first\\\nsecond\n\n**bold** _it_ **heavy** end')
})

const messageWith = (markdown) => {
  let value
  const root = mounted(
    stateHost((self) => {
      value = initState(self, 'rich.value', markdown)
      return richTextEditor({ value, label: 'Message', format: 'message' })
    }),
  )
  return { editor: root.shadowRoot.querySelector('imp-rich-text-editor'), value }
}

const labels = (host) => tools(host).map((tool) => tool.getAttribute('aria-label'))

const groupSizes = (host) =>
  [...host.shadowRoot.querySelectorAll('.group')].map((group) => group.children.length)

test('a message editor offers bold, italic, strikethrough, link and emoji, and no list hint', () => {
  const { editor } = messageWith('')
  expect(labels(editor)).toEqual(['Bold', 'Italic', 'Strikethrough', 'Link', 'Emoji'])
  expect(inner(editor, '.keys')).toEqual(null)
  expect(area(editor).hasAttribute('aria-describedby')).toEqual(false)
})

test('tools picks the buttons of the toolbar in its order, grouping neighbours of one kind', () => {
  const host = mounted(
    richTextEditor({ value: '', label: 'Body', tools: ['link', 'bold', 'italic', 'bullets'] }),
  )
  expect(labels(host)).toEqual(['Link', 'Bold', 'Italic', 'Bulleted list'])
  expect(groupSizes(host)).toEqual([1, 2, 1])
  expect(tools(host).map((tool) => tool.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1'])
})

test('tools leaves out an unknown tool, a tool the format lacks and a repeated tool', () => {
  const warn = warnings()
  const host = mounted(
    richTextEditor({
      value: '',
      label: 'Message',
      format: 'message',
      tools: ['bold', 'underline', 'heading1', 'bold', 'emoji'],
    }),
  )
  expect(labels(host)).toEqual(['Bold', 'Emoji'])
  expect(warned(warn, "unknown tool 'underline'")).toEqual(true)
  expect(warned(warn, "the 'message' format has no 'heading1' tool")).toEqual(true)
  expect(warned(warn, "the tool 'bold' is listed twice")).toEqual(true)
})

test('tools that is not an array shows every tool, and an empty one hides the toolbar', () => {
  const warn = warnings()
  const every = mounted(richTextEditor({ value: '', label: 'Body', tools: 'bold' }))
  expect(tools(every).length).toEqual(17)
  expect(warned(warn, "'tools' must be an array of tool ids")).toEqual(true)
  const none = mounted(richTextEditor({ value: '', label: 'Body', tools: [] }))
  expect(tools(none).length).toEqual(0)
  expect(inner(none, '[role="toolbar"]').hidden).toEqual(true)
})

test('without the image tool, a pasted image file is dropped', () => {
  const host = mounted(richTextEditor({ value: 'Photo:', label: 'Body', tools: ['bold'] }))
  const transfer = new DataTransfer()
  transfer.items.add(new File(['x'], 'shot.png', { type: 'image/png' }))
  const paste = new ClipboardEvent('paste', {
    clipboardData: transfer,
    bubbles: true,
    cancelable: true,
  })
  area(host).dispatchEvent(paste)
  expect(paste.defaultPrevented).toEqual(true)
  expect(area(host).querySelector('img')).toEqual(null)
})

test('a message editor writes only its marks, and every other block as a paragraph', () => {
  const { editor, value } = messageWith('')
  const box = area(editor)
  box.innerHTML =
    '<h1>Title</h1><p><b>bold</b> <i>it</i> <s>gone</s> <code>tick</code> <img src="/a.png" alt="a">'
    + '<a href="https://example.com/pricing">pricing</a> <a href="javascript:alert(1)">bad</a></p>'
    + '<ul><li>one</li><li>two</li></ul><blockquote>quoted</blockquote><pre>line 1\nline 2</pre><hr>'
  input(box)
  expect(value.get()).toEqual(
    'Title\n\n**bold** _it_ ~~gone~~ tick [pricing](https://example.com/pricing) bad\n\n'
      + 'one\n\ntwo\n\nquoted\n\nline 1\\\nline 2',
  )
})

test('a message editor shows the markdown of a document as text, and keeps it as typed', () => {
  const { editor, value } = messageWith('# not a heading\n**bold** `tick`')
  const box = area(editor)
  expect(box.querySelector('h1')).toEqual(null)
  expect(box.querySelector('strong').textContent).toEqual('bold')
  input(box)
  expect(value.get()).toEqual('# not a heading\\\n**bold** \\`tick\\`')
})

test('a link or an image with a script address is dropped', () => {
  const { editor } = editorWith('[x](javascript:alert(1)) ![y](javascript:alert(1)) [ok](/docs)')
  const box = area(editor)
  expect(box.querySelectorAll('a').length).toEqual(1)
  expect(box.querySelector('a').getAttribute('href')).toEqual('/docs')
  expect(box.querySelector('img')).toEqual(null)
  expect(box.textContent).toEqual('x y ok')
})

test('a pasted link with a script address keeps only its text in the markdown', () => {
  const { editor, value } = editorWith('')
  const box = area(editor)
  box.innerHTML =
    '<p><a href="javascript:alert(1)">bad</a> <a href="https://imp.dev">good</a> <a>bare</a></p>'
  input(box)
  expect(value.get()).toEqual('bad [good](https://imp.dev) bare')
})

test('an image with no address or an unsafe address is left out of the markdown', () => {
  const { editor, value } = editorWith('')
  const box = area(editor)
  box.innerHTML =
    '<p>a <img alt="none"> b <img src="javascript:alert(1)" alt="bad"> c</p>'
    + '<p><img src="/pic.png" alt="ok"> <img src="data:image/png;base64,AA" alt="data"></p>'
    + '<p><img src="data:text/html,x" alt="html"> <img src="blob:https://imp.dev/1" alt="blob"></p>'
    + '<p align="center"><img alt="bare"> <img src="javascript:x" alt="bad"> <img src="/c.png" alt="c"></p>'
  input(box)
  expect(value.get()).toEqual(
    'a  b  c\n\n![ok](/pic.png) ![data](data:image/png;base64,AA)\n\n'
      + '<p align="center"><img src="/c.png" alt="c"></p>',
  )
})

test('a pending image is left out of the markdown', () => {
  const { editor, value } = editorWith('Before')
  const box = area(editor)
  const pending = document.createElement('span')
  pending.setAttribute('data-pending', '')
  pending.textContent = 'Adding image...'
  box.querySelector('p').append(' ', pending, ' after')
  input(box)
  expect(value.get()).toEqual('Before  after')
})

test('an empty editor keeps one paragraph and shows the placeholder', () => {
  const host = mounted(richTextEditor({ value: '', label: 'Body', placeholder: 'Write here' }))
  const box = area(host)
  expect(box.innerHTML).toEqual('<p><br></p>')
  expect(box.hasAttribute('data-empty')).toEqual(true)
  expect(box.getAttribute('data-placeholder')).toEqual('Write here')
})

test('a change of the state from outside re-renders the content', () => {
  const { editor, value } = editorWith('one')
  value.set('## two')
  expect(area(editor).innerHTML).toEqual('<h2>two</h2>')
})

test('richTextEditor binds to a form field', () => {
  let values
  const reader = component('rich-text-reader', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(
    form(
      { initialValues: { body: 'Hi' } },
      richTextEditor({ field: 'body', label: 'Body' }),
      reader(),
    ),
  )
  const editor = host.shadowRoot.querySelector('imp-rich-text-editor')
  const box = area(editor)
  expect(box.innerHTML).toEqual('<p>Hi</p>')
  box.querySelector('p').textContent = 'Hi there'
  input(box)
  expect(values.get()).toEqual({ body: 'Hi there' })
})

test('a form submits the exact value right after an edit in one block of many', () => {
  const submitted = []
  const host = mounted(
    form(
      {
        initialValues: { body: 'one\n\ntwo\n\nthree' },
        onSubmit: (values) => submitted.push(values),
      },
      richTextEditor({ field: 'body', label: 'Body' }),
      button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    ),
  )
  const box = area(host.shadowRoot.querySelector('imp-rich-text-editor'))
  input(box)
  box.children[1].firstChild.appendData(' more')
  input(box)
  click(inner(host.shadowRoot.querySelector('imp-button'), 'button'))
  expect(submitted).toEqual([{ body: 'one\n\ntwo more\n\nthree' }])
})

test('an edit anywhere inside a block writes that block again', async () => {
  const { editor, value } = editorWith('one\n\n- two\n  - three\n\nfour')
  const box = area(editor)
  input(box)
  box.querySelector('li li').firstChild.appendData('!')
  input(box)
  expect(value.get()).toEqual('one\n\n- two\n  - three!\n\nfour')
  box.querySelector('p').style.textAlign = 'center'
  input(box)
  expect(value.get()).toEqual('<p align="center">one</p>\n\n- two\n  - three!\n\nfour')
  box.append(box.querySelector('ul'))
  input(box)
  expect(value.get()).toEqual('<p align="center">one</p>\n\nfour\n\n- two\n  - three!')
  box.querySelector('li').firstChild.appendData('?')
  await Promise.resolve()
  input(box)
  expect(value.get()).toEqual('<p align="center">one</p>\n\nfour\n\n- two?\n  - three!')
})

test('a changed image address writes its block again', () => {
  const { editor, value } = editorWith(`![pic](${PIXEL}) caption\n\ntext`)
  const box = area(editor)
  input(box)
  box.querySelector('img').setAttribute('src', '/other.png')
  input(box)
  expect(value.get()).toEqual('![pic](/other.png) caption\n\ntext')
})

test('a change of direction writes every block again', () => {
  const { editor, value } = editorWith('<p align="right">one</p>\n\ntwo')
  const box = area(editor)
  input(box)
  expect(value.get()).toEqual('<p align="right">one</p>\n\ntwo')
  box.style.direction = 'rtl'
  box.children[1].firstChild.appendData('!')
  input(box)
  expect(value.get()).toEqual('one\n\ntwo!')
})

test('an edit writes only the block that it changed', () => {
  const { editor, value } = editorWith(`![pic](${PIXEL}) caption\n\none\n\ntwo`)
  const box = area(editor)
  input(box)
  const image = box.querySelector('img')
  const read = Element.prototype.getAttribute
  const reads = spy(image, 'getAttribute', (name) => read.call(image, name))
  box.children[2].firstChild.appendData('!')
  input(box)
  expect(value.get()).toEqual(`![pic](${PIXEL}) caption\n\none\n\ntwo!`)
  expect(reads.calls.length).toEqual(0)
  box.children[0].lastChild.appendData('!')
  input(box)
  expect(value.get()).toEqual(`![pic](${PIXEL}) caption!\n\none\n\ntwo!`)
  expect(reads.calls.some(([name]) => name === 'src')).toEqual(true)
})

test('validate reports after the person leaves the editor, not while typing', () => {
  const problem = (text) => (text.includes('bad') ? 'No bad words' : null)
  const host = mounted(richTextEditor({ value: '', label: 'Body', validate: problem }))
  const box = area(host)
  box.querySelector('p').textContent = 'bad'
  input(box)
  expect(inner(host, '.error').hidden).toEqual(true)
  box.dispatchEvent(new Event('blur'))
  expect(inner(host, '.error').hidden).toEqual(false)
  expect(inner(host, '.error').textContent).toEqual('No bad words')
  expect(box.getAttribute('aria-invalid')).toEqual('true')
})

test('disabled follows a state and closes the toolbar to interaction', () => {
  let disabled
  const root = mounted(
    stateHost((self) => {
      disabled = initState(self, 'rich.disabled', false)
      return richTextEditor({ value: '', label: 'Body', disabled })
    }),
  )
  const editor = root.shadowRoot.querySelector('imp-rich-text-editor')
  expect(area(editor).getAttribute('contenteditable')).toEqual('true')
  disabled.set(true)
  expect(area(editor).getAttribute('contenteditable')).toEqual('false')
  expect(area(editor).getAttribute('aria-disabled')).toEqual('true')
  expect(tools(editor).every((button) => button.disabled)).toEqual(true)
})

test('a read-only editor hides the toolbar and is not editable', () => {
  const host = mounted(richTextEditor({ value: 'Text', label: 'Body', readonly: true }))
  expect(area(host).getAttribute('contenteditable')).toEqual('false')
  expect(area(host).getAttribute('aria-readonly')).toEqual('true')
  expect(inner(host, '[role="toolbar"]').hidden).toEqual(true)
})

test('rows sets the minimum height, and a bad value falls back with a warning', () => {
  const tall = mounted(richTextEditor({ value: '', label: 'Body', rows: 12 }))
  expect(area(tall).style.getPropertyValue('--rows')).toEqual('12')
  const warn = warnings()
  const odd = mounted(richTextEditor({ value: '', label: 'Body', rows: 'many', imageSize: -1 }))
  expect(warned(warn, "'rows' must be a positive integer")).toEqual(true)
  expect(warned(warn, "'imageSize' must be a positive integer")).toEqual(true)
  expect(area(odd).style.getPropertyValue('--rows')).toEqual('6')
})

test('the emoji panel is the searchable emoji panel, and children are refused', () => {
  const warn = warnings()
  const host = mounted(richTextEditor({ value: '', label: 'Body' }, 'stray'))
  expect(warned(warn, 'takes no content')).toEqual(true)
  const panel = inner(host, '.panel-emoji')
  expect(panel.getAttribute('role')).toEqual('dialog')
  expect(panel.getAttribute('aria-label')).toEqual('Emoji')
  expect(inner(host, '.emoji-search').getAttribute('aria-label')).toEqual('Search emoji')
  const emoji = [...host.shadowRoot.querySelectorAll('.emoji-choice')]
  expect(emoji.length).toEqual(482)
  expect(emoji[0].textContent).toEqual(String.fromCodePoint(0x1f600))
})
