import { div, html, isPlainObject, mount, span } from 'imp'
import { beforeEach, expect, test } from 'imp/test'

beforeEach(() => {
  document.body.replaceChildren()
})

test('mount renders into a selector target', () => {
  document.body.appendChild(div({ id: 'app' }, 'old'))
  mount('#app', div('new'))
  expect(document.querySelector('#app').textContent).toEqual('new')
})

test('mount renders into an element target', () => {
  const host = document.body.appendChild(div())
  mount(host, span('content'))
  expect(host.textContent).toEqual('content')
})

test('mount calls a function view', () => {
  mount(document.body, () => div('from view'))
  expect(document.body.textContent).toEqual('from view')
})

test('mount accepts an array view, skipping null and false', () => {
  mount(document.body, [div('a'), null, false, 'text', 42])
  expect(document.body.childNodes.length).toEqual(3)
  expect(document.body.textContent).toEqual('atext42')
})

test('mount throws when the target is missing', () => {
  expect(() => mount('#missing', div())).toThrow('mount target not found')
})

test('mount returns an unmount function that clears the host', () => {
  const host = document.body.appendChild(div())
  const unmount = mount(host, div('temporary'))
  unmount()
  expect(host.childNodes.length).toEqual(0)
})

test('html parses markup into a fragment', () => {
  const fragment = html('<p>a</p><p>b</p>')
  expect(fragment.childNodes.length).toEqual(2)
  expect(fragment.textContent).toEqual('ab')
})

test('html output nests as a child', () => {
  const node = div(html('<em>hi</em>'))
  expect(node.querySelector('em').textContent).toEqual('hi')
})

test('isPlainObject accepts object literals and null-prototype objects', () => {
  expect(isPlainObject({})).toBeTruthy()
  expect(isPlainObject(Object.create(null))).toBeTruthy()
})

test('isPlainObject rejects everything else', () => {
  expect(isPlainObject(null)).not.toBeTruthy()
  expect(isPlainObject([])).not.toBeTruthy()
  expect(isPlainObject(new Date())).not.toBeTruthy()
  expect(isPlainObject(div())).not.toBeTruthy()
  expect(isPlainObject('text')).not.toBeTruthy()
})
