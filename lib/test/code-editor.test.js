import { component, mount } from 'imp'
import { codeEditor, form } from 'imp/std/inputs'
import { initState, useState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const control = (host) => inner(host, 'textarea')

const mirrorText = (host) => inner(host, '.mirror').textContent

const tokens = (host, type) =>
  [...host.shadowRoot.querySelectorAll(`.token-${type}`)].map((node) => node.textContent)

const type = (textarea, value) => {
  textarea.value = value
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

const press = (node, key, init = {}) =>
  node.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  )

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

beforeEach(() => {
  document.body.replaceChildren()
})

test('codeEditor renders a labelled textarea over a highlighted mirror', () => {
  const host = mounted(codeEditor({ value: 'const a = 1', label: 'Script', language: 'js' }))
  expect(host.localName).toEqual('imp-code-editor')
  const textarea = control(host)
  expect(inner(host, 'label').getAttribute('for')).toEqual(textarea.id)
  expect(inner(host, 'label').textContent).toEqual('Script')
  expect(textarea.value).toEqual('const a = 1')
  expect(inner(host, '.mirror').getAttribute('aria-hidden')).toEqual('true')
  expect(tokens(host, 'keyword')).toEqual(['const'])
  expect(tokens(host, 'number')).toEqual(['1'])
})

test('the key hint names the way out and describes the control', () => {
  const host = mounted(codeEditor({ value: '', label: 'Script', help: 'Some help' }))
  const described = control(host).getAttribute('aria-describedby').split(' ')
  const hint = inner(host, '.keys')
  expect(described.includes(hint.id)).toEqual(true)
  expect(described.includes(inner(host, '.help').id)).toEqual(true)
  expect(hint.textContent.includes('Escape')).toEqual(true)
})

test('typing commits the text to the bound state and re-highlights the mirror', () => {
  let source
  const host = component('code-editor-host', {
    setup: (self) => {
      source = initState(self, 'editor.source', '')
      return codeEditor({ value: source, label: 'JSON', language: 'json' })
    },
  })
  const root = mounted(host())
  const editor = root.shadowRoot.querySelector('imp-code-editor')
  type(control(editor), '{ "port": 4516 }')
  expect(source.get()).toEqual('{ "port": 4516 }')
  expect(tokens(editor, 'property')).toEqual(['"port"'])
  expect(tokens(editor, 'number')).toEqual(['4516'])
  expect(mirrorText(editor)).toEqual('{ "port": 4516 } ')
})

test('a change of the state from outside shows in the textarea and the mirror', () => {
  let source
  const host = component('code-editor-outside', {
    setup: (self) => {
      source = initState(self, 'editor.outside', 'a')
      return codeEditor({ value: source, label: 'Text' })
    },
  })
  const root = mounted(host())
  const editor = root.shadowRoot.querySelector('imp-code-editor')
  source.set('b\n')
  expect(control(editor).value).toEqual('b\n')
  expect(mirrorText(editor)).toEqual('b\n ')
})

test('codeEditor binds to a form field', () => {
  let values
  const reader = component('code-editor-reader', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(
    form(
      { initialValues: { config: '{}' } },
      codeEditor({ field: 'config', label: 'Config', language: 'json' }),
      reader(),
    ),
  )
  const editor = host.shadowRoot.querySelector('imp-code-editor')
  expect(control(editor).value).toEqual('{}')
  type(control(editor), '{ "a": 1 }')
  expect(values.get()).toEqual({ config: '{ "a": 1 }' })
})

test('validate reports after the person leaves the editor, not while typing', () => {
  const problem = (text) => (text.includes('bad') ? 'No bad words' : null)
  const host = mounted(codeEditor({ value: '', label: 'Text', validate: problem }))
  const textarea = control(host)
  type(textarea, 'bad')
  expect(inner(host, '.error').hidden).toEqual(true)
  textarea.dispatchEvent(new Event('blur'))
  expect(inner(host, '.error').hidden).toEqual(false)
  expect(inner(host, '.error').textContent).toEqual('No bad words')
  expect(textarea.getAttribute('aria-invalid')).toEqual('true')
})

test('a read-only editor leaves Tab and Enter to the browser', () => {
  const host = mounted(codeEditor({ value: 'a', label: 'Text', readonly: true }))
  const textarea = control(host)
  expect(textarea.hasAttribute('readonly')).toEqual(true)
  expect(press(textarea, 'Tab')).toEqual(true)
  expect(press(textarea, 'Enter')).toEqual(true)
  expect(textarea.value).toEqual('a')
})

test('Escape releases the next Tab so the focus can move on', () => {
  const host = mounted(codeEditor({ value: 'ab', label: 'Text' }))
  const textarea = control(host)
  press(textarea, 'Escape')
  expect(press(textarea, 'Tab')).toEqual(true)
  expect(press(textarea, 'Tab', { ctrlKey: true })).toEqual(true)
})

test('disabled follows a state', () => {
  let disabled
  const host = component('code-editor-disabled', {
    setup: (self) => {
      disabled = initState(self, 'editor.disabled', false)
      return codeEditor({ value: '', label: 'Text', disabled })
    },
  })
  const root = mounted(host())
  const editor = root.shadowRoot.querySelector('imp-code-editor')
  expect(control(editor).disabled).toEqual(false)
  disabled.set(true)
  expect(control(editor).disabled).toEqual(true)
})

test('rows sets the visible lines and a bad value falls back with a warning', () => {
  const tall = mounted(codeEditor({ value: '', label: 'Text', rows: 4 }))
  expect(control(tall).getAttribute('rows')).toEqual('4')
  const warn = warnings()
  const odd = mounted(codeEditor({ value: '', label: 'Text', rows: 'many' }))
  expect(warned(warn, "'rows' must be a positive integer")).toEqual(true)
  expect(control(odd).getAttribute('rows')).toEqual('10')
})

test('an unknown language is logged and the text shows plain', () => {
  const warn = warnings()
  const host = mounted(codeEditor({ value: 'const x', label: 'Text', language: 'klingon' }))
  expect(warned(warn, "unknown language 'klingon'")).toEqual(true)
  expect(host.shadowRoot.querySelectorAll('[class^="token-"]').length).toEqual(0)
})

test('children are refused with a warning', () => {
  const warn = warnings()
  mounted(codeEditor({ value: '', label: 'Text' }, 'stray'))
  expect(warned(warn, 'takes no content')).toEqual(true)
})
