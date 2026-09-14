import { component, mount } from 'imp'
import { form, richTextEditor } from 'imp/std/inputs'
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

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const stateHost = component('rich-text-state-host', { setup: (self, render) => render(self) })

const editorWith = (markdown) => {
  let value
  const root = mounted(stateHost((self) => {
    value = initState(self, 'rich.value', markdown)
    return richTextEditor({ value, label: 'Body' })
  }))
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

test('a link or an image with a script address is dropped', () => {
  const { editor } = editorWith('[x](javascript:alert(1)) ![y](javascript:alert(1)) [ok](/docs)')
  const box = area(editor)
  expect(box.querySelectorAll('a').length).toEqual(1)
  expect(box.querySelector('a').getAttribute('href')).toEqual('/docs')
  expect(box.querySelector('img')).toEqual(null)
  expect(box.textContent).toEqual('x y ok')
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
  const root = mounted(stateHost((self) => {
    disabled = initState(self, 'rich.disabled', false)
    return richTextEditor({ value: '', label: 'Body', disabled })
  }))
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

test('the emoji panel holds emoji buttons, and children are refused with a warning', () => {
  const warn = warnings()
  const host = mounted(richTextEditor({ value: '', label: 'Body' }, 'stray'))
  expect(warned(warn, 'takes no content')).toEqual(true)
  const emoji = [...host.shadowRoot.querySelectorAll('.emoji')]
  expect(emoji.length).toEqual(48)
  expect(emoji[0].textContent).toEqual(String.fromCodePoint(0x1f600))
  expect(inner(host, '.panel-emoji').getAttribute('aria-label')).toEqual('Emoji')
})
