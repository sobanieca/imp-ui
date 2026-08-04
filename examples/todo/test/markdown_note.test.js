import { init, mount } from 'imp'
import { form, textArea } from 'imp/std/inputs'
import { beforeAll, beforeEach, expect, test } from 'imp/test'
import { markdownNote } from '../src/components/markdown_note.js'

const find = (root, selector) => {
  const direct = root.querySelector(selector)
  if (direct) return direct
  for (const node of [root, ...root.querySelectorAll('*')]) {
    if (!node.shadowRoot) continue
    const found = find(node.shadowRoot, selector)
    if (found) return found
  }
  return null
}

const note = () => find(document.body, '.note')

const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeAll(() => init({ translations: { en: () => import('../locales/en.js') } }))

beforeEach(() => document.body.replaceChildren())

test('renders markdown from a plain source', () => {
  mount(document.body, markdownNote({ source: 'Start with **imp skill state**.' }))

  expect(note().querySelector('strong').textContent).toEqual('imp skill state')
})

test('renders lists, code and links', () => {
  mount(
    document.body,
    markdownNote({ source: '- run `imp install`\n- read [the docs](https://example.com)\n' }),
  )

  expect(note().querySelectorAll('li').length).toEqual(2)
  expect(note().querySelector('code').textContent).toEqual('imp install')
  expect(note().querySelector('a').getAttribute('href')).toEqual('https://example.com')
})

test('escapes raw html instead of running it', () => {
  mount(document.body, markdownNote({ source: 'Careful <script>alert(1)</script>' }))

  expect(note().querySelector('script')).toEqual(null)
  expect(note().textContent).toContain('<script>alert(1)</script>')
})

test('says so when there is nothing to preview', () => {
  mount(document.body, markdownNote({ source: '   ' }))

  expect(note()).toEqual(null)
  expect(find(find(document.body, 'imp-text'), 'p').textContent).toEqual('Nothing to preview yet.')
})

test('follows the form field it names as it is typed', async () => {
  mount(
    document.body,
    form(
      { initialValues: { notes: '**first**' } },
      textArea({ field: 'notes', label: 'Notes' }),
      markdownNote({ field: 'notes' }),
    ),
  )
  expect(note().querySelector('strong').textContent).toEqual('first')

  const field = find(document.body, 'textarea')
  field.value = '**second**'
  field.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
  await settled()

  expect(note().querySelector('strong').textContent).toEqual('second')
})
